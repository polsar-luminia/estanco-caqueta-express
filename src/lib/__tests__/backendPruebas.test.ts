/**
 * El interruptor de staging por número de teléfono.
 *
 * ESTA LISTA NO ES UNA BANDERA DE PRODUCTO: mientras un número esté vigente en
 * ella, su dueño NO puede comprar de verdad —la app entera lo manda a staging—
 * y el síntoma es que sus pedidos no existen para el negocio. Ya pasó: se pobló
 * el 23-ago-2026 con el número del dueño para probar la 1.3.2 desde un
 * TestFlight de producción, con la nota de quitarlo «en cuanto termine la
 * prueba»; la 1.3.2 se publicó y el número seguía ahí el 31-ago (`bc4edf8`, tres
 * cuentas de staging creadas por error).
 *
 * Por qué esta prueba dejó de exigir que la lista esté VACÍA: exigirlo dejaba un
 * solo camino cuando alguien de verdad necesitaba probar con su teléfono real
 * —borrar la prueba—, y una prueba que se borra no protege nada. Lo que se
 * protege ahora es lo que evita que se repita el incidente:
 *
 *   1. Qué números hay, uno por uno y con dueño conocido. Agregar uno exige
 *      editar también esta lista: no se cuela en un commit de otra cosa.
 *   2. Que la lista VENZA sola, y que vencer devuelva el teléfono a producción
 *      —incluido el dispositivo que ya tenía el modo pegajoso guardado, sin que
 *      nadie tenga que cerrar sesión ni adivinar nada.
 *   3. Que un número fuera de la lista nunca se vaya a staging.
 *
 * Si el punto 1 falla, alguien agregó un número: antes de «arreglar» la prueba,
 * confirmar de quién es ese teléfono y que puede dejar de comprar de verdad.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const almacen: Record<string, string> = {};
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async (k: string) => almacen[k] ?? null),
    setItem: vi.fn(async (k: string, v: string) => { almacen[k] = v; }),
    removeItem: vi.fn(async (k: string) => { delete almacen[k]; }),
  },
}));
vi.mock("../../constants/config", () => ({ API_URL: "https://prod.local/api/v1" }));

import {
  esTelefonoPrueba,
  aplicarModoPorTelefono,
  baseUrlActual,
  modoPruebasActivo,
  listaVigente,
  TELEFONOS_PRUEBA,
  TELEFONOS_PRUEBA_HASTA,
  STAGING_URL,
  hidratarModoPruebas,
} from "../backendPruebas";

/** Cuentas del equipo autorizadas a mandar la app real a staging. */
const AUTORIZADOS = [
  "3054239970", // 07-sep-2026 — cuenta del equipo (id 2 en produccion)
];

const ANTES = new Date(`${TELEFONOS_PRUEBA_HASTA}T12:00:00-05:00`);
const DESPUES = new Date(`${TELEFONOS_PRUEBA_HASTA}T23:59:59-05:00`).getTime() + 1;

beforeEach(async () => {
  for (const k of Object.keys(almacen)) delete almacen[k];
  await hidratarModoPruebas();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("backendPruebas", () => {
  it("solo contiene números del equipo, declarados aquí uno por uno", () => {
    expect(TELEFONOS_PRUEBA).toEqual(AUTORIZADOS);
  });

  it("la lista tiene fecha de vencimiento y deja de mandar a staging después", () => {
    expect(TELEFONOS_PRUEBA_HASTA).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(listaVigente(ANTES)).toEqual(TELEFONOS_PRUEBA);
    expect(listaVigente(new Date(DESPUES))).toEqual([]);
  });

  it("un número que no está en la lista nunca se va a staging", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(ANTES);

    expect(esTelefonoPrueba("3001234567")).toBe(false);

    await aplicarModoPorTelefono("3001234567");
    expect(modoPruebasActivo()).toBe(false);
    expect(baseUrlActual()).toBe("https://prod.local/api/v1");
  });

  it("un número vigente manda la app entera a staging", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(ANTES);

    expect(esTelefonoPrueba(` ${AUTORIZADOS[0]} `)).toBe(true);

    await aplicarModoPorTelefono(AUTORIZADOS[0]);
    expect(modoPruebasActivo()).toBe(true);
    expect(baseUrlActual()).toBe(STAGING_URL);
    expect(almacen["backend_pruebas_activo"]).toBe("1");
  });

  it("vencida, ya no lo manda ni aunque teclee el mismo número", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(DESPUES);

    expect(esTelefonoPrueba(AUTORIZADOS[0])).toBe(false);

    await aplicarModoPorTelefono(AUTORIZADOS[0]);
    expect(modoPruebasActivo()).toBe(false);
    expect(baseUrlActual()).toBe("https://prod.local/api/v1");
  });

  it("mientras esté vigente, el modo pegajoso sobrevive al reinicio", async () => {
    // Es la razon de ser del modo: "mi cuenta siempre apunta a pruebas".
    // `aplicarModoPorTelefono` solo corre al iniciar sesion, asi que si el
    // arranque no respetara lo guardado, cada reinicio devolveria la app a
    // produccion y el token guardado quedaria hablandole al backend equivocado.
    vi.useFakeTimers();
    vi.setSystemTime(ANTES);
    vi.resetModules();
    almacen["backend_pruebas_activo"] = "1";

    const mod = await import("../backendPruebas");
    await mod.hidratarModoPruebas();
    expect(mod.modoPruebasActivo()).toBe(true);
    expect(mod.baseUrlActual()).toBe(mod.STAGING_URL);
  });

  it("vencida, el arranque limpia solo el modo pegajoso que quedó guardado", async () => {
    // ESTO ES LO QUE LE DA DIENTES AL VENCIMIENTO. Sin esta limpieza, el
    // telefono que ya estaba en modo staging seguiria ahi para siempre aunque
    // la lista venciera —la app se "arregla" solo si cierra sesion y vuelve a
    // entrar, que es exactamente lo que nadie adivina que hay que hacer— y sus
    // pedidos no existirian para el negocio sin que nada lo delatara, porque la
    // app funciona igual de bien contra el otro backend.
    //
    // Hay que rearmar el modulo: `hidratarModoPruebas` memoiza su promesa y se
    // autoinvoca al importarse, asi que llamarla otra vez no relee nada. Lo que
    // se prueba es el ARRANQUE, y el arranque ocurre una vez.
    vi.useFakeTimers();
    vi.setSystemTime(DESPUES);
    vi.resetModules();
    almacen["backend_pruebas_activo"] = "1";

    const mod = await import("../backendPruebas");
    await mod.hidratarModoPruebas();
    expect(mod.modoPruebasActivo()).toBe(false);
    expect(mod.baseUrlActual()).toBe("https://prod.local/api/v1");
    // El borrado de la clave es fire-and-forget dentro de la hidratacion: se
    // deja pasar un turno del bucle de eventos antes de mirarla.
    await vi.advanceTimersByTimeAsync(0);
    expect(almacen["backend_pruebas_activo"]).toBeUndefined();
  });
});
