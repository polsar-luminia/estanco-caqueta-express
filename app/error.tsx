import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { ErrorBoundaryProps } from "expo-router";
import { tracker } from "../src/lib/tracker";
import { useEffect } from "react";

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const router = useRouter();

  useEffect(() => {
    tracker.track("app_error", {
      message: error.message,
      stack: error.stack?.slice(0, 500),
    });
  }, [error]);

  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 32,
        backgroundColor: "#FAFAF6",
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
        Ocurrió un error inesperado. Podés intentar de nuevo o volver al inicio.
      </Text>

      <Pressable
        onPress={retry}
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
