import "../global.css";
import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "../src/lib/query-client";
import { useAuthStore } from "../src/stores/auth";
import { usePushNotifications } from "../src/hooks/usePushNotifications";

export default function RootLayout() {
  const hydrate = useAuthStore((s) => s.hydrate);
  const isLoading = useAuthStore((s) => s.isLoading);

  useEffect(() => {
    hydrate();
  }, []);

  usePushNotifications();

  if (isLoading) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="product/[id]"
          options={{
            presentation: "modal",
            headerShown: true,
            headerTitle: "",
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
      </Stack>
    </QueryClientProvider>
  );
}
