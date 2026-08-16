import { useEffect } from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import * as Sentry from "@sentry/react-native";
import Constants from "expo-constants";
import { useRouter, type Href } from "expo-router";
import NetInfo from "@react-native-community/netinfo";
import { registrarPushToken, registrarPushTokenAnonimo } from "../lib/api";
import { tracker } from "../lib/tracker";
import { queryClient } from "../lib/query-client";
import { useAuthStore, registerLogoutHandler } from "../stores/auth";

/**
 * Un push de pedido ES el aviso de que ese pedido cambió. Si no se usa para
 * refrescar, la app se queda mostrando el estado viejo hasta que venza el
 * staleTime (5 min) o toque el sondeo de 15 s — y mientras tanto le dice al
 * cliente "tu pedido fue entregado" en la barra mientras la pantalla detrás
 * sigue diciendo "en camino".
 *
 * El caso que más molesta es la reseña: la tarjeta para calificar solo aparece en
 * pedidos entregados, así que con el estado viejo en caché el cliente toca
 * "Califícanos" y llega a un pedido donde no hay nada que calificar.
 *
 * `pedido_id` viaja en payload_extra desde el backend (lib/notificaciones.js lo
 * mete plano dentro de `data`). Si no viene o no es un número, no se toca nada:
 * invalidar de más es barato, pero adivinar ids no.
 */
function refrescarPedidoDePush(data: unknown) {
  const pedidoId = (data as { pedido_id?: unknown } | undefined)?.pedido_id;
  const id = typeof pedidoId === "number" ? pedidoId : Number(pedidoId);
  if (!Number.isFinite(id) || id <= 0) return;
  queryClient.invalidateQueries({ queryKey: ["pedido", id] });
  // La lista alimenta "Mis pedidos" y el banner de reseña del Inicio, que filtra
  // por estado entregado: sin esto el banner tarda hasta 5 minutos en salir.
  queryClient.invalidateQueries({ queryKey: ["pedidos"] });
}

// Estado module-level: persiste entre montajes pero se puede resetear desde
// fuera (logout). Usar useRef hacía que el ref quedara stale al cambiar de
// cliente en el mismo proceso.
//
// DOS flags, no uno: el registro anónimo (opt-in a los 20s, sin cuenta) y el de
// cuenta son independientes. Si compartieran flag, un registro anónimo previo
// impediría que el login re-registrara el token a nombre del cliente — y esa
// re-registrada ES la adopción de la fila anónima en el backend.
let registered = false;
let registeredAnon = false;

registerLogoutHandler(() => {
  // Solo el de cuenta: el token anónimo sigue siendo del dispositivo y no hay
  // que volver a pedir permiso ni re-registrar nada al cerrar sesión.
  registered = false;
});

// Clave de "ya preguntamos" del prompt anónimo. En iOS solo hay UNA oportunidad
// real (un denied es permanente), así que el prompt se dispara una sola vez por
// instalación; el guard canAskAgain cubre el caso del denied heredado.
const PUSH_PROMPT_ANONIMO_KEY = "push_prompt_anonimo_v1";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

async function obtenerPushToken(origen: string = "sesion"): Promise<string | null> {
  if (!Device.isDevice) {
    if (__DEV__) {
      console.log("[push] No es dispositivo fisico, omitiendo");
    }
    return null;
  }

  const previo = await Notifications.getPermissionsAsync();
  let status = previo.status;

  if (status !== "granted") {
    // Si el SO ya no permite volver a preguntar (denied definitivo),
    // requestPermissionsAsync devuelve denied SIN mostrar nada: eso no es una
    // decisión nueva del usuario y registrarla inflaría los rechazos.
    const huboPrompt = previo.canAskAgain !== false;
    if (huboPrompt) {
      tracker.track("push_permiso_pedido", { origen });
    }
    const { status: nuevo } = await Notifications.requestPermissionsAsync();
    status = nuevo;
    if (huboPrompt) {
      tracker.track(
        status === "granted" ? "push_permiso_concedido" : "push_permiso_negado",
        { origen }
      );
    }
  }

  if (status !== "granted") {
    if (__DEV__) {
      console.log("[push] Permiso denegado");
    }
    return null;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("pedidos", {
      name: "Pedidos",
      importance: Notifications.AndroidImportance.HIGH,
      sound: "default",
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId: Constants.expoConfig?.extra?.eas?.projectId,
  });

  return tokenData.data;
}

// M-NAV-18: el backend siempre envía data.deep_link. Validar contra allowlist antes de navegar.
// Si se añade una ruta nueva en notificaciones.js o crons-notificaciones.js, registrarla aquí.
//
// El PATH y la QUERY se validan por SEPARADO. Antes la query iba pegada al
// patrón del path y cada parámetro nuevo la rompía en silencio: pasó con
// `?calificar=1` (reseñas) y volvió a pasar con `?chat=1` (chat del domiciliario,
// commit 4826737): el cliente tocaba el push del mensaje y no ocurría NADA. La
// allowlist sigue siendo la defensa contra un deep link fabricado: paths
// cerrados y solo los parámetros que la app interpreta.
const ALLOWED_PATHS = [
  /^\/\(tabs\)\/orders\/\d+$/,
  /^\/\(tabs\)\/cart$/,
  /^\/\(tabs\)\/index$/,
  /^\/product\/\d+$/,
];
const ALLOWED_QUERY = /^(calificar=1|chat=1)$/;
// Rutas navegables SIN sesión (guest browsing): un push anónimo de oferta tiene
// que poder abrir el producto. Los pedidos siguen exigiendo cuenta.
const PATHS_PUBLICOS = [/^\/\(tabs\)\/index$/, /^\/product\/\d+$/];

/** Exportada para poder probarla: la navegación del tap depende de esto. */
export function deepLinkNavegable(deepLink: string, isAuthenticated: boolean): boolean {
  const [path, query] = deepLink.split("?");
  if (!ALLOWED_PATHS.some((r) => r.test(path))) return false;
  if (query !== undefined && !ALLOWED_QUERY.test(query)) return false;
  if (!isAuthenticated && !PATHS_PUBLICOS.some((r) => r.test(path))) return false;
  return true;
}

export function usePushNotifications({ interstitialDone = true }: { interstitialDone?: boolean } = {}) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const router = useRouter();

  // Opt-in ANONIMO (069): a los ~20 s del primer uso, sin exigir cuenta. El
  // prompt del SO se lanza directo (decision de producto) pero nunca encima del
  // Interstitial, y una sola vez por instalacion.
  useEffect(() => {
    if (isAuthenticated || registeredAnon || !interstitialDone) return;

    const timer = setTimeout(async () => {
      try {
        // Si inicio sesion mientras corria el timer, el flujo de cuenta manda.
        if (useAuthStore.getState().isAuthenticated) return;
        if (await AsyncStorage.getItem(PUSH_PROMPT_ANONIMO_KEY)) return;

        const previo = await Notifications.getPermissionsAsync();
        if (previo.status !== "granted" && previo.canAskAgain === false) return; // denied heredado: no quemar el intento

        // ANTES del prompt, crash-safe: pase lo que pase, jamas doble prompt.
        await AsyncStorage.setItem(PUSH_PROMPT_ANONIMO_KEY, "1");

        const token = await obtenerPushToken("arranque_20s");
        if (!token) return;

        await registrarPushTokenAnonimo(token, Platform.OS);
        registeredAnon = true;
        if (__DEV__) console.log("[push] Token anonimo registrado");
      } catch (err: unknown) {
        Sentry.captureException(err, { tags: { feature: "push_anonimo" } });
      }
    }, 20_000);

    return () => clearTimeout(timer);
  }, [isAuthenticated, interstitialDone]);

  useEffect(() => {
    if (!isAuthenticated || registered) return;

    // M-PERS-12: capturamos el clienteId al iniciar para detectar carrera con
    // logout/login. Si entre que pedimos el token Expo y registrarPushToken()
    // termina, el cliente cambió, NO marcamos registered=true — dejamos que el
    // nuevo cliente dispare su propio registro fresh (ej: vía el N14 retry).
    const clienteIdAlIniciar = useAuthStore.getState().cliente?.id;
    if (clienteIdAlIniciar == null) return;

    (async () => {
      try {
        const token = await obtenerPushToken();
        if (!token) return;

        const plataforma = Platform.OS;
        await registrarPushToken(token, plataforma);

        const clienteIdActual = useAuthStore.getState().cliente?.id;
        if (clienteIdActual !== clienteIdAlIniciar) {
          if (__DEV__) {
            console.log(
              "[push] Cliente cambió durante registro (",
              clienteIdAlIniciar,
              "→",
              clienteIdActual,
              "), no marcamos registered"
            );
          }
          Sentry.addBreadcrumb({
            category: "push_notifications",
            level: "info",
            message: "Cliente cambió durante registro de push token",
            data: { clienteIdAlIniciar, clienteIdActual },
          });
          return;
        }

        registered = true;
        if (__DEV__) {
          console.log("[push] Token registrado:", token.substring(0, 30) + "...");
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (__DEV__) {
          console.error("[push] Error registrando token:", msg);
        }
        Sentry.captureException(err, { tags: { feature: "push_notifications" } });
      }
    })();
  }, [isAuthenticated]);

  // N14: reintentar registro si el token falló por red (ej: login sin wifi)
  useEffect(() => {
    if (!isAuthenticated) return;
    const unsub = NetInfo.addEventListener(async (state) => {
      if (state.isConnected && !registered) {
        // M-PERS-12: mismo guard que el useEffect principal — capturamos
        // clienteId al disparar el retry y verificamos antes de marcar registered.
        const clienteIdAlIniciar = useAuthStore.getState().cliente?.id;
        if (clienteIdAlIniciar == null) return;
        try {
          const token = await obtenerPushToken();
          if (!token) return;
          await registrarPushToken(token, Platform.OS);
          const clienteIdActual = useAuthStore.getState().cliente?.id;
          if (clienteIdActual !== clienteIdAlIniciar) return;
          registered = true;
        } catch {
          // silencioso — se reintentará al próximo cambio de red
        }
      }
    });
    return () => unsub();
  }, [isAuthenticated]);

  // Listeners de notificaciones: tap navega al destino, foreground solo registra
  useEffect(() => {
    const subResponse = Notifications.addNotificationResponseReceivedListener((response) => {
      // Refrescar ANTES de navegar: la pantalla destino se monta con la petición
      // ya en vuelo en vez de pintar el estado viejo y corregirse encima.
      refrescarPedidoDePush(response.notification.request.content.data);
      const deepLink = response.notification.request.content.data?.deep_link;
      if (typeof deepLink !== "string") return;
      if (!deepLinkNavegable(deepLink, useAuthStore.getState().isAuthenticated)) {
        Sentry.addBreadcrumb({ category: "push", message: "deep_link rechazado", data: { deepLink } });
        return;
      }
      router.push(deepLink as Href);
    });

    const subReceived = Notifications.addNotificationReceivedListener((notification) => {
      // El handler global (setNotificationHandler) ya muestra el banner en foreground.
      // Acá lo que importa es que el push llega con la app abierta: quien esté
      // mirando el pedido ve cambiar el estado —y aparecer la tarjeta de
      // calificación— sin tocar nada ni esperar al sondeo.
      refrescarPedidoDePush(notification.request.content.data);
    });

    return () => {
      subResponse.remove();
      subReceived.remove();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- router es estable en Expo Router
  }, []);
}
