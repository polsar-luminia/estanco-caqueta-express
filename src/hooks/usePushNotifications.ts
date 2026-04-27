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
    console.log("[push] No es dispositivo fisico, omitiendo");
    return null;
  }

  const { status: existente } = await Notifications.getPermissionsAsync();
  let status = existente;

  if (status !== "granted") {
    const { status: nuevo } = await Notifications.requestPermissionsAsync();
    status = nuevo;
  }

  if (status !== "granted") {
    console.log("[push] Permiso denegado");
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

    (async () => {
      try {
        const token = await obtenerPushToken();
        if (!token) return;

        const plataforma = Platform.OS;
        await registrarPushToken(token, plataforma);
        registered = true;
        if (__DEV__) {
          console.log("[push] Token registrado:", token.substring(0, 30) + "...");
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[push] Error registrando token:", msg);
        Sentry.captureException(err, { tags: { feature: "push_notifications" } });
      }
    })();
  }, [isAuthenticated]);

  // N14: reintentar registro si el token falló por red (ej: login sin wifi)
  useEffect(() => {
    if (!isAuthenticated) return;
    const unsub = NetInfo.addEventListener(async (state) => {
      if (state.isConnected && !registered) {
        try {
          const token = await obtenerPushToken();
          if (!token) return;
          await registrarPushToken(token, Platform.OS);
          registered = true;
        } catch {
          // silencioso — se reintentará al próximo cambio de red
        }
      }
    });
    return () => unsub();
  }, [isAuthenticated]);

  // Listeners de notificaciones: tap navega al pedido, foreground solo registra
  useEffect(() => {
    const subResponse = Notifications.addNotificationResponseReceivedListener((response) => {
      const pedidoId = response.notification.request.content.data?.pedidoId;
      if (pedidoId && useAuthStore.getState().isAuthenticated) {
        router.push(`/(tabs)/orders/${pedidoId}` as Href);
      }
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
