import "../global.css";
import { useEffect } from "react";
import { AppState } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClientProvider, focusManager } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Toast from "react-native-toast-message";
import * as Sentry from "@sentry/react-native";
import { queryClient } from "../src/lib/query-client";
import { useAuthStore } from "../src/stores/auth";
import { usePushNotifications } from "../src/hooks/usePushNotifications";
import { tracker } from "../src/lib/tracker";
import { toastConfig } from "../src/components/ToastConfig";
import { OfflineBanner } from "../src/components/OfflineBanner";

if (process.env.EXPO_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.1,
    enableAutoSessionTracking: true,
    sessionTrackingIntervalMillis: 30000,
    beforeSend: (event) => {
      if (event.request?.headers) {
        delete (event.request.headers as Record<string, unknown>)['Authorization'];
        delete (event.request.headers as Record<string, unknown>)['Cookie'];
      }
      if (event.request?.data) {
        delete event.request.data;
      }
      return event;
    },
  });
}

export default Sentry.wrap(function RootLayout() {
  const hydrate = useAuthStore((s) => s.hydrate);
  const isLoading = useAuthStore((s) => s.isLoading);

  useEffect(() => {
    hydrate();
    tracker.track('app_abierta');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate es un selector estable de Zustand
  }, []);

  // Sincronizar React Query con AppState para refetch al volver de background
  useEffect(() => {
    focusManager.setEventListener((handleFocus) => {
      const sub = AppState.addEventListener('change', (state) => {
        handleFocus(state === 'active');
      });
      return () => sub.remove();
    });
  }, []);

  usePushNotifications();

  if (isLoading) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="product/[id]"
            options={{
              headerShown: true,
              headerTitle: "",
              headerTransparent: true,
              headerTintColor: "#17994A",
            }}
          />
          <Stack.Screen
            name="category/[id]"
            options={{
              headerShown: true,
              headerTintColor: "#17994A",
            }}
          />
          <Stack.Screen
            name="support/help"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="support/terms"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="support/privacy"
            options={{ headerShown: false }}
          />
        </Stack>
        <Toast config={toastConfig} />
        <OfflineBanner />
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
});
