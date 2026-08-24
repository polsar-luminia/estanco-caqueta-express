// El acomodo del mosaico es la unica parte que se puede equivocar en silencio:
// una tarjeta mal colocada no lanza nada, se pinta encima de otra o deja un
// hueco. Estas pruebas afirman POSICIONES exactas y, sobre todo, que ninguna
// celda se solape con otra — que es el fallo que en pantalla se ve como "una
// categoria desaparecio".

import { describe, it, expect } from "vitest";
import { acomodarMosaico, medidasCelda } from "../mosaico";

const cat = (id: number, ancho?: number | null, alto?: number | null) => ({
  id,
  mosaico_ancho: ancho,
  mosaico_alto: alto,
});

/** Ninguna celda puede pisar a otra. Se comprueba celda a celda de la matriz. */
function sinSolapes(celdas: ReturnType<typeof acomodarMosaico>["celdas"]) {
  const usadas = new Set<string>();
  for (const c of celdas) {
    for (let f = c.fila; f < c.fila + c.alto; f++) {
      for (let x = c.col; x < c.col + c.ancho; x++) {
        const k = `${f},${x}`;
        if (usadas.has(k)) return false;
        usadas.add(k);
      }
    }
  }
  return true;
}

describe("acomodarMosaico", () => {
  it("sin tamanos configurados reproduce la cuadricula de hoy: 4 por fila, 1x1", () => {
    const r = acomodarMosaico([1, 2, 3, 4, 5, 6].map((i) => cat(i)));
    expect(r.celdas.map((c) => [c.item.id, c.fila, c.col])).toEqual([
      [1, 0, 0], [2, 0, 1], [3, 0, 2], [4, 0, 3],
      [5, 1, 0], [6, 1, 1],
    ]);
    expect(r.filas).toBe(2);
  });

  it("una franja de 4 columnas ocupa su fila entera y las demas bajan", () => {
    const r = acomodarMosaico([cat(1, 4, 1), cat(2), cat(3), cat(4), cat(5)]);
    expect(r.celdas[0]).toMatchObject({ fila: 0, col: 0, ancho: 4, alto: 1 });
    expect(r.celdas.slice(1).map((c) => [c.item.id, c.fila, c.col])).toEqual([
      [2, 1, 0], [3, 1, 1], [4, 1, 2], [5, 1, 3],
    ]);
    expect(r.filas).toBe(2);
  });

  it("una tarjeta de 2x2 convive con pequenas a su lado, sin dejar hueco", () => {
    // Es el primer diseno que pidio el dueno: dos pequenas arriba, dos abajo, y
    // un bloque grande al lado ocupando las dos filas. Flexbox no lo puede.
    const r = acomodarMosaico([cat(1), cat(2), cat(3, 2, 2), cat(4), cat(5)]);
    const pos = Object.fromEntries(r.celdas.map((c) => [c.item.id, [c.fila, c.col]]));
    expect(pos[1]).toEqual([0, 0]);
    expect(pos[2]).toEqual([0, 1]);
    expect(pos[3]).toEqual([0, 2]);   // el grande, columnas 2-3, filas 0-1
    expect(pos[4]).toEqual([1, 0]);   // baja a la izquierda, debajo del 1
    expect(pos[5]).toEqual([1, 1]);
    expect(r.filas).toBe(2);
    expect(sinSolapes(r.celdas)).toBe(true);
  });

  it("una tarjeta que no cabe en lo que queda del renglon baja, y una chica rellena el hueco", () => {
    // 1 ocupa una columna; 2 mide 4 y no cabe al lado, asi que baja entera; 3
    // es chica y SI cabe en el hueco que dejo 2 en la primera fila.
    const r = acomodarMosaico([cat(1), cat(2, 4, 1), cat(3)]);
    const pos = Object.fromEntries(r.celdas.map((c) => [c.item.id, [c.fila, c.col]]));
    expect(pos[1]).toEqual([0, 0]);
    expect(pos[2]).toEqual([1, 0]);
    expect(pos[3]).toEqual([0, 1]);   // se adelanta: hueco lleno en vez de blanco
    expect(sinSolapes(r.celdas)).toBe(true);
  });

  it("nunca se sale de las 4 columnas, con cualquier mezcla", () => {
    const mezcla = [
      cat(1, 2, 2), cat(2, 3, 1), cat(3), cat(4, 4, 2), cat(5, 2, 1),
      cat(6), cat(7, 1, 2), cat(8, 2, 2), cat(9), cat(10, 3, 2),
    ];
    const r = acomodarMosaico(mezcla);
    expect(r.celdas).toHaveLength(mezcla.length);
    for (const c of r.celdas) {
      expect(c.col).toBeGreaterThanOrEqual(0);
      expect(c.col + c.ancho).toBeLessThanOrEqual(4);
    }
    expect(sinSolapes(r.celdas)).toBe(true);
  });

  it("valores imposibles no rompen la cuadricula: se encierran en el rango", () => {
    // El CHECK de la tabla ya los frena, pero el cliente no puede confiar en
    // eso: una fila vieja, un backend viejo o una respuesta de cache pueden
    // traer cualquier cosa, y un ancho de 9 empujaria la tarjeta fuera de la
    // pantalla sin que nada fallara.
    const r = acomodarMosaico([
      cat(1, 9, 9), cat(2, 0, 0), cat(3, -1, null),
      cat(4, undefined, undefined), cat(5, 2.7 as number, 1),
    ]);
    const por = Object.fromEntries(r.celdas.map((c) => [c.item.id, c]));
    expect(por[1]).toMatchObject({ ancho: 4, alto: 2 });
    expect(por[2]).toMatchObject({ ancho: 1, alto: 1 });
    expect(por[3]).toMatchObject({ ancho: 1, alto: 1 });
    expect(por[4]).toMatchObject({ ancho: 1, alto: 1 });
    expect(por[5]).toMatchObject({ ancho: 2, alto: 1 });
    expect(sinSolapes(r.celdas)).toBe(true);
  });

  it("lista vacia no inventa filas", () => {
    expect(acomodarMosaico([])).toEqual({ celdas: [], filas: 0 });
  });

  it("coloca todas las categorias, siempre", () => {
    // La garantia que de verdad importa: que ninguna se pierda. Una categoria
    // que no se pinta no da error, simplemente deja de vender.
    const muchas = Array.from({ length: 30 }, (_, i) =>
      cat(i + 1, ((i % 4) + 1), ((i % 2) + 1)),
    );
    const r = acomodarMosaico(muchas);
    expect(new Set(r.celdas.map((c) => c.item.id)).size).toBe(30);
    expect(sinSolapes(r.celdas)).toBe(true);
  });
});

describe("medidasCelda", () => {
  it("las 4 celdas mas sus separaciones suman el ancho util", () => {
    const { celda, tramo } = medidasCelda(390);
    expect(celda * 4 + 10 * 3).toBeCloseTo(390 - 32);
    expect(tramo(4)).toBeCloseTo(390 - 32);
  });

  it("una tarjeta de 2 celdas se traga la separacion de en medio", () => {
    const { celda, tramo } = medidasCelda(390);
    expect(tramo(2)).toBeCloseTo(celda * 2 + 10);
  });

  it("en una pantalla angosta la celda sigue siendo positiva", () => {
    expect(medidasCelda(320).celda).toBeGreaterThan(0);
  });
});
