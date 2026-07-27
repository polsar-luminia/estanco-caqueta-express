import { useEffect } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import * as Sentry from "@sentry/react-native";
import Constants from "expo-constants";
import { useRouter, type Href } from "expo-router";
import NetInfo from "@react-native-community/netinfo";
import { registrarPushToken } from "../lib/api";
import { useAuthStore, registerLogoutHandler } from "../stores/auth";

// Estado module-level: persiste entre montajes pero se puede resetear desde
// fuera (logout). Usar useRef hacía que el ref quedara stale al cambiar de
// cliente en el mismo proceso.
let registered = false;

registerLogoutHandler(() => {
  registered = false;
});

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

async function obtenerPushToken(): Promise<string | null> {
  if (!Device.isDevice) {
    if (__DEV__) {
      console.log("[push] No es dispositivo fisico, omitiendo");
    }
    return null;
  }

  const { status: existente } = await Notifications.getPermissionsAsync();
  let status = existente;

  if (status !== "granted") {
    const { status: nuevo } = await Notifications.requestPermissionsAsync();
    status = nuevo;
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

export function usePushNotifications() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const router = useRouter();

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
    // M-NAV-18: el backend siempre envía data.deep_link. Validar contra allowlist antes de navegar.
    // Si se añade una ruta nueva en notificaciones.js o crons-notificaciones.js, registrarla aquí.
    const ALLOWED_DEEP_LINKS = [
      // `?calificar=1` lo manda el push de reseña para abrir el detalle ya con el
      // formulario. Sin contemplarlo, el `$` del patrón hacía que la ruta no
      // pasara el filtro y el tap se descartaba en silencio: el cliente tocaba
      // "Califícanos" y no ocurría nada. Se acepta ESE parámetro y ninguno más —
      // la allowlist es la defensa contra un deep link fabricado, no una guía.
      /^\/\(tabs\)\/orders\/\d+(\?calificar=1)?$/,
      /^\/\(tabs\)\/cart$/,
      /^\/\(tabs\)\/index$/,
      /^\/product\/\d+$/,
    ];

    const subResponse = Notifications.addNotificationResponseReceivedListener((response) => {
      const deepLink = response.notification.request.content.data?.deep_link;
      if (typeof deepLink !== "string") return;
      const valido = ALLOWED_DEEP_LINKS.some((r) => r.test(deepLink));
      if (!valido) {
        Sentry.addBreadcrumb({ category: "push", message: "deep_link rechazado", data: { deepLink } });
        return;
      }
      if (!useAuthStore.getState().isAuthenticated) return;
      router.push(deepLink as Href);
    });

    const subReceived = Notifications.addNotificationReceivedListener((_notification) => {
      // El handler global (setNotificationHandler) ya muestra el banner en foreground.
    });

    return () => {
      subResponse.remove();
      subReceived.remove();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- router es estable en Expo Router
  }, []);
}
