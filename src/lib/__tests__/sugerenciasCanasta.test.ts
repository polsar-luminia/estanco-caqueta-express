import { describe, it, expect } from 'vitest';
import { elegirSemilla, filtrarSugerenciasCanasta } from '../sugerenciasCanasta';
import type { Producto } from '../api';

function producto(over: Partial<Producto> & { id: number }): Producto {
  return {
    nombre: `Producto ${over.id}`,
    precio_app: 10000,
    categoria: 'Ron',
    stock_total: 10,
    ...over,
  } as Producto;
}

describe('elegirSemilla', () => {
  it('elige el item de mayor precio UNITARIO, no de mayor total de linea', () => {
    const items = [
      { productoId: 1, precioUnitario: 3000, cantidad: 12 }, // gaseosas: total 36000
      { productoId: 2, precioUnitario: 45000, cantidad: 1 }, // ron: total 45000
    ];
    expect(elegirSemilla(items)).toBe(2);
  });

  it('en empate, gana el primero insertado', () => {
    const items = [
      { productoId: 5, precioUnitario: 20000, cantidad: 1 },
      { productoId: 9, precioUnitario: 20000, cantidad: 1 },
    ];
    expect(elegirSemilla(items)).toBe(5);
  });

  it('carrito vacio: null', () => {
    expect(elegirSemilla([])).toBeNull();
  });
});

describe('filtrarSugerenciasCanasta', () => {
  it('quita lo que ya esta en el carrito', () => {
    const r = filtrarSugerenciasCanasta(
      [producto({ id: 1 }), producto({ id: 2 }), producto({ id: 3 })],
      new Set([2]),
    );
    expect(r.map((p) => p.id)).toEqual([1, 3]);
  });

  it('quita productos sin stock', () => {
    const r = filtrarSugerenciasCanasta(
      [producto({ id: 1, stock_total: 0 }), producto({ id: 2 }), producto({ id: 3 })],
      new Set(),
    );
    expect(r.map((p) => p.id)).toEqual([2, 3]);
  });

  it('recorta a 8', () => {
    const raw = Array.from({ length: 12 }, (_, i) => producto({ id: i + 1 }));
    const r = filtrarSugerenciasCanasta(raw, new Set());
    expect(r).toHaveLength(8);
  });

  it('con menos de 2 tras filtrar, devuelve vacio (la seccion no se dibuja)', () => {
    const r = filtrarSugerenciasCanasta(
      [producto({ id: 1 }), producto({ id: 2, stock_total: 0 })],
      new Set(),
    );
    expect(r).toEqual([]);
  });

  it('exactamente 2 tras filtrar: se muestran', () => {
    const r = filtrarSugerenciasCanasta(
      [producto({ id: 1 }), producto({ id: 2 })],
      new Set(),
    );
    expect(r).toHaveLength(2);
  });

  it('filtra tabaco/vape antes que nada (Apple 1.4.3) — el mock de Platform.OS es "ios"', () => {
    const r = filtrarSugerenciasCanasta(
      [producto({ id: 1, categoria: 'Vapes' }), producto({ id: 2 }), producto({ id: 3 })],
      new Set(),
    );
    expect(r.map((p) => p.id)).toEqual([2, 3]);
  });

  it('entrada no-array no truena', () => {
    expect(filtrarSugerenciasCanasta(null as unknown as Producto[], new Set())).toEqual([]);
  });
});
