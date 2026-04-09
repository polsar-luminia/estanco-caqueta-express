import "../global.css";
import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Toast from "react-native-toast-message";
import { queryClient } from "../src/lib/query-client";
import { useAuthStore } from "../src/stores/auth";
import { usePushNotifications } from "../src/hooks/usePushNotifications";
import { tracker } from "../src/lib/tracker";
import { toastConfig } from "../src/components/ToastConfig";

export default function RootLayout() {
  const hydrate = useAuthStore((s) => s.hydrate);
  const isLoading = useAuthStore((s) => s.isLoading);

  useEffect(() => {
    hydrate();
    tracker.track('app_abierta');
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
        </Stack>
        <Toast config={toastConfig} />
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
