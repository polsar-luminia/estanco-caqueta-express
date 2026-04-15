import { QueryClient, QueryCache, MutationCache } from "@tanstack/react-query";
import Toast from "react-native-toast-message";
import * as Sentry from "@sentry/react-native";

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (error.message !== "UNAUTHORIZED") {
        Sentry.captureException(error, {
          tags: { source: "react_query", queryKey: String(query.queryKey) },
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
