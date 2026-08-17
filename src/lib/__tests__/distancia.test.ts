import { describe, it, expect } from "vitest";
import { distanciaMetros, textoDistancia } from "../distancia";

const ESTANCO = { lat: 1.6172830, lng: -75.6122891 };

describe("distanciaMetros", () => {
  it("mismo punto = 0", () => {
    expect(distanciaMetros(ESTANCO, ESTANCO)).toBe(0);
  });

  it("del estanco a la Calle 29 da ~1,6 km (caso real de Florencia)", () => {
    const d = distanciaMetros(ESTANCO, { lat: 1.631058, lng: -75.603518 });
    expect(d).toBeGreaterThan(1400);
    expect(d).toBeLessThan(1900);
  });

  it("es simetrica", () => {
    const a = { lat: 1.61, lng: -75.61 };
    const b = { lat: 1.63, lng: -75.6 };
    expect(distanciaMetros(a, b)).toBe(distanciaMetros(b, a));
  });
});

describe("textoDistancia", () => {
  it("por debajo de 100 m NO inventa cifras: el punto tiene su propio error", () => {
    expect(textoDistancia(12)).toBe("Está llegando");
    expect(textoDistancia(99)).toBe("Está llegando");
  });

  it("en metros redondea a la decena", () => {
    expect(textoDistancia(437)).toBe("A 440 m en línea recta");
  });

  it("en kilometros usa coma decimal (es-CO)", () => {
    expect(textoDistancia(1640)).toBe("A 1,6 km en línea recta");
  });

  it("siempre dice 'en linea recta': el recorrido por calles es mayor y no se puede prometer", () => {
    expect(textoDistancia(500)).toContain("en línea recta");
    expect(textoDistancia(5000)).toContain("en línea recta");
  });
});
