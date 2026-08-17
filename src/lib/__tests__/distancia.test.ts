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

import { rumboGrados, rotacionMoto, rumboSiSeMovio, MOTO_APUNTA_A } from "../distancia";

describe("rumboGrados", () => {
  const p = { lat: 1.62, lng: -75.61 };
  it("norte, sur, este y oeste", () => {
    expect(rumboGrados(p, { lat: 1.63, lng: -75.61 })).toBeCloseTo(0, 0);
    expect(rumboGrados(p, { lat: 1.61, lng: -75.61 })).toBeCloseTo(180, 0);
    expect(rumboGrados(p, { lat: 1.62, lng: -75.60 })).toBeCloseTo(90, 0);
    expect(rumboGrados(p, { lat: 1.62, lng: -75.62 })).toBeCloseTo(270, 0);
  });

  it("nororiente cae en el primer cuadrante", () => {
    const r = rumboGrados(p, { lat: 1.63, lng: -75.60 });
    expect(r).toBeGreaterThan(20);
    expect(r).toBeLessThan(70);
  });
});

describe("rotacionMoto", () => {
  it("para el rumbo en que la imagen ya apunta, no rota nada", () => {
    expect(rotacionMoto(MOTO_APUNTA_A)).toBe(0);
  });
  it("siempre queda entre 0 y 360", () => {
    for (const r of [0, 90, 180, 270, 359]) {
      const v = rotacionMoto(r);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(360);
    }
  });
});

describe("rumboSiSeMovio", () => {
  const destino = { lat: 1.64, lng: -75.60 };

  it("sin recorrido previo apunta hacia la casa, no a un valor arbitrario", () => {
    const r = rumboSiSeMovio(null, { lat: 1.62, lng: -75.61 }, null, destino);
    expect(r).toBeCloseTo(rumboGrados({ lat: 1.62, lng: -75.61 }, destino), 0);
  });

  it("un movimiento minusculo NO cambia el rumbo: la moto giraria sola en un semaforo", () => {
    const previo = 90;
    const r = rumboSiSeMovio({ lat: 1.62, lng: -75.61 }, { lat: 1.620005, lng: -75.61 }, previo, destino);
    expect(r).toBe(previo);
  });

  it("un movimiento real si actualiza el rumbo", () => {
    const r = rumboSiSeMovio({ lat: 1.62, lng: -75.61 }, { lat: 1.6215, lng: -75.61 }, 270, destino);
    expect(r).toBeCloseTo(0, 0);
  });
});
