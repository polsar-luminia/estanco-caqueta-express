/**
 * metaEvents — Capa de medición para campañas de Meta (Facebook Ads).
 *
 * Es SEPARADA del tracker interno (`src/lib/tracker.ts`, que manda eventos a
 * nuestro backend `/eventos`). Aquí los eventos van al SDK de Meta
 * (react-native-fbsdk-next), que Meta usa para optimizar las campañas de
 * instalación/conversión (App Promotion).
 *
 * Eventos estándar que dispara:
 *   - CompleteRegistration  (registro completado)
 *   - ViewContent           (ver detalle de un producto)
 *   - Search                (búsqueda efectiva)
 *   - AddedToCart           (agregar al carrito)
 *   - InitiateCheckout      (toca "Confirmar pedido" — intención de compra)
 *   - Purchase              (pedido creado) -> logPurchase dedicado
 *
 * Todas las funciones son a prueba de fallos: si el módulo nativo no está
 * disponible (build sin el SDK), hacen no-op en vez de romper la app.
 *
 * Orden: initMetaAnalytics() debe correr (y en iOS resolverse el ATT) antes de
 * loguear eventos. Se llama una sola vez desde app/_layout.tsx. Como todos los
 * sitios de evento (registro, carrito, checkout) están debajo de _layout, el
 * orden queda garantizado.
 */
import { AppState, Platform } from "react-native";
import { AppEventsLogger, Settings } from "react-native-fbsdk-next";
import { requestTrackingPermissionsAsync } from "expo-tracking-transparency";

const CURRENCY = "COP";

// Claves de parámetros estándar de Meta (strings literales para no depender de
// constantes que cambian de nombre entre versiones del SDK).
const PARAM_CURRENCY = "fb_currency";
const PARAM_CONTENT_ID = "fb_content_id";
const PARAM_CONTENT_TYPE = "fb_content_type";
const PARAM_NUM_ITEMS = "fb_num_items";
const PARAM_SEARCH_STRING = "fb_search_string";
const PARAM_SUCCESS = "fb_success";

const EVENT_COMPLETE_REGISTRATION = "fb_mobile_complete_registration";
const EVENT_VIEW_CONTENT = "fb_mobile_content_view";
const EVENT_SEARCH = "fb_mobile_search";
const EVENT_ADD_TO_CART = "fb_mobile_add_to_cart";
const EVENT_INITIATED_CHECKOUT = "fb_mobile_initiated_checkout";

let initialized = false;

/**
 * Espera a que la app esté en primer plano (AppState "active"). El prompt de ATT
 * de iOS SOLO se muestra si la app está activa; si se pide durante el arranque
 * (splash / estado "inactive") iOS lo descarta en silencio y el revisor de Apple
 * nunca lo ve. Ese fue el motivo del rechazo 2.1 del build 58.
 */
function esperarAppActiva(): Promise<void> {
  if (AppState.currentState === "active") return Promise.resolve();
  return new Promise((resolve) => {
    const sub = AppState.addEventListener("change", (estado) => {
      if (estado === "active") {
        sub.remove();
        resolve();
      }
    });
  });
}

/**
 * Inicializa el SDK de Meta una sola vez. En iOS pide consentimiento ATT y, si
 * el usuario acepta, habilita el uso del IDFA para atribución. Idempotente.
 */
export async function initMetaAnalytics(): Promise<void> {
  if (initialized) return;
  initialized = true;
  try {
    if (Platform.OS === "ios") {
      // El prompt ATT solo aparece con la app en primer plano y totalmente
      // presentada. Esperamos "active" + un pequeño respiro antes de pedirlo,
      // si no iOS lo descarta en silencio (rechazo 2.1 de Apple, build 58).
      await esperarAppActiva();
      await new Promise((r) => setTimeout(r, 500));
      const { status } = await requestTrackingPermissionsAsync();
      Settings.setAdvertiserTrackingEnabled(status === "granted");
    }
    // fbsdk-next 13.x: initializeSDK() ya activa la app y, con
    // autoLogAppEventsEnabled (app.json), auto-loguea la activación. El antiguo
    // AppEventsLogger.activateApp() NO existe en 13.x (lanzaba y el catch lo
    // tragaba, dejando la activación a medias — degradaba la calidad de eventos).
    Settings.initializeSDK();
  } catch (err) {
    if (__DEV__) console.warn("[metaEvents] init falló:", err);
  }
}

/**
 * Advanced matching: asocia los eventos a un usuario para mejorar la atribución.
 * El SDK hashea los datos. Solo se usan identificadores que ya tenemos.
 */
export function metaIdentify(clienteId: number, telefono?: string): void {
  try {
    AppEventsLogger.setUserID(String(clienteId));
    if (telefono) AppEventsLogger.setUserData({ phone: telefono });
  } catch (err) {
    if (__DEV__) console.warn("[metaEvents] identify falló:", err);
  }
}

/** Limpia la identidad al cerrar sesión. */
export function metaClearUser(): void {
  try {
    AppEventsLogger.clearUserID();
    // fbsdk-next 13.x no tiene clearUserData(); se limpia el advanced matching
    // pasando un objeto vacío a setUserData().
    AppEventsLogger.setUserData({});
  } catch (err) {
    if (__DEV__) console.warn("[metaEvents] clearUser falló:", err);
  }
}

/** Evento de registro completado. */
export function metaLogRegistration(): void {
  try {
    AppEventsLogger.logEvent(EVENT_COMPLETE_REGISTRATION, {
      registration_method: "phone",
      [PARAM_CURRENCY]: CURRENCY,
    });
  } catch (err) {
    if (__DEV__) console.warn("[metaEvents] logRegistration falló:", err);
  }
}

/**
 * Evento de ver contenido (el usuario abre el detalle de un producto). Meta lo
 * usa como señal de interés en la parte alta del embudo (retargeting / lookalike).
 * valor = precio que el usuario ve en pantalla (con oferta si aplica). Se dispara
 * una sola vez por producto visto (no en cada render de lista) — el call-site lo
 * engancha en el efecto que corre al cambiar el id del producto.
 */
export function metaLogViewContent(productoId: number, precio: number): void {
  try {
    AppEventsLogger.logEvent(EVENT_VIEW_CONTENT, precio, {
      [PARAM_CONTENT_ID]: String(productoId),
      [PARAM_CONTENT_TYPE]: "product",
      [PARAM_CURRENCY]: CURRENCY,
    });
  } catch (err) {
    if (__DEV__) console.warn("[metaEvents] logViewContent falló:", err);
  }
}

/**
 * Evento de búsqueda. Se dispara una vez por búsqueda EFECTIVA (con debounce en
 * el call-site, no por cada tecla). `exito` indica si hubo resultados — Meta lo
 * usa para calibrar la intención. No lleva `value`: la búsqueda no tiene precio.
 */
export function metaLogSearch(consulta: string, exito: boolean): void {
  try {
    AppEventsLogger.logEvent(EVENT_SEARCH, {
      [PARAM_SEARCH_STRING]: consulta,
      [PARAM_CONTENT_TYPE]: "product",
      [PARAM_SUCCESS]: exito ? 1 : 0,
      [PARAM_CURRENCY]: CURRENCY,
    });
  } catch (err) {
    if (__DEV__) console.warn("[metaEvents] logSearch falló:", err);
  }
}

/** Evento de agregar al carrito (valor = precio unitario del producto). */
export function metaLogAddToCart(productoId: number, precio: number): void {
  try {
    AppEventsLogger.logEvent(EVENT_ADD_TO_CART, precio, {
      [PARAM_CONTENT_ID]: String(productoId),
      [PARAM_CONTENT_TYPE]: "product",
      [PARAM_CURRENCY]: CURRENCY,
    });
  } catch (err) {
    if (__DEV__) console.warn("[metaEvents] logAddToCart falló:", err);
  }
}

/**
 * Evento de inicio de checkout (el usuario toca "Confirmar pedido"). Completa
 * el embudo AddToCart → InitiateCheckout → Purchase que Meta usa para optimizar
 * campañas de conversión. valor = subtotal del carrito en ese momento.
 */
export function metaLogInitiateCheckout(
  valor: number,
  opts: { numItems: number },
): void {
  try {
    AppEventsLogger.logEvent(EVENT_INITIATED_CHECKOUT, valor, {
      [PARAM_NUM_ITEMS]: opts.numItems,
      [PARAM_CONTENT_TYPE]: "product",
      [PARAM_CURRENCY]: CURRENCY,
    });
  } catch (err) {
    if (__DEV__) console.warn("[metaEvents] logInitiateCheckout falló:", err);
  }
}

/**
 * Evento de compra (pedido creado). Usa logPurchase dedicado: Meta lo trata
 * especial para el mapeo de valores de SKAdNetwork.
 */
export function metaLogPurchase(
  total: number,
  opts: { pedidoId: number; numItems: number },
): void {
  try {
    AppEventsLogger.logPurchase(total, CURRENCY, {
      order_id: String(opts.pedidoId),
      [PARAM_NUM_ITEMS]: opts.numItems,
      [PARAM_CONTENT_TYPE]: "product",
    });
  } catch (err) {
    if (__DEV__) console.warn("[metaEvents] logPurchase falló:", err);
  }
}
