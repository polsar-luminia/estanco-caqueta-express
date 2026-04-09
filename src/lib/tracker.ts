/**
 * Tracker de eventos — cola en memoria con flush periódico.
 * Uso: tracker.track('producto_visto', { producto_id: 1 }, 'product/[id]')
 */

import { getToken } from './api';
import { API_URL } from '../constants/config';

const API_BASE = API_URL;
const FLUSH_INTERVAL_MS = 30_000;
const MAX_QUEUE = 20;
const MAX_QUEUE_SIZE = 200;

interface EventoInput {
  tipo: string;
  payload?: Record<string, unknown>;
  pantalla?: string;
}

class Tracker {
  private queue: EventoInput[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.timer = setInterval(() => this.flush(), FLUSH_INTERVAL_MS);
  }

  track(tipo: string, payload?: Record<string, unknown>, pantalla?: string) {
    this.queue.push({ tipo, payload, pantalla });
    if (this.queue.length >= MAX_QUEUE) {
      this.flush();
    }
  }

  async flush() {
    if (this.queue.length === 0) return;
    const batch = this.queue.splice(0, this.queue.length);
    try {
      const token = await getToken();
      await fetch(`${API_BASE}/eventos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ eventos: batch }),
      });
    } catch {
      // Si falla, devolver los eventos a la cola para reintentar (con límite)
      if (this.queue.length < MAX_QUEUE_SIZE) {
        this.queue.unshift(...batch);
      }
    }
  }
}

export const tracker = new Tracker();
