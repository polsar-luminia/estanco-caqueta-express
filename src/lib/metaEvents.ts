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
 *   - AddedToCart           (agregar al carrito)
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
import { Platform } from "react-native";
import { AppEventsLogger, Settings } from "react-native-fbsdk-next";
import { requestTrackingPermissionsAsync } from "expo-tracking-transparency";

const CURRENCY = "COP";

// Claves de parámetros estándar de Meta (strings literales para no depender de
// constantes que cambian de nombre entre versiones del SDK).
const PARAM_CURRENCY = "fb_currency";
const PARAM_CONTENT_ID = "fb_content_id";
const PARAM_CONTENT_TYPE = "fb_content_type";
const PARAM_NUM_ITEMS = "fb_num_items";

const EVENT_COMPLETE_REGISTRATION = "fb_mobile_complete_registration";
const EVENT_ADD_TO_CART = "fb_mobile_add_to_cart";

let initialized = false;

/**
 * Inicializa el SDK de Meta una sola vez. En iOS pide consentimiento ATT y, si
 * el usuario acepta, habilita el uso del IDFA para atribución. Idempotente.
 */
export async function initMetaAnalytics(): Promise<void> {
  if (initialized) return;
  initialized = true;
  try {
    if (Platform.OS === "ios") {
      // El prompt ATT debe pedirse con la UI montada (se llama desde un useEffect).
      const { status } = await requestTrackingPermissionsAsync();
      Settings.setAdvertiserTrackingEnabled(status === "granted");
    }
    Settings.initializeSDK();
    AppEventsLogger.activateApp();
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
    AppEventsLogger.clearUserData();
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
