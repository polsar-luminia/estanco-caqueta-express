import { describe, it, expect } from 'vitest';
import { calcularResumen, envioDeZona } from '../resumenPedido';

const BASE = {
  subtotal: 50000,
  envioCosto: 5000,
};

describe('calcularResumen', () => {
  it('cobra el envio cuando no hay nada que lo exima', () => {
    expect(calcularResumen(BASE)).toMatchObject({ envio: 5000, total: 55000, motivoEnvioGratis: null });
  });

  it('resta el descuento del cupon antes del envio', () => {
    const r = calcularResumen({ ...BASE, descuentoCupon: 10000 });
    expect(r.descuento).toBe(10000);
    expect(r.total).toBe(45000);
  });

  it('regala el envio con puntos cuando todavia se cobraba', () => {
    const r = calcularResumen({ ...BASE, usaPuntos: true });
    expect(r).toMatchObject({ envio: 0, motivoEnvioGratis: 'puntos' });
  });

  it('un subtotal enorme NO regala el envio', () => {
    // Espejo de la prueba adversaria del servidor. El envio gratis por monto se
    // acabo el 12-sep-2026 y esta es la que impide que vuelva sin que nadie lo
    // note: si alguien reintroduce un `gratisPorMonto` al rediseniar el checkout,
    // aca revienta antes de que un cliente vea "Gratis!" y le cobren $5.000.
    const r = calcularResumen({ ...BASE, subtotal: 999_999_999 });
    expect(r).toMatchObject({ envio: 5000, motivoEnvioGratis: null });
  });

  it('el cupon de envio gratis manda sobre los puntos', () => {
    const r = calcularResumen({ ...BASE, cuponEnvioGratis: true, usaPuntos: true });
    expect(r).toMatchObject({ envio: 0, motivoEnvioGratis: 'cupon' });
  });

  it('usa la tarifa de la zona cuando se le pasa', () => {
    const r = calcularResumen({ ...BASE, envioCosto: 8000 });
    expect(r).toMatchObject({ envio: 8000, total: 58000 });
  });
});

describe('calcularResumen — frío asegurado', () => {
  it('suma el cargo al total cuando está activo', () => {
    const r = calcularResumen({ ...BASE, frio: true, frioCosto: 1000 });
    expect(r).toMatchObject({ frio: 1000, total: 56000 });
  });

  it('sin frío el cargo es cero y el total no cambia', () => {
    expect(calcularResumen(BASE)).toMatchObject({ frio: 0, total: 55000 });
    expect(calcularResumen({ ...BASE, frio: false, frioCosto: 1000 }).frio).toBe(0);
  });

  it('el frío NO acerca al envío gratis: no entra al subtotal', () => {
    // Subtotal a $1.000 del mínimo. Aunque el frío sume $1.000 al total, el envío
    // se sigue cobrando: el umbral se mide contra la mercancía, no contra el total.
    const r = calcularResumen({
      ...BASE, subtotal: 149000, frio: true, frioCosto: 1000,
    });
    expect(r.motivoEnvioGratis).toBeNull();
    expect(r.envio).toBe(5000);
    expect(r.total).toBe(149000 + 5000 + 1000);
  });

  it('el descuento del cupón no muerde el frío', () => {
    // Los cupones aplican sobre mercancía. Un cupón que se comiera el frío
    // regalaría el servicio.
    const r = calcularResumen({ ...BASE, descuentoCupon: 10000, frio: true, frioCosto: 1000 });
    expect(r.total).toBe(50000 - 10000 + 5000 + 1000);
  });

  it('el envío gratis no cubre el frío', () => {
    // Conseguía el envío gratis con subtotal 150000, por el umbral por monto que
    // se acabó el 12-sep-2026. La regla que prueba —el frío se cobra igual— no
    // cambió: se llega por el camino que sí queda.
    const r = calcularResumen({ ...BASE, cuponEnvioGratis: true, frio: true, frioCosto: 1000 });
    expect(r).toMatchObject({ envio: 0, frio: 1000, total: 51000 });
  });

  it('el precio del frío sale de la configuración, no de un valor fijo', () => {
    expect(calcularResumen({ ...BASE, frio: true, frioCosto: 1500 }).frio).toBe(1500);
  });
});

describe('envioDeZona', () => {
  it('null significa usar el global, no envio gratis', () => {
    expect(envioDeZona(null, 5000)).toBe(5000);
    expect(envioDeZona(undefined, 5000)).toBe(5000);
  });

  it('la tarifa de la zona gana sobre el global', () => {
    expect(envioDeZona(8000, 5000)).toBe(8000);
  });

  it('una zona con tarifa cero si es envio gratis', () => {
    expect(envioDeZona(0, 5000)).toBe(0);
  });
});
