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
import { baseUrlActual } from './backendPruebas';
import { esOrigenRegistro } from './registroOrigen';

// La telemetria sigue al backend activo: en modo pruebas los eventos caen en la
// base de staging y no ensucian los embudos reales.
const API_BASE = () => baseUrlActual();
const FLUSH_INTERVAL_MS = 30_000;
const MAX_QUEUE = 20;
const MAX_QUEUE_SIZE = 200;
// El backend corta cada POST en 50 filas (eventos.js). Sin este limite del
// lado del cliente, un reencolado tras varios fallos de red puede juntar
// hasta MAX_QUEUE_SIZE eventos y mandarlos en un solo POST: el backend
// guardaria 50 y los otros se perderian en silencio (responde 204 igual).
// Cortando aqui, el resto se queda en la cola para el siguiente flush.
const MAX_BATCH_ENVIO = 50;

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
  | 'consentimiento_mercadeo_cambiado'
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
  | 'direccion_inicial_vista'
  | 'direccion_inicial_guardada'
  | 'direccion_inicial_saltada'
  // C — reseñas
  | 'resena_enviada'
  | 'resena_banner_visto'
  | 'resena_banner_descartado'
  // D — motor de ETA
  | 'eta_mostrado'
  // F — ubicación obligatoria
  | 'ubicacion_pin_manual_elegido'
  // Chat con el domiciliario (bloque 5 de la app de operaciones)
  | 'chat_abierto'
  | 'chat_mensaje_enviado'
  // Código de entrega de 4 dígitos (097). El código en sí NUNCA va en el
  // payload -- ver ALLOWED_KEYS mas abajo.
  | 'codigo_entrega_visto'
  | 'codigo_entrega_ayuda'
  // Fase 0 push (2026-08-05) — opt-in del permiso de notificaciones
  | 'push_permiso_pedido'
  | 'push_permiso_concedido'
  | 'push_permiso_negado'
  // OTP del registro (2026-08-16) — embudo: muro → solicitado → verificado →
  // registro_completado. El muro es el invitado con carrito rebotado al registro.
  | 'registro_muro_mostrado'
  | 'registro_codigo_solicitado'
  | 'registro_codigo_reenviado'
  | 'registro_codigo_verificado'
  | 'registro_codigo_fallido'
  | 'registro_completado'
  // Rediseno del catalogo (1.3.0). La pantalla de inicio no tenia NI UN evento
  // propio: no se medía impresion ni clic de hero, combo, destacado, banner de
  // ofertas ni tira de categorias. Lo unico era pantalla_vista.
  | 'categoria_grande_abierta'
  | 'subcategoria_abierta'
  | 'carril_mostrar_mas'
  // Fuga de direccion (1.3.1). `checkout_abandonado` solo se dispara DENTRO de
  // handlePedir, o sea que solo mide al que llego a tocar "Pedir". De 277 que
  // agregan al carrito, 101 lo tocan: de los otros 176 no sabiamos nada.
  | 'carrito_abandonado'
  // Medio de pago en el checkout (093). Que medio prefiere la gente, y cuanta
  // friccion quita tener el default preseleccionado.
  | 'medio_pago_elegido'
  // Checkout denso (1.3.2/build 94).
  | 'carrito_items_desplegados'
  | 'direccion_hoja_abierta'
  | 'medio_pago_hoja_abierta'
  | 'entrega_sin_pin_mostrado'
  // Direcciones 1.3.2: una sola salida sin pin (fuera de zona), edicion de
  // direccion guardada, y el complemento de ubicacion_pin_confirmado.
  | 'direccion_sin_pin_guardada'
  | 'ubicacion_cancelada'
  | 'direccion_editada'
  | 'direccion_eliminada'
  // Pago con tarjeta guardada (Wompi, fase 2 — PLAN-UI-PAGO-TARJETA-PRUEBAS.md
  // "Telemetría"). Los 12 tipos entran en el mismo commit aunque esta fase
  // solo DISPARA los 7 de "Mis tarjetas"/"Alta" (tarjeta_*/metodos_pago_vacio_visto):
  // los 5 de pago_* (checkout, fase 3) quedan registrados y sin uso para no
  // tener que volver a tocar TIPOS_VALIDOS del backend cuando se implementen.
  // Registrados en el backend desde la 100 (eventos.js TIPOS_VALIDOS) aunque
  // `pago_tarjeta_activo` siga apagada.
  | 'tarjeta_guardado_iniciado'
  | 'tarjeta_contratos_abiertos'
  | 'tarjeta_3ds_challenge_mostrado'
  | 'tarjeta_guardada'
  | 'tarjeta_guardado_fallido'
  | 'tarjeta_eliminada'
  | 'pago_iniciado'
  | 'pago_aprobado'
  | 'pago_rechazado'
  | 'pago_abandonado'
  | 'pago_cambiado_a_contraentrega'
  | 'metodos_pago_vacio_visto';

// Allowlist por evento — toda key fuera de esta lista se omite del payload
// enviado al backend. Añadir un evento nuevo requiere registrarlo aquí
// (TypeScript lo fuerza vía Record<EventTipo, ...>).
const ALLOWED_KEYS: Record<EventTipo, readonly string[]> = {
  app_error: ['message', 'stack'],
  // `ota`: id corto del paquete de JavaScript en curso. Sin esto no hay forma de
  // saber si un telefono ya recibio un OTA o sigue con el codigo viejo — el
  // 17-ago se perdieron tres ciclos de depuracion adivinando justo eso. No es
  // PII: identifica el codigo, no a la persona.
  app_abierta: ['ota'],
  categoria_abierta: ['categoria_id', 'nombre'],
  categoria_grande_abierta: ['categoria_id', 'nombre'],
  subcategoria_abierta: ['categoria_id', 'nombre', 'categoria_padre_id'],
  // Que carril se queda corto: si lo tocan mucho, ese carril necesita mas items
  // o merece pantalla propia. NO se mide el deslizamiento del carril — eso es
  // friccion fisica, no intencion, e inflaria la cola sin responder nada.
  carril_mostrar_mas: ['seccion_id', 'titulo', 'destino'],
  // `origen` separa el muro de compra de un registro exploratorio. El contrato
  // runtime, ademas de esta allowlist de keys, se valida en validarPayload().
  registro_completado: ['telefono_verificado', 'origen'],
  // Cuantos autorizan mercadeo al registrarse y cuantos lo revocan despues. Sin
  // esto no hay forma de saber si la casilla desmarcada mato el canal o no.
  // `otorgado` y `origen` no son PII: no identifican a nadie por si solos.
  consentimiento_mercadeo_cambiado: ['otorgado', 'origen'],
  sesion_iniciada: [],
  // `cupon_id` y NO `cupon_codigo`: el codigo es canjeable y no tiene por que
  // viajar a la tabla de eventos, que se consulta para analitica y no esta
  // pensada para guardar secretos. El id responde la misma pregunta de negocio
  // (que cupon copian y cual aplican) sin llevarse el codigo.
  cupon_copiado: ['cupon_id'],
  producto_visto: ['producto_id', 'nombre', 'categoria'],
  tiempo_en_producto: ['producto_id', 'segundos'],
  sugerencia_clickeada: ['desde_producto', 'producto_clickeado', 'nombre'],
  cupon_aplicado: ['descuento', 'cupon_id'],
  pedido_creado: ['pedido_id', 'total', 'items_count', 'uso_cupon', 'uso_puntos', 'medio_pago', 'pide_vuelto', 'con_notas'],
  // 'q': término buscado — dato de comportamiento (qué buscan y no encuentran),
  // no PII. Clave para decisiones de surtido y campañas (M-OBS-22).
  busqueda_sin_resultado: ['q'],
  busqueda: ['q', 'resultados'],
  pedido_reordenado: ['pedido_id', 'omitidos', 'omitidos_catalogo', 'omitidos_stock'],
  // `motivo` es el CODIGO del catalogo, nunca el texto libre.
  pedido_cancelado: ['pedido_id', 'motivo'],
  // `origen` y `posicion`: desde que carril y en que lugar del carril se agrego.
  // Es lo que responde cual seccion de la portada VENDE, que es distinto de cual
  // se mira. Sin esto, reordenar la portada es adivinar.
  carrito_agregado: ['producto_id', 'nombre', 'precio', 'cantidad', 'origen', 'posicion'],
  carrito_eliminado: ['producto_id'],
  carrito_cantidad_cambiada: ['producto_id', 'cantidad_nueva'],
  interstitial_mostrado: ['interstitial_id'],
  interstitial_completado: ['interstitial_id'],

  // --- A.2 (release 1.2.0) ---
  // La ruta viaja en el campo `pantalla`, que ya existe: no hace falta duplicarla
  // en el payload. ¿Qué pantallas se usan y cuáles no?
  pantalla_vista: [],
  // ¿Dónde exactamente se cae el pedido? `paso` es el punto del checkout.
  //
  // OJO con la semantica de checkout_iniciado: mide que TOCARON "Pedir", no que
  // "entraron al checkout" — se dispara en handlePedir, antes de toda
  // validacion. checkout_abandonado por lo tanto SOLO puede verse en quien ya
  // toco el boton; quien arma carrito y se va sin tocarlo no deja ningun evento
  // aca (para eso esta carrito_abandonado, mas abajo). No renombrar sin medir
  // la serie historica que se pierde — ver docs/estanco/TELEMETRIA-EVENTOS.md.
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
  // Onboarding de direccion. Sin payload: la pregunta es cuantos la guardan y
  // cuantos la saltan, no con que datos — y esos son datos personales.
  // Guardada/saltada suman a vista: si saltan muchos, la pantalla estorba mas
  // de lo que ayuda y hay que replantearla.
  direccion_inicial_vista: [],
  direccion_inicial_guardada: [],
  direccion_inicial_saltada: [],

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

  // --- Chat con el domiciliario (bloque 5 de la app de operaciones) ---
  // ¿Cuánta gente llega siquiera a ver el hilo? Es el denominador: sin él,
  // "20 mensajes esta semana" no dice si el chat sirve o si nadie lo encuentra.
  chat_abierto: ['pedido_id'],
  // Solo el LARGO del mensaje, nunca el contenido. Lo que se hable de una
  // entrega —la dirección, con quién dejarlo, el nombre del portero— no tiene
  // por qué salir del teléfono dentro de un evento de analítica.
  chat_mensaje_enviado: ['pedido_id', 'largo'],

  // --- Código de entrega de 4 dígitos (097) ---
  // Cuántos pedidos con código llegan a mostrarlo, y cuántos de esos piden
  // ayuda -- las dos preguntas que deciden si vale la pena exigirlo.
  codigo_entrega_visto: ['pedido_id'],
  codigo_entrega_ayuda: ['pedido_id'],

  // --- Fase 0 push (2026-08-05) ---
  // El permiso de push por fin se mide, como el de ubicación: sin la tasa de
  // opt-in no se puede evaluar el push a usuarios sin cuenta. `origen` dice en
  // qué momento se pidió ('sesion' hoy; 'carrito' cuando exista el opt-in
  // anónimo de la fase 1). Solo se registra cuando el prompt del SO se mostró
  // de verdad: un denied heredado no es una decisión nueva.
  push_permiso_pedido: ['origen'],
  push_permiso_concedido: ['origen'],
  push_permiso_negado: ['origen'],

  // --- OTP del registro (2026-08-16) ---
  // El muro es la base del embudo: invitado con carrito rebotado del tab
  // Carrito al registro. Sin él no se sabe cuántos ni con cuánta plata llegan.
  registro_muro_mostrado: ['items_count', 'subtotal'],
  // `canal` ('whatsapp' | 'sms') porque el copy y la entrega difieren: si los
  // fallidos se concentran en un canal, el problema es del canal, no del flujo.
  registro_codigo_solicitado: ['canal'],
  registro_codigo_reenviado: ['canal'],
  registro_codigo_verificado: [],
  // `motivo`: codigo_invalido | envio_fallido | telefono_ya_registrado |
  // limite_alcanzado. Nunca el código ni el teléfono.
  registro_codigo_fallido: ['motivo'],

  // --- Fuga de direccion (1.3.1) ---
  // Se fue del carrito sin tocar "Pedir". Responde la pregunta que
  // `checkout_abandonado` no puede: de los que ni lo intentan, a cuantos les
  // faltaba algo que la app YA sabia. Todo son booleanos y conteos: no dice
  // cual es la direccion ni donde queda, solo si la hay.
  // (build 94) +envio/total/envio_gratis/tiene_pin/frio: antes solo se sabia
  // que el subtotal superaba el minimo, no si el ENVIO o el FRIO pesaban en el
  // total que la persona alcanzo a ver. Sigue sin decir POR QUE se fue —
  // decidido a proposito: el gatillo mas comun de este evento es la app yendose
  // a background, donde no hay pantalla para preguntar un motivo.
  carrito_abandonado: ['items_count', 'subtotal', 'tiene_direccion', 'supera_minimo', 'tienda_abierta', 'vio_formulario', 'envio', 'total', 'envio_gratis', 'tiene_pin', 'frio'],
  medio_pago_elegido: ['medio', 'cambio'],
  // Checkout denso (1.3.2/build 94).
  carrito_items_desplegados: ['items_count'],
  direccion_hoja_abierta: ['n_direcciones', 'origen'],
  medio_pago_hoja_abierta: ['medio_actual'],
  entrega_sin_pin_mostrado: ['items_count'],

  // --- Direcciones 1.3.2 ---
  // Revive la salida "fuera de zona, guardar sin el punto" (perfil,
  // onboarding, carrito): cuanta gente la usa de verdad al guardar, no solo
  // cuantos la piden en el mapa (eso lo cubre ubicacion_cancelada).
  direccion_sin_pin_guardada: ['origen'],
  // Complemento de ubicacion_pin_confirmado: cuantos abren el mapa y se
  // rinden (o guardan sin pin), y desde donde. Subcuenta en Android: el back
  // fisico hace pop del Stack sin pasar por este handler.
  ubicacion_cancelada: ['dentro_zona', 'origen'],
  // Que se edita de verdad en Mis Direcciones — nunca el texto de la
  // etiqueta/direccion/notas, que puede llevar nombres de personas.
  direccion_editada: ['cambio_etiqueta', 'cambio_direccion', 'cambio_notas', 'cambio_pin'],
  direccion_eliminada: ['con_pin', 'era_predeterminada'],

  // --- Pago con tarjeta guardada (Wompi, fase 2) ---
  // Cero PII SIEMPRE: nunca last_four, PAN, CVC, nombre, email ni cedula.
  // `franquicia` no es PII (visa|mastercard|otra) — dice que parque de
  // emisores hay que soportar, no quien es el cliente.
  //
  // ¿Guardan tarjeta antes de comprar (perfil) o en medio de la compra
  // (checkout)?
  tarjeta_guardado_iniciado: ['origen'],
  // ¿Alguien abre los PDF de Wompi? 'cual': privacidad | datos.
  tarjeta_contratos_abiertos: ['cual'],
  // Que proporcion de emisores pide challenge visible (vs. no_challenge).
  tarjeta_3ds_challenge_mostrado: ['franquicia'],
  // Cuanto tarda de verdad guardar una tarjeta, en telefono barato.
  tarjeta_guardada: ['franquicia', 'con_3ds', 'segundos'],
  // La razon #1 por la que no se puede pagar con tarjeta. `motivo`: enum
  // corto (bin_sin_3ds | declinada | challenge_abandonado | timeout | red |
  // error). `paso`: formulario | token | fuente | challenge | cobro.
  tarjeta_guardado_fallido: ['motivo', 'paso', 'franquicia'],
  // ¿Se eliminan por caducidad (validity_ends_at vencido) o por decision?
  tarjeta_eliminada: ['motivo_disponible'],
  // --- Checkout con tarjeta (fase 3 — registrados aqui, sin disparar todavia) ---
  pago_iniciado: ['pedido_id', 'monto'],
  pago_aprobado: ['pedido_id', 'segundos'],
  pago_rechazado: ['pedido_id', 'motivo'],
  pago_abandonado: ['pedido_id', 'segundos', 'paso'],
  pago_cambiado_a_contraentrega: ['pedido_id', 'medio'],
  // Cuantos llegan al muro "elige tarjeta pero no tiene ninguna" sin tarjeta
  // guardada. 'origen': perfil | checkout.
  metodos_pago_vacio_visto: ['origen'],
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

function validarPayload(tipo: EventTipo, payload?: Record<string, unknown>): boolean {
  if (tipo !== 'registro_completado') return true;

  // En el binario nuevo ambos campos son obligatorios. La API conserva
  // compatibilidad con eventos antiguos sin `origen`, pero este tracker no debe
  // volver a producir filas ambiguas ni aceptar enums inventados via casts.
  return payload != null
    && typeof payload.telefono_verificado === 'boolean'
    && esOrigenRegistro(payload.origen);
}

interface EventoInput {
  tipo: EventTipo;
  payload?: Record<string, unknown>;
  pantalla?: string;
  // Reloj del telefono al ENCOLAR (094). Nunca se manda como hora absoluta:
  // el backend solo usa la diferencia contra `t_envio` del lote (ver flush()),
  // asi que un reloj desajustado no corrompe nada, solo cambia el delta que
  // de todos modos se descarta si sale de rango.
  t: number;
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
    if (!validarPayload(tipo, payload)) {
      Sentry.addBreadcrumb({
        category: 'tracker',
        level: 'warning',
        message: 'payload de evento invalido descartado',
        data: { tipo },
      });
      return;
    }
    this.queue.push({ tipo, payload: aplicarAllowlist(tipo, payload), pantalla, t: Date.now() });
    if (this.queue.length >= MAX_QUEUE) {
      this.flush();
    }
  }

  async flush() {
    if (this.queue.length === 0) return;
    const batch = this.queue.splice(0, Math.min(this.queue.length, MAX_BATCH_ENVIO));
    // t_envio se toma UNA vez por lote, justo antes de serializar: el backend
    // deriva ocurrido_at = NOW() - (t_envio - evento.t). Si el fetch falla y el
    // batch se reencola (mas abajo), el proximo intento calcula un t_envio
    // nuevo — es lo correcto, porque el envio de verdad ocurre despues.
    const tEnvio = Date.now();
    let body: string;
    try {
      body = JSON.stringify({ eventos: batch, t_envio: tEnvio });
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
        await fetch(`${API_BASE()}/eventos`, {
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
