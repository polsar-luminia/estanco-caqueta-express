// Pantalla de error global de la app.
//
// VIVIA EN app/error.tsx Y NO SERVIA PARA NADA. Expo Router trata cualquier
// archivo dentro de app/ como una RUTA, asi que ese exportaba un ErrorBoundary
// para la pantalla "/error" — una pantalla a la que nadie navega nunca. La
// frontera de error global se declara exportando `ErrorBoundary` desde un
// _layout, y ningun _layout lo hacia.
//
// O sea: desde que se escribio (26-jul-2026), un fallo de render mostraba la
// pantalla roja de Expo Router en vez de esto. No fallaba al escribirlo, no
// fallaba al compilar, y solo se notaba el dia que algo reventara de verdad —
// justo cuando ya no hay margen para descubrirlo.
//
// El aviso que lo delato ("Route ./error.tsx is missing the required default
// export") sonaba a formalismo y era el sintoma exacto del problema.

import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { ErrorBoundaryProps } from "expo-router";
import { tracker } from "../lib/tracker";
import { useEffect } from "react";
import * as Sentry from "@sentry/react-native";
import { colors } from "../constants/theme";

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const router = useRouter();

  useEffect(() => {
    tracker.track("app_error", {
      message: error.message,
      stack: error.stack?.slice(0, 500),
    });
    Sentry.captureException(error);
  }, [error]);

  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 32,
        backgroundColor: colors.bg,
      }}
    >
      <Text style={{ fontSize: 40, marginBottom: 16 }}>😵</Text>
      <Text
        style={{
          fontSize: 20,
          fontWeight: "700",
          color: "#1A1C1A",
          marginBottom: 8,
          textAlign: "center",
        }}
      >
        Algo salió mal
      </Text>
      <Text
        style={{
          fontSize: 13,
          color: "#6D7B6C",
          textAlign: "center",
          marginBottom: 32,
        }}
      >
        Ocurrió un error inesperado. Puedes intentar de nuevo o volver al inicio.
      </Text>

      <Pressable
        onPress={retry}
        accessibilityRole="button"
        accessibilityLabel="Intentar cargar la pantalla de nuevo"
        style={{
          backgroundColor: "#1FAF55",
          borderRadius: 12,
          paddingVertical: 14,
          paddingHorizontal: 32,
          marginBottom: 12,
          width: "100%",
          alignItems: "center",
        }}
      >
        <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>
          Intentar de nuevo
        </Text>
      </Pressable>

      <Pressable
        onPress={() => router.replace("/(tabs)")}
        accessibilityRole="button"
        accessibilityLabel="Volver a la pantalla de inicio"
        style={{
          borderRadius: 12,
          paddingVertical: 14,
          paddingHorizontal: 32,
          width: "100%",
          alignItems: "center",
        }}
      >
        <Text style={{ color: "#6D7B6C", fontWeight: "600", fontSize: 15 }}>
          Volver al inicio
        </Text>
      </Pressable>
    </View>
  );
}
