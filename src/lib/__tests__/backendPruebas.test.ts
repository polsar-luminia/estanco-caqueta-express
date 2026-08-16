/**
 * El interruptor de staging por número de teléfono. Lo que se fija:
 * el número de prueba manda TODO a staging, cualquier otro devuelve a prod,
 * y el cambio es observable síncronamente (apiFetch y tracker lo leen por request).
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
  hidratarModoPruebas,
} from "../backendPruebas";

beforeEach(async () => {
  await hidratarModoPruebas();
  await aplicarModoPorTelefono("3000000000"); // resetear a prod
});

describe("backendPruebas", () => {
  it("reconoce el número de prueba del equipo", () => {
    expect(esTelefonoPrueba("3183224021")).toBe(true);
    expect(esTelefonoPrueba(" 3183224021 ")).toBe(true);
    expect(esTelefonoPrueba("3001234567")).toBe(false);
  });

  it("número de prueba → staging; cualquier otro → prod", async () => {
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
