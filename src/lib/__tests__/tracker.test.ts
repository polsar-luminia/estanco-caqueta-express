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
});
