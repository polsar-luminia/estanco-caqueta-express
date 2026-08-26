import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock api.getToken — el tracker lo llama en flush().
vi.mock('../api', () => ({
  getToken: vi.fn().mockResolvedValue(null),
}));

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
});

import * as Sentry from '@sentry/react-native';
import { tracker } from '../tracker';

describe('tracker — allowlist M-OBS-21', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Vaciar la cola entre tests; queue es privada, accedemos vía any.
    (tracker as any).queue = [];
  });

  it('evento conocido: solo pasa keys de la allowlist', async () => {
    tracker.track(
      'producto_visto',
      // keys legítimas + PII que no debe filtrarse
      { producto_id: 1, nombre: 'Aguila', categoria: 'cervezas', email_cliente: 'leak@x.com', telefono: '300' },
      'product/[id]',
    );
    await tracker.flush();
    const fetchMock = vi.mocked(fetch);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.eventos[0].payload).toEqual({ producto_id: 1, nombre: 'Aguila', categoria: 'cervezas' });
    expect(body.eventos[0].payload).not.toHaveProperty('email_cliente');
    expect(body.eventos[0].payload).not.toHaveProperty('telefono');
  });

  it('evento sin payload permitido: pasa sin payload (app_abierta allowlist vacía)', async () => {
    tracker.track('app_abierta');
    await tracker.flush();
    const body = JSON.parse((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string);
    expect(body.eventos[0].payload).toBeUndefined();
  });

  it('evento desconocido: se descarta y emite breadcrumb', async () => {
    // Cast explícito — simula código futuro que pase un tipo no registrado.
    tracker.track('evento_inventado' as any, { foo: 'bar' });
    await tracker.flush();
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
    expect(vi.mocked(Sentry.addBreadcrumb)).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'tracker',
        level: 'warning',
        data: expect.objectContaining({ tipo: 'evento_inventado' }),
      }),
    );
  });

  it('payload sin keys válidas: payload queda undefined', async () => {
    tracker.track('cupon_copiado', { extranjera: 1, otra: 2 } as any);
    await tracker.flush();
    const body = JSON.parse((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string);
    expect(body.eventos[0].payload).toBeUndefined();
  });

  it('registro_completado: conserva solo el origen tipado y telefono_verificado', async () => {
    tracker.track('registro_completado', {
      telefono_verificado: true,
      origen: 'checkout',
      telefono: '3001234567',
    } as any, 'register');
    await tracker.flush();
    const body = JSON.parse((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string);
    expect(body.eventos[0].payload).toEqual({
      telefono_verificado: true,
      origen: 'checkout',
    });
  });

  it.each([
    undefined,
    { telefono_verificado: true },
    { telefono_verificado: 'si', origen: 'checkout' },
    { telefono_verificado: true, origen: 'campana_inventada' },
  ])('registro_completado: descarta payload invalido %#', async (payload) => {
    tracker.track('registro_completado', payload as any, 'register');
    await tracker.flush();
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
    expect(vi.mocked(Sentry.addBreadcrumb)).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'tracker',
        level: 'warning',
        data: { tipo: 'registro_completado' },
      }),
    );
  });

  it('busqueda: incluye `q` y `resultados` (M-OBS-22 — término es dato de comportamiento, no PII)', async () => {
    tracker.track('busqueda', { q: 'whisky', resultados: 5 } as any, 'search');
    await tracker.flush();
    const body = JSON.parse((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string);
    expect(body.eventos[0].payload).toEqual({ q: 'whisky', resultados: 5 });
  });

  it('busqueda_sin_resultado: incluye `q` (M-OBS-22 — qué buscan y no encuentran)', async () => {
    tracker.track('busqueda_sin_resultado', { q: 'xyzabc' } as any, 'search');
    await tracker.flush();
    const body = JSON.parse((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string);
    expect(body.eventos[0].payload).toEqual({ q: 'xyzabc' });
  });

  it('cupon_aplicado: filtra `cupon_codigo` aunque venga en payload (M-OBS-21 cierre)', async () => {
    tracker.track('cupon_aplicado', { cupon_codigo: 'PROMO10', descuento: 1000 } as any);
    await tracker.flush();
    const body = JSON.parse((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string);
    expect(body.eventos[0].payload).toEqual({ descuento: 1000 });
    expect(body.eventos[0].payload).not.toHaveProperty('cupon_codigo');
  });
});

describe('tracker — release 1.2.0 (A.1 y A.3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (tracker as any).queue = [];
  });

  it('fuera_de_zona: las coordenadas salen redondeadas a 3 decimales', async () => {
    // ~100 m: alcanza para mapear donde abrir cobertura, no alcanza para señalar
    // una casa. El redondeo vive en el tracker justamente para que no dependa de
    // que cada llamador se acuerde.
    tracker.track('fuera_de_zona', { lat: 1.6144567, lng: -75.6062891 }, 'ubicacion');
    await tracker.flush();
    const body = JSON.parse((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string);
    expect(body.eventos[0].payload).toEqual({ lat: 1.614, lng: -75.606 });
  });

  it('manda la version del binario en el header X-App-Version', async () => {
    tracker.track('app_abierta');
    await tracker.flush();
    const headers = (vi.mocked(fetch).mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers['X-App-Version']).toBe('1.2.0-test');
  });

  it('checkout_abandonado: conserva el paso, que es el dato util', async () => {
    tracker.track('checkout_abandonado', { paso: 'sin_ubicacion', items_count: 3 }, 'cart');
    await tracker.flush();
    const body = JSON.parse((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string);
    expect(body.eventos[0].payload).toEqual({ paso: 'sin_ubicacion', items_count: 3 });
  });

  it('pantalla_vista: la ruta viaja en `pantalla`, no en el payload', async () => {
    tracker.track('pantalla_vista', undefined, 'product/[id]');
    await tracker.flush();
    const body = JSON.parse((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string);
    expect(body.eventos[0].pantalla).toBe('product/[id]');
    expect(body.eventos[0].payload).toBeUndefined();
  });

  it('medio_pago_elegido (093): solo `medio` y `cambio`, nunca el monto del vuelto', async () => {
    tracker.track('medio_pago_elegido', { medio: 'efectivo', cambio: false, paga_con: 100000 } as any, 'cart');
    await tracker.flush();
    const body = JSON.parse((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string);
    expect(body.eventos[0].payload).toEqual({ medio: 'efectivo', cambio: false });
    expect(body.eventos[0].payload).not.toHaveProperty('paga_con');
  });

  it('pedido_creado (093): admite medio_pago y pide_vuelto', async () => {
    tracker.track('pedido_creado', { pedido_id: 1, total: 30000, items_count: 2, uso_cupon: false, uso_puntos: false, medio_pago: 'datafono', pide_vuelto: false } as any);
    await tracker.flush();
    const body = JSON.parse((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string);
    expect(body.eventos[0].payload).toEqual({ pedido_id: 1, total: 30000, items_count: 2, uso_cupon: false, uso_puntos: false, medio_pago: 'datafono', pide_vuelto: false });
  });

  it('carrito_abandonado (build 94): admite envio/total/envio_gratis/tiene_pin/frio', async () => {
    tracker.track('carrito_abandonado', {
      items_count: 2, subtotal: 12000, tiene_direccion: true, supera_minimo: false,
      tienda_abierta: true, vio_formulario: false, envio: 5000, total: 17000,
      envio_gratis: false, tiene_pin: false, frio: true,
    } as any, 'cart');
    await tracker.flush();
    const body = JSON.parse((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string);
    expect(body.eventos[0].payload).toEqual({
      items_count: 2, subtotal: 12000, tiene_direccion: true, supera_minimo: false,
      tienda_abierta: true, vio_formulario: false, envio: 5000, total: 17000,
      envio_gratis: false, tiene_pin: false, frio: true,
    });
  });
});

describe('tracker — hora del hecho (094)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (tracker as any).queue = [];
  });

  it('cada evento encolado lleva `t` (reloj del telefono al encolar)', async () => {
    const antes = Date.now();
    tracker.track('app_abierta');
    const despues = Date.now();
    const encolado = (tracker as any).queue[0];
    expect(typeof encolado.t).toBe('number');
    expect(encolado.t).toBeGreaterThanOrEqual(antes);
    expect(encolado.t).toBeLessThanOrEqual(despues);
  });

  it('el body del batch lleva `t_envio`, un solo valor para todo el lote', async () => {
    tracker.track('app_abierta');
    tracker.track('categoria_abierta', { categoria_id: 1, nombre: 'Ron' });
    await tracker.flush();
    const body = JSON.parse((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string);
    expect(typeof body.t_envio).toBe('number');
    expect(body.eventos).toHaveLength(2);
    expect(typeof body.eventos[0].t).toBe('number');
    expect(typeof body.eventos[1].t).toBe('number');
  });

  it('un reintento recalcula t_envio: no reusa el de la primera vez', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('red caida'));
    tracker.track('app_abierta');
    await tracker.flush(); // falla, se reencola
    expect((tracker as any).queue).toHaveLength(1);

    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 }));
    await new Promise((r) => setTimeout(r, 5));
    await tracker.flush(); // reintento
    const body = JSON.parse((vi.mocked(fetch).mock.calls[1][1] as RequestInit).body as string);
    expect(body.eventos).toHaveLength(1);
    expect(body.t_envio).toBeGreaterThan(body.eventos[0].t);
  });
});

describe('tracker — corte de 50 por lote (094, espejo del corte del backend)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (tracker as any).queue = [];
  });

  it('con mas de 50 encolados, un flush manda 50 y deja el resto en la cola', async () => {
    for (let i = 0; i < 55; i++) tracker.track('app_abierta');
    // track() dispara flush automatico al llegar a MAX_QUEUE (20); forzamos un
    // estado de cola grande directamente para probar el corte de flush() en
    // aislamiento, sin depender de cuantos flushes automaticos ya corrieron.
    (tracker as any).queue = Array.from({ length: 55 }, () => ({ tipo: 'app_abierta', t: Date.now() }));
    await tracker.flush();
    const body = JSON.parse((vi.mocked(fetch).mock.calls.at(-1)![1] as RequestInit).body as string);
    expect(body.eventos).toHaveLength(50);
    expect((tracker as any).queue).toHaveLength(5);
  });
});
