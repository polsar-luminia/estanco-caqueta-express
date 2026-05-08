import { useState } from "react";
import { Alert, BackHandler, Image, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import * as Sentry from "@sentry/react-native";
import { confirmarEdad, getPerfil } from "../../src/lib/api";
import { useAuthStore } from "../../src/stores/auth";

export default function EdadConfirmarScreen() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const setCliente = useAuthStore((s) => s.setCliente);
  const logout = useAuthStore((s) => s.logout);

  const handleConfirmar = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await confirmarEdad();
      // Re-fetch del servidor para verificar que edad_confirmada === true
      // antes de liberar el guard. Previene bypass si el API falla silenciosamente.
      const perfil = await getPerfil();
      if (perfil.edad_confirmada !== true) {
        Toast.show({ type: "error", text1: "Error", text2: "No se pudo confirmar la edad. Intenta de nuevo." });
        return;
      }
      setCliente(perfil);
      router.replace("/(tabs)");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "No se pudo confirmar tu edad";
      Sentry.captureException(err instanceof Error ? err : new Error(msg), { tags: { flow: "auth", screen: "edad-confirmar" } });
      Toast.show({ type: "error", text1: "Error", text2: msg });
    } finally {
      setLoading(false);
    }
  };

  // En Android podemos cerrar la app. En iOS, Apple PROHIBE cerrar
  // programáticamente la app (Guideline 2.5.4) — la única alternativa válida
  // es cerrar la sesión del usuario y devolverlo al login.
  const handleSalir = () => {
    Alert.alert(
      "¿Salir de la app?",
      "Necesitas ser mayor de 18 años para usar Estanco Caquetá Express.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: Platform.OS === "ios" ? "Cerrar sesión" : "Salir",
          style: "destructive",
          onPress: async () => {
            if (Platform.OS === "android") {
              BackHandler.exitApp();
            } else {
              // iOS: logout y vuelve al login
              await logout();
            }
          },
        },
      ],
    );
  };

  return (
    <View className="flex-1" style={{ backgroundColor: "#FFFFFF" }}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="items-center mb-8">
          <Image
            source={require("../../assets/logo-estanco.png")}
            style={{ width: 220, height: 88 }}
            resizeMode="contain"
          />
        </View>

        <View
          className="bg-white rounded-2xl p-6"
          style={{
            shadowColor: "#1A1C1A",
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: 0.06,
            shadowRadius: 32,
            elevation: 4,
          }}
        >
          <Text style={{ fontSize: 22, fontWeight: "700", color: "#1A1C1A", textAlign: "center", marginBottom: 12 }}>
            Confirma tu mayoría de edad
          </Text>

          <Text style={{ fontSize: 14, color: "#3C443B", lineHeight: 20, textAlign: "center", marginBottom: 8 }}>
            Para usar Estanco Caquetá Express debes ser{"\n"}
            <Text style={{ fontWeight: "700", color: "#1A1C1A" }}>mayor de 18 años</Text>.
          </Text>

          <Text style={{ fontSize: 13, color: "#6D7B6C", lineHeight: 18, textAlign: "center", marginBottom: 24 }}>
            Esta aplicación contiene productos para adultos.
          </Text>

          {/* Botón principal — Sí soy mayor */}
          <Pressable
            onPress={handleConfirmar}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Confirmar que soy mayor de 18 años"
            className="items-center rounded-xl mb-3"
            style={{
              backgroundColor: loading ? "#9E9E9E" : "#1FAF55",
              paddingVertical: 16,
              shadowColor: "#1FAF55",
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.2,
              shadowRadius: 16,
              elevation: 4,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>
              {loading ? "Confirmando..." : "Sí, soy mayor de 18 años"}
            </Text>
          </Pressable>

          {/* Botón secundario — Salir */}
          <Pressable
            onPress={handleSalir}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="No soy mayor de edad, salir de la app"
            className="items-center rounded-xl"
            style={{
              backgroundColor: "#E2E3DF",
              paddingVertical: 16,
            }}
          >
            <Text style={{ color: "#3C443B", fontWeight: "600", fontSize: 15 }}>
              No, salir de la app
            </Text>
          </Pressable>
        </View>

        <Text style={{ fontSize: 11, color: "#8B968A", textAlign: "center", marginTop: 20, lineHeight: 16, paddingHorizontal: 12 }}>
          La venta y consumo de bebidas alcohólicas a menores de edad está prohibida por la ley colombiana (Ley 124 de 1994).
        </Text>
      </ScrollView>
    </View>
  );
}
