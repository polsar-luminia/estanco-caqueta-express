/**
 * El interruptor de staging por número de teléfono.
 *
 * Desde el 21-ago-2026 `TELEFONOS_PRUEBA` está VACÍA a propósito (ver el
 * comentario en backendPruebas.ts): tenía el número del dueño y lo mandaba a
 * staging cada vez que abría la app de la tienda con su propio número.
 *
 * Estas pruebas fijan esa decisión y, sobre todo, la migración: el modo es
 * pegajoso, así que vaciar la lista no bastaba — quien ya lo tenía activo se
 * quedaba en staging para siempre. Esa limpieza es el código nuevo y el que de
 * verdad hay que proteger.
 *
 * Si algún día se vuelve a agregar un número, hay que devolver también las
 * pruebas del mecanismo (número de prueba → staging, otro → prod) que este
 * commit reemplazó.
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
  await hidratarModoPruebas();
});

describe("backendPruebas", () => {
  it("la lista de teléfonos de prueba está vacía", () => {
    // Es la decisión, no un accidente: la app de la tienda va SIEMPRE a
    // producción. Si esta prueba falla, alguien agregó un número — y más vale
    // que sea uno que NO se use para comprar de verdad.
    expect(TELEFONOS_PRUEBA).toEqual([]);
  });

  it("ningún número activa el modo pruebas, ni el que estaba antes", async () => {
    expect(esTelefonoPrueba("3183224021")).toBe(false);
    expect(esTelefonoPrueba("3001234567")).toBe(false);

    await aplicarModoPorTelefono("3183224021");
    expect(modoPruebasActivo()).toBe(false);
    expect(baseUrlActual()).toBe("https://prod.local/api/v1");
  });

  it("limpia el modo pegajoso que quedó activo de antes", async () => {
    // El caso real de la migración: el teléfono del dueño ya traía el flag
    // guardado del build anterior. Sin esta limpieza seguiria en staging
    // aunque su numero ya no este en la lista, porque `aplicarModoPorTelefono`
    // solo corre al iniciar sesion.
    almacen["backend_pruebas_activo"] = "1";
    vi.resetModules();
    const mod = await import("../backendPruebas");
    await mod.hidratarModoPruebas();

    expect(mod.modoPruebasActivo()).toBe(false);
    expect(almacen["backend_pruebas_activo"]).toBeUndefined();
    expect(mod.baseUrlActual()).toBe("https://prod.local/api/v1");
  });
});
