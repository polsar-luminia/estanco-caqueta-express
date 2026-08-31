/**
 * El interruptor de staging por número de teléfono.
 *
 * LA LISTA ESTÁ VACÍA Y ASÍ DEBE QUEDARSE. Se pobló el 23-ago-2026 con el
 * número del dueño para probar la 1.3.2 desde un TestFlight de producción, con
 * la nota de quitarlo "en cuanto termine la prueba"; la 1.3.2 lleva publicada
 * desde entonces y el número seguía ahí el 31-ago, mientras STAGING-ESTANCO.md
 * afirmaba desde el 21/08 que la lista estaba vacía.
 *
 * Por qué importa más de lo que parece: `aplicarModoPorTelefono()` corre en
 * `login.tsx` ANTES de autenticar, así que la pantalla de login es un
 * interruptor de entorno accionable desde el campo de teléfono. Mientras un
 * número esté aquí, su dueño NO puede comprar de verdad —la app entera lo manda
 * a staging— y el síntoma es que sus pedidos no existen para el negocio. Ya
 * pasó una vez (bc4edf8, tres cuentas de staging creadas por error).
 *
 * Para probar contra staging está el perfil `staging` de eas.json, que no
 * depende de que nadie se acuerde de revertir una constante.
 *
 * Lo que se protege aquí: que la lista esté vacía, que con la lista vacía nadie
 * pueda irse a staging tecleando un número, y que el modo pegajoso guardado de
 * una sesión anterior se limpie solo al arrancar.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

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
  TELEFONOS_PRUEBA,
  hidratarModoPruebas,
} from "../backendPruebas";

beforeEach(async () => {
  for (const k of Object.keys(almacen)) delete almacen[k];
  await hidratarModoPruebas();
});

describe("backendPruebas", () => {
  it("la lista de teléfonos de prueba está VACÍA", () => {
    // Si esta prueba falla, alguien volvió a poner un número aquí. Antes de
    // "arreglar" la prueba: ese número deja de poder comprar de verdad, y el
    // fallo no avisa a nadie más que a quien lea este comentario.
    expect(TELEFONOS_PRUEBA).toEqual([]);
  });

  it("con la lista vacía, ningún teléfono manda la app a staging", async () => {
    expect(esTelefonoPrueba("3183224021")).toBe(false);
    expect(esTelefonoPrueba("3001234567")).toBe(false);

    await aplicarModoPorTelefono("3183224021");
    expect(modoPruebasActivo()).toBe(false);
    expect(baseUrlActual()).toBe("https://prod.local/api/v1");
  });

  it("limpia el modo pegajoso que quedó guardado de una versión anterior", async () => {
    // EL CASO REAL QUE CREA ESTA OTA: un dispositivo que quedó en modo staging
    // mientras la lista estaba poblada. `aplicarModoPorTelefono` solo corre al
    // iniciar sesión, así que sin esta limpieza seguiría hablando con staging
    // para siempre — sus pedidos no existirían para el negocio y nada lo
    // delataría, porque la app funciona igual de bien contra el otro backend.
    //
    // Hay que rearmar el módulo: `hidratarModoPruebas` memoiza su promesa y se
    // autoinvoca al importarse, así que llamarla otra vez no relee nada. Lo que
    // se prueba es el ARRANQUE, y el arranque ocurre una vez.
    vi.resetModules();
    almacen["backend_pruebas_activo"] = "1";
    const mod = await import("../backendPruebas");
    await mod.hidratarModoPruebas();
    expect(mod.modoPruebasActivo()).toBe(false);
    expect(mod.baseUrlActual()).toBe("https://prod.local/api/v1");
    // El borrado de la clave es fire-and-forget dentro de la hidratación: se
    // deja pasar un turno del bucle de eventos antes de mirarla.
    await new Promise((r) => setTimeout(r, 0));
    expect(almacen["backend_pruebas_activo"]).toBeUndefined();
  });
});
