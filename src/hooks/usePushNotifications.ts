import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import * as Sentry from "@sentry/react-native";
import { registrarPushToken } from "../lib/api";
import { useAuthStore } from "../stores/auth";

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
    projectId: "669996b7-c230-4933-b487-ee4fadf0b90d",
  });

  return tokenData.data;
}

export function usePushNotifications() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const registeredRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || registeredRef.current) return;

    (async () => {
      try {
        const token = await obtenerPushToken();
        if (!token) return;

        const plataforma = Platform.OS;
        await registrarPushToken(token, plataforma);
        registeredRef.current = true;
        console.log("[push] Token registrado:", token.substring(0, 30) + "...");
      } catch (err: any) {
        console.error("[push] Error registrando token:", err.message);
        Sentry.captureException(err, { tags: { feature: "push_notifications" } });
      }
    })();
  }, [isAuthenticated]);
}
