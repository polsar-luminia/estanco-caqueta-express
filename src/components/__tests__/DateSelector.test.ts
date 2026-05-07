import { describe, it, expect, vi, afterEach } from "vitest";
import { calcularEdad } from "../DateSelector";

afterEach(() => {
  vi.useRealTimers();
});

describe("calcularEdad", () => {
  it("devuelve null si la fecha está incompleta", () => {
    expect(calcularEdad({ day: 5, month: 5 })).toBeNull();
    expect(calcularEdad({})).toBeNull();
  });

  it("calcula edad correctamente en caso normal", () => {
    // 2026-05-05 12:00 UTC = 07:00 AM Bogota (UTC-5) → mismo día
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-05T12:00:00Z"));
    // Cumpleaños hoy → ya cumplió
    expect(calcularEdad({ day: 5, month: 5, year: 1995 })).toBe(31);
    // Cumpleaños mañana → aún no cumple
    expect(calcularEdad({ day: 6, month: 5, year: 1995 })).toBe(30);
  });

  it("boundary: 23:30 PM Bogota = 04:30 UTC del dia siguiente — cumpleanos aun no ocurre", () => {
    // En UTC, es 2026-05-05T04:30Z (madrugada del 5).
    // En America/Bogota (UTC-5), sigue siendo 23:30 del 4 de mayo.
    // Una persona nacida el 5 de mayo NO ha cumplido anos todavia en Bogota.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-05T04:30:00Z"));
    const edad = calcularEdad({ day: 5, month: 5, year: 1995 });
    // Debe ser 30, no 31 (el cumpleanos es manana en Colombia)
    expect(edad).toBe(30);
  });

  it("boundary: 00:30 AM Bogota = 05:30 UTC — cumpleanos ya ocurrio", () => {
    // En UTC, es 2026-05-05T05:30Z.
    // En America/Bogota (UTC-5), ya es 00:30 del 5 de mayo.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-05T05:30:00Z"));
    const edad = calcularEdad({ day: 5, month: 5, year: 1995 });
    // Debe ser 31 (ya es 5 de mayo en Colombia)
    expect(edad).toBe(31);
  });
});
