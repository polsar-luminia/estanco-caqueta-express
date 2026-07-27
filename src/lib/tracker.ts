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
import { obtenerDeviceId } from './deviceId';
import { APP_VERSION } from './appVersion';
import { API_URL } from '../constants/config';

const API_BASE = API_URL;
const FLUSH_INTERVAL_MS = 30_000;
const MAX_QUEUE = 20;
const MAX_QUEUE_SIZE = 200;

// APP_VERSION (A.1) viaja como header del batch, no dentro de cada evento: es la
// misma para todo el lote y repetirla por fila serían bytes de más en planes de
// datos limitados. Definición y origen en ./appVersion.

// Cero PII (M-OBS-21): las coordenadas se redondean a 3 decimales (~100 m) antes de
// salir del teléfono. Alcanza para mapear dónde abrir cobertura y no alcanza para
// señalar una casa. Se aplica en el tracker y no en cada llamador a propósito:
// olvidarlo en un solo sitio sería una fuga.
const DECIMALES_COORDENADA = 3;
const KEYS_COORDENADA = new Set(['lat', 'lng']);

function redondearCoordenada(v: unknown): unknown {
  if (typeof v !== 'number' || !Number.isFinite(v)) return v;
  const f = 10 ** DECIMALES_COORDENADA;
  return Math.round(v * f) / f;
}

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
  | 'interstitial_completado'
  // A.2 (release 1.2.0) — cierre de los huecos del embudo.
  | 'pantalla_vista'
  | 'checkout_iniciado'
  | 'checkout_abandonado'
  | 'ubicacion_permiso_pedido'
  | 'ubicacion_permiso_concedido'
  | 'ubicacion_permiso_negado'
  | 'ubicacion_pin_movido'
  | 'ubicacion_pin_confirmado'
  | 'fuera_de_zona'
  | 'direccion_creada'
  | 'direccion_seleccionada'
  | 'login_iniciado'
  | 'login_fallido'
  | 'producto_agotado_visto'
  // H — frío asegurado
  | 'frio_ofrecido'
  | 'frio_activado'
  | 'frio_desactivado'
  | 'frio_recordatorio_visto'
  | 'frio_recordatorio_aceptado'
  | 'frio_recordatorio_rechazado'
  | 'frio_recordatorio_cerrado'
  // C — reseñas
  | 'resena_enviada'
  | 'resena_banner_visto'
  | 'resena_banner_descartado'
  // D — motor de ETA
  | 'eta_mostrado'
  // F — ubicación obligatoria
  | 'ubicacion_pin_manual_elegido';

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

  // --- A.2 (release 1.2.0) ---
  // La ruta viaja en el campo `pantalla`, que ya existe: no hace falta duplicarla
  // en el payload. ¿Qué pantallas se usan y cuáles no?
  pantalla_vista: [],
  // ¿Dónde exactamente se cae el pedido? `paso` es el punto del checkout.
  checkout_iniciado: ['items_count', 'subtotal'],
  checkout_abandonado: ['paso', 'items_count'],
  // Crítico para el bloque F: cuánta gente niega el GPS. Sin este número, exigir
  // ubicación sería apostar el checkout a ciegas.
  ubicacion_permiso_pedido: [],
  ubicacion_permiso_concedido: [],
  ubicacion_permiso_negado: [],
  // ¿Usan el mapa o se rinden? `_movido` se emite UNA vez por visita, no por
  // arrastre: los gestos continuos inflan la cola y gastan batería y datos.
  ubicacion_pin_movido: [],
  ubicacion_pin_confirmado: ['dentro_zona'],
  // Dónde abrir cobertura. Las coordenadas salen redondeadas a 3 decimales.
  fuera_de_zona: ['lat', 'lng'],
  direccion_creada: ['con_pin'],
  direccion_seleccionada: ['direccion_id', 'con_pin'],
  login_iniciado: ['origen'],
  login_fallido: ['motivo'],
  // Demanda insatisfecha por producto.
  producto_agotado_visto: ['producto_id', 'nombre'],

  // --- H (frío asegurado) ---
  // ¿A cuántos carritos les aparece siquiera la opción? Es el denominador de la
  // tasa de toma: sin él, "20 personas pagaron frío" no dice nada.
  frio_ofrecido: ['n_elegibles', 'n_items'],
  // Tasa de toma real: ¿el cliente sí paga $1.000 por frío?
  frio_activado: ['n_elegibles'],
  frio_desactivado: ['n_elegibles'],
  // La tarjeta previa a "Realizar pedido".
  frio_recordatorio_visto: ['n_elegibles'],
  // La pregunta del millón: ¿el recordatorio rescata ventas o espanta pedidos?
  // Se lee cruzado contra checkout_abandonado, nunca solo.
  frio_recordatorio_aceptado: ['n_elegibles'],
  frio_recordatorio_rechazado: ['n_elegibles'],
  // Cerro sin decidir (toco fuera o el boton atras). Separado de 'rechazado'
  // porque no es lo mismo: rechazar es una respuesta, cerrar es irse. Si esto
  // se dispara mucho, la tarjeta no se esta entendiendo como pregunta.
  frio_recordatorio_cerrado: ['n_elegibles'],

  // --- C (reseñas) ---
  // Satisfacción medible por primera vez. Solo las estrellas: el comentario es
  // texto libre del cliente y no tiene por qué salir del teléfono en un evento.
  resena_enviada: ['estrellas'],
  // El banner de Inicio se mide aparte del formulario del detalle, para saber
  // cuántas calificaciones rescata de verdad y si vale la pena tenerlo ahí.
  resena_banner_visto: [],
  resena_banner_descartado: [],

  // --- D (motor de ETA) ---
  // Base del reporte de cumplimiento visto desde el cliente: qué rango se le
  // enseñó y dónde. Sin esto solo se sabe qué se guardó, no qué llegó a ver.
  eta_mostrado: ['min', 'max'],

  // --- F (ubicación obligatoria) ---
  // Cuánta gente prefiere poner el punto a mano antes que dar GPS. Junto con
  // ubicacion_permiso_negado es lo que dice si exigir la ubicación es viable o
  // va a costar pedidos: si casi nadie elige el mapa y muchos niegan el permiso,
  // la bandera no se prende.
  ubicacion_pin_manual_elegido: [],
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
    if (!(key in payload)) continue;
    filtered[key] = KEYS_COORDENADA.has(key)
      ? redondearCoordenada(payload[key])
      : payload[key];
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
      const [token, deviceId] = await Promise.all([getToken(), obtenerDeviceId()]);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5_000);
      try {
        await fetch(`${API_BASE}/eventos`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            // Sin sesion el backend rechazaba el batch con 401 y se perdia todo el
            // uso previo al registro. Con este header lo acepta como anonimo.
            'X-Device-Id': deviceId,
            ...(APP_VERSION ? { 'X-App-Version': APP_VERSION } : {}),
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
