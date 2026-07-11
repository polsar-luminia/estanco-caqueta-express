/**
 * Tracker de eventos — cola en memoria con flush periódico.
 * Uso: tracker.track('producto_visto', { producto_id: 1 }, 'product/[id]')
 *
 * El interval se pausa cuando la app va a background para no consumir
 * batería ni red innecesariamente (AppState listener).
 *
 * M-OBS-21: allowlist por tipo de evento (default-deny). Keys no listadas
 * en ALLOWED_KEYS[tipo] se omiten silenciosamente. Tipos no registrados
 * descartan el evento entero y emiten Sentry breadcrumb.
 */

import { AppState, AppStateStatus } from 'react-native';
import * as Sentry from '@sentry/react-native';
import { getToken } from './api';
import { API_URL } from '../constants/config';

const API_BASE = API_URL;
const FLUSH_INTERVAL_MS = 30_000;
const MAX_QUEUE = 20;
const MAX_QUEUE_SIZE = 200;

export type EventTipo =
  | 'app_error'
  | 'app_abierta'
  | 'categoria_abierta'
  | 'registro_completado'
  | 'sesion_iniciada'
  | 'cupon_copiado'
  | 'producto_visto'
  | 'tiempo_en_producto'
  | 'sugerencia_clickeada'
  | 'cupon_aplicado'
  | 'pedido_creado'
  | 'busqueda_sin_resultado'
  | 'busqueda'
  | 'pedido_reordenado'
  | 'pedido_cancelado'
  | 'carrito_agregado'
  | 'carrito_eliminado'
  | 'carrito_cantidad_cambiada'
  | 'interstitial_mostrado'
  | 'interstitial_completado';

// Allowlist por evento — toda key fuera de esta lista se omite del payload
// enviado al backend. Añadir un evento nuevo requiere registrarlo aquí
// (TypeScript lo fuerza vía Record<EventTipo, ...>).
const ALLOWED_KEYS: Record<EventTipo, readonly string[]> = {
  app_error: ['message', 'stack'],
  app_abierta: [],
  categoria_abierta: ['categoria_id', 'nombre'],
  registro_completado: [],
  sesion_iniciada: [],
  cupon_copiado: [],
  producto_visto: ['producto_id', 'nombre', 'categoria'],
  tiempo_en_producto: ['producto_id', 'segundos'],
  sugerencia_clickeada: ['desde_producto', 'producto_clickeado', 'nombre'],
  cupon_aplicado: ['descuento'],
  pedido_creado: ['pedido_id', 'total', 'items_count', 'uso_cupon', 'uso_puntos'],
  // 'q': término buscado — dato de comportamiento (qué buscan y no encuentran),
  // no PII. Clave para decisiones de surtido y campañas (M-OBS-22).
  busqueda_sin_resultado: ['q'],
  busqueda: ['q', 'resultados'],
  pedido_reordenado: ['pedido_id', 'omitidos', 'omitidos_catalogo', 'omitidos_stock'],
  pedido_cancelado: ['pedido_id'],
  carrito_agregado: ['producto_id', 'nombre', 'precio', 'cantidad'],
  carrito_eliminado: ['producto_id'],
  carrito_cantidad_cambiada: ['producto_id', 'cantidad_nueva'],
  interstitial_mostrado: ['interstitial_id'],
  interstitial_completado: ['interstitial_id'],
};

function aplicarAllowlist(
  tipo: EventTipo,
  payload?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (!payload) return undefined;
  const allowed = ALLOWED_KEYS[tipo];
  if (allowed.length === 0) return undefined;
  const filtered: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in payload) filtered[key] = payload[key];
  }
  return Object.keys(filtered).length > 0 ? filtered : undefined;
}

interface EventoInput {
  tipo: EventTipo;
  payload?: Record<string, unknown>;
  pantalla?: string;
}

class Tracker {
  private queue: EventoInput[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.startTimer();
    AppState.addEventListener('change', this.handleAppStateChange);
  }

  private handleAppStateChange = (nextState: AppStateStatus) => {
    if (nextState === 'active') {
      this.startTimer();
      // Flush inmediato al volver al frente — procesa eventos acumulados
      this.flush();
    } else {
      // Background: flush lo que tengamos antes de pausar el timer.
      // Si el SO mata el proceso, los eventos ya están en vuelo (AbortController 5s los acota).
      this.flush();
      this.stopTimer();
    }
  };

  private startTimer() {
    if (this.timer !== null) return;
    this.timer = setInterval(() => this.flush(), FLUSH_INTERVAL_MS);
  }

  private stopTimer() {
    if (this.timer === null) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  track(tipo: EventTipo, payload?: Record<string, unknown>, pantalla?: string) {
    // Defensa runtime: si alguien hace cast (tipo as EventTipo) con un
    // string que no está en ALLOWED_KEYS, descartar y reportar.
    if (!(tipo in ALLOWED_KEYS)) {
      Sentry.addBreadcrumb({
        category: 'tracker',
        level: 'warning',
        message: 'evento desconocido descartado',
        data: { tipo },
      });
      return;
    }
    this.queue.push({ tipo, payload: aplicarAllowlist(tipo, payload), pantalla });
    if (this.queue.length >= MAX_QUEUE) {
      this.flush();
    }
  }

  async flush() {
    if (this.queue.length === 0) return;
    const batch = this.queue.splice(0, this.queue.length);
    let body: string;
    try {
      body = JSON.stringify({ eventos: batch });
    } catch (err) {
      console.warn('[tracker] payload no serializable, descartando batch');
      Sentry.captureException(err instanceof Error ? err : new Error('tracker_payload_no_serializable'), {
        tags: { source: 'tracker' },
        extra: { batchSize: batch.length, tipos: batch.map((e) => e.tipo) },
      });
      return;
    }
    try {
      const token = await getToken();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5_000);
      try {
        await fetch(`${API_BASE}/eventos`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body,
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }
    } catch {
      // Si falla, devolver los eventos a la cola para reintentar (con límite)
      if (this.queue.length < MAX_QUEUE_SIZE) {
        this.queue.unshift(...batch);
      }
    }
  }
}

export const tracker = new Tracker();
