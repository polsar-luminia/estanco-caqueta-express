/**
 * Tracker de eventos — cola en memoria con flush periódico.
 * Uso: tracker.track('producto_visto', { producto_id: 1 }, 'product/[id]')
 *
 * El interval se pausa cuando la app va a background para no consumir
 * batería ni red innecesariamente (AppState listener).
 */

import { AppState, AppStateStatus } from 'react-native';
import * as Sentry from '@sentry/react-native';
import { getToken } from './api';
import { API_URL } from '../constants/config';

const API_BASE = API_URL;
const FLUSH_INTERVAL_MS = 30_000;
const MAX_QUEUE = 20;
const MAX_QUEUE_SIZE = 200;

const SENSITIVE_KEYS = /token|password|telefono|phone|secret|auth/i;
function sanitizarPayload(payload?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!payload) return undefined;
  return Object.fromEntries(
    Object.entries(payload)
      .filter(([key]) => !SENSITIVE_KEYS.test(key))
      .map(([key, val]) => [
        key,
        val !== null && typeof val === 'object' && !Array.isArray(val)
          ? sanitizarPayload(val as Record<string, unknown>)
          : val,
      ])
  );
}

interface EventoInput {
  tipo: string;
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

  track(tipo: string, payload?: Record<string, unknown>, pantalla?: string) {
    this.queue.push({ tipo, payload: sanitizarPayload(payload), pantalla });
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
        tags: { source: "tracker" },
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
