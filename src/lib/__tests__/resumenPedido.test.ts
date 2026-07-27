import { describe, it, expect } from 'vitest';
import { calcularResumen, envioDeZona } from '../resumenPedido';

const BASE = {
  subtotal: 50000,
  envioCosto: 5000,
  envioGratisMinimo: 150000,
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

  it('regala el envio al pasar el minimo por monto', () => {
    const r = calcularResumen({ ...BASE, subtotal: 150000 });
    expect(r).toMatchObject({ envio: 0, total: 150000, motivoEnvioGratis: 'monto' });
  });

  it('regala el envio con puntos cuando todavia se cobraba', () => {
    const r = calcularResumen({ ...BASE, usaPuntos: true });
    expect(r).toMatchObject({ envio: 0, motivoEnvioGratis: 'puntos' });
  });

  it('si el envio ya era gratis por monto, el motivo no son los puntos', () => {
    // Importa para la UI: decirle "usaste tus puntos" a alguien a quien el servidor
    // no se los va a descontar seria mentirle.
    const r = calcularResumen({ ...BASE, subtotal: 200000, usaPuntos: true });
    expect(r.motivoEnvioGratis).toBe('monto');
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
