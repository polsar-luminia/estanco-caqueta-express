/**
 * El interruptor de staging por número de teléfono.
 *
 * Reactivado el 23-ago-2026 con el número del dueño (3183224021) para probar
 * la 1.3.2 desde un TestFlight de producción — ver el comentario largo en
 * backendPruebas.ts sobre por qué se vació antes (bc4edf8, tres cuentas de
 * staging borradas por error) y por qué esto es temporal.
 *
 * Lo que se protege aquí: el número de prueba manda TODO a staging, cualquier
 * otro va a prod, y el modo pegajoso (AsyncStorage) queda coherente entre
 * sesiones sin estados mixtos.
 *
 * La limpieza automática del modo pegajoso cuando la lista queda vacía
 * (`hidratarModoPruebas`, agregada en bc4edf8) sigue en el código pero no
 * tiene prueba dedicada mientras la lista esté poblada de verdad: con
 * TELEFONOS_PRUEBA no vacía, un flag guardado de "1" hidrata como activo por
 * diseño (es justo el modo pegajoso funcionando). Si la lista se vacía otra
 * vez, esa prueba debe volver — se borró aquí en vez de dejarla fingiendo una
 * lista vacía que la fuente ya no tiene.
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
  STAGING_URL,
  TELEFONOS_PRUEBA,
  hidratarModoPruebas,
} from "../backendPruebas";

beforeEach(async () => {
  await hidratarModoPruebas();
  await aplicarModoPorTelefono("3009999999"); // resetear a prod entre pruebas
});

describe("backendPruebas", () => {
  it("el número del dueño está en la lista de prueba, a propósito", () => {
    // Si esta prueba falla porque la lista está vacía: la reactivación de
    // TELEFONOS_PRUEBA se revirtió sin querer. Si falla porque tiene OTRO
    // número: alguien puso ahí una cuenta que sí se usa para comprar de
    // verdad, y eso es exactamente el bug de bc4edf8 repitiéndose.
    expect(TELEFONOS_PRUEBA).toEqual(["3183224021"]);
  });

  it("número de prueba → staging; cualquier otro → prod", async () => {
    expect(esTelefonoPrueba("3183224021")).toBe(true);
    expect(esTelefonoPrueba(" 3183224021 ")).toBe(true);
    expect(esTelefonoPrueba("3001234567")).toBe(false);

    expect(baseUrlActual()).toBe("https://prod.local/api/v1");

    await aplicarModoPorTelefono("3183224021");
    expect(modoPruebasActivo()).toBe(true);
    expect(baseUrlActual()).toBe(STAGING_URL);

    // Un cliente normal en el mismo dispositivo devuelve la app a producción.
    await aplicarModoPorTelefono("3009999999");
    expect(modoPruebasActivo()).toBe(false);
    expect(baseUrlActual()).toBe("https://prod.local/api/v1");
  });

  it("persiste el modo para el próximo arranque (pegajoso)", async () => {
    await aplicarModoPorTelefono("3183224021");
    expect(almacen["backend_pruebas_activo"]).toBe("1");
    await aplicarModoPorTelefono("3009999999");
    expect(almacen["backend_pruebas_activo"]).toBeUndefined();
  });
});
