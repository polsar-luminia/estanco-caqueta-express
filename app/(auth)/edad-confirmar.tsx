import { useState } from "react";
import { Alert, BackHandler, Image, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import * as Sentry from "@sentry/react-native";
import { confirmarEdad, getPerfil } from "../../src/lib/api";
import { useAuthStore } from "../../src/stores/auth";
import { colors, shadows, fuentes } from "../../src/constants/theme";

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
      // Encadena a la direccion: se pide UNA vez, recien creada la cuenta, y no en
      // el carrito. La pantalla se salta sola si el cliente ya tiene una.
      router.replace("/(auth)/direccion-inicial");
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
    <View className="flex-1" style={{ backgroundColor: colors.bg }}>
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
          style={shadows.card}
        >
          <Text style={{ fontSize: 22, fontFamily: fuentes.titulo, color: colors.ink, textAlign: "center", marginBottom: 12 }}>
            Confirma tu mayoría de edad
          </Text>

          <Text style={{ fontFamily: fuentes.destacado, fontSize: 14, color: "#3C443B", lineHeight: 20, textAlign: "center", marginBottom: 8 }}>
            Para usar Estanco Caquetá Express debes ser{"\n"}
            <Text style={{ fontFamily: fuentes.destacado, color: colors.ink }}>mayor de 18 años</Text>.
          </Text>

          <Text style={{ fontFamily: fuentes.destacado, fontSize: 13, color: colors.muted, lineHeight: 18, textAlign: "center", marginBottom: 24 }}>
            Esta aplicación contiene productos para adultos.
          </Text>

          {/* Botón principal — Sí soy mayor */}
          <Pressable
            onPress={handleConfirmar}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Confirmar que soy mayor de 18 años"
            accessibilityState={{ disabled: loading }}
            className="items-center rounded-xl mb-3"
            style={{
              backgroundColor: loading ? colors.faint : colors.green,
              paddingVertical: 16,
              ...(loading ? {} : shadows.greenBtn),
            }}
          >
            <Text style={{ color: colors.white, fontFamily: fuentes.destacado, fontSize: 16 }}>
              {loading ? "Confirmando..." : "Sí, soy mayor de 18 años"}
            </Text>
          </Pressable>

          {/* Botón secundario — Salir */}
          <Pressable
            onPress={handleSalir}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="No soy mayor de edad, salir de la app"
            accessibilityState={{ disabled: loading }}
            className="items-center rounded-xl"
            style={{
              backgroundColor: colors.lowfill,
              paddingVertical: 16,
            }}
          >
            <Text style={{ color: "#3C443B", fontFamily: fuentes.destacado, fontSize: 15 }}>
              No, salir de la app
            </Text>
          </Pressable>
        </View>

        <Text style={{ fontFamily: fuentes.destacado, fontSize: 12, color: colors.muted, textAlign: "center", marginTop: 20, lineHeight: 16, paddingHorizontal: 12 }}>
          La venta y consumo de bebidas alcohólicas a menores de edad está prohibida por la ley colombiana (Ley 124 de 1994).
        </Text>
      </ScrollView>
    </View>
  );
}
