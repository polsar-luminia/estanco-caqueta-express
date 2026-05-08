import { QueryClient, QueryCache, MutationCache, onlineManager, focusManager } from "@tanstack/react-query";
import { AppState, type AppStateStatus } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import Toast from "react-native-toast-message";
import * as Sentry from "@sentry/react-native";
import { registerLogoutHandler } from "../stores/auth";

// Reconexión automática: cuando la red vuelve, React Query refetcha las queries stale
onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => setOnline(!!state.isConnected))
);

// Refetch al volver la app al foreground (equivalente a refetchOnWindowFocus en web)
AppState.addEventListener("change", (status: AppStateStatus) => {
  focusManager.setFocused(status === "active");
});

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (error.message !== "UNAUTHORIZED") {
        Sentry.captureException(error, {
          // Solo el primer elemento del queryKey (nombre de la query) — evita IDs de usuario en Sentry
          tags: { source: "react_query", queryKey: String(query.queryKey[0]) },
        });
        // Solo mostrar Toast si la query ya habia cargado datos antes
        // (evita spam al arrancar sin conexion: no dispara 5 Toasts simultaneos)
        if (query.state.data !== undefined) {
          Toast.show({
            type: "error",
            text1: "Error de conexión",
            text2: "No pudimos actualizar la información",
          });
        }
      }
    },
  }),
  mutationCache: new MutationCache({
    onError: (error) => {
      // Las mutations manuales ya manejan sus propios Toasts; este es fallback
      if (error.message !== "UNAUTHORIZED") {
        console.warn("[mutation error]", error.message);
        Sentry.captureException(error, { tags: { source: "mutation" } });
      }
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutos
      retry: (failureCount: number, error: Error) =>
        error.message !== 'UNAUTHORIZED' && failureCount < 1,
      retryDelay: 1500,
      refetchOnWindowFocus: true,
    },
  },
});

// Limpiar cache de React Query en cualquier logout para que el siguiente
// usuario no vea queries (pedidos, puntos, direcciones) del usuario anterior.
registerLogoutHandler(() => {
  queryClient.clear();
});
