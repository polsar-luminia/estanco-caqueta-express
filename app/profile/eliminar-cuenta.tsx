// Apple App Store §5.1.1(v) — eliminación in-app de cuenta.
// El reviewer debe poder eliminar la cuenta sin salir de la app. Un link a web
// no satisface la guideline; este flujo cumple con todos los requisitos:
//   1. Avisa al usuario qué se elimina (datos, pedidos, puntos).
//   2. Pide confirmación tipeando una palabra clave para evitar tap accidental.
//   3. Llama al backend (DELETE /clientes/me) — anonimiza/elimina datos.
//   4. Cierra sesión local + limpia stores + redirige a login.

import { useState, useRef } from "react";
import { View, Text, TextInput, Pressable, ScrollView, KeyboardAvoidingView, Platform, Alert } from "react-native";
import { Stack, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import Toast from "react-native-toast-message";
import * as Sentry from "@sentry/react-native";
import { useAuthStore } from "../../src/stores/auth";
import { useCartStore } from "../../src/stores/cart";
import { eliminarCuenta } from "../../src/lib/api";
import { BackButton } from "../../src/components/BackButton";

const PALABRA_CONFIRMACION = "ELIMINAR";

export default function EliminarCuentaScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const cliente = useAuthStore((s) => s.cliente);
  const logout = useAuthStore((s) => s.logout);
  const clearCart = useCartStore((s) => s.clear);

  const [confirmacion, setConfirmacion] = useState("");
  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);

  const palabraOk = confirmacion.trim().toUpperCase() === PALABRA_CONFIRMACION;

  const handleEliminar = () => {
    if (!palabraOk) {
      Toast.show({
        type: "error",
        text1: `Escribe ${PALABRA_CONFIRMACION} para confirmar`,
      });
      return;
    }
    Alert.alert(
      "Eliminar cuenta",
      "Esta acción es permanente. ¿Continuar?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            if (submittingRef.current) return;
            submittingRef.current = true;
            setLoading(true);
            try {
              await eliminarCuenta(PALABRA_CONFIRMACION);
              clearCart();
              queryClient.clear();
              await logout();
              Toast.show({
                type: "success",
                text1: "Cuenta eliminada",
                text2: "Tus datos fueron borrados",
              });
              router.replace("/(auth)/login");
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : "No se pudo eliminar la cuenta";
              Sentry.captureException(err instanceof Error ? err : new Error(msg), {
                tags: { flow: "account_deletion" },
              });
              Toast.show({ type: "error", text1: "Error", text2: msg });
            } finally {
              submittingRef.current = false;
              setLoading(false);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#FAFAF6" }}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={{
        flexDirection: "row", alignItems: "center",
        paddingTop: insets.top + 12, paddingBottom: 16, paddingHorizontal: 16,
        backgroundColor: "#FAFAF6",
        borderBottomWidth: 1, borderBottomColor: "#EFEFEB",
      }}>
        <BackButton style={{ paddingRight: 16 }} />
        <Text style={{ flex: 1, fontSize: 17, fontWeight: "800", color: "#1A1C1A", textAlign: "center", marginRight: 60 }}>
          Eliminar cuenta
        </Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ padding: 24, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{
            backgroundColor: "rgba(220,38,38,0.06)",
            borderRadius: 16,
            padding: 16,
            flexDirection: "row",
            alignItems: "flex-start",
            gap: 12,
            marginBottom: 20,
          }}>
            <Feather name="alert-triangle" size={22} color="#DC2626" />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: "800", color: "#DC2626", marginBottom: 4 }}>
                Esta acción no se puede deshacer
              </Text>
              <Text style={{ fontSize: 12, color: "#6D7B6C", lineHeight: 18 }}>
                Tu cuenta y todos tus datos serán eliminados de forma permanente.
              </Text>
            </View>
          </View>

          <Text style={{ fontSize: 13, fontWeight: "700", color: "#1A1C1A", marginBottom: 10 }}>
            Lo que se eliminará:
          </Text>
          <View style={{ gap: 8, marginBottom: 24 }}>
            {[
              "Tus datos personales (nombre, teléfono, dirección)",
              "Tu historial de pedidos",
              `Tus ${cliente?.puntos ?? 0} puntos acumulados`,
              "Tus direcciones guardadas",
              "Tus cupones y referidos",
              "Tu acceso a la app (tendrás que registrarte de nuevo)",
            ].map((it, i) => (
              <View key={i} style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
                <Feather name="x-circle" size={14} color="#DC2626" style={{ marginTop: 2 }} />
                <Text style={{ flex: 1, fontSize: 13, color: "#3C443B", lineHeight: 18 }}>{it}</Text>
              </View>
            ))}
          </View>

          <Text style={{ fontSize: 12, color: "#6D7B6C", lineHeight: 18, marginBottom: 16 }}>
            Por seguridad, escribe la palabra{" "}
            <Text style={{ fontWeight: "800", color: "#1A1C1A" }}>{PALABRA_CONFIRMACION}</Text>{" "}
            (en mayúsculas) para confirmar.
          </Text>

          <TextInput
            value={confirmacion}
            onChangeText={setConfirmacion}
            placeholder={PALABRA_CONFIRMACION}
            placeholderTextColor="#BCCABA"
            autoCapitalize="characters"
            autoCorrect={false}
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: 14,
              paddingHorizontal: 16,
              paddingVertical: 14,
              fontSize: 16,
              fontWeight: "700",
              color: "#1A1C1A",
              borderWidth: 1.5,
              borderColor: palabraOk ? "#1FAF55" : "#E2E3DF",
              marginBottom: 24,
              letterSpacing: 2,
            }}
          />

          <Pressable
            onPress={handleEliminar}
            disabled={!palabraOk || loading}
            style={{
              backgroundColor: !palabraOk || loading ? "#E2E3DF" : "#DC2626",
              borderRadius: 14,
              paddingVertical: 16,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{
              color: !palabraOk || loading ? "#9E9E9E" : "#FFFFFF",
              fontWeight: "700",
              fontSize: 15,
            }}>
              {loading ? "Eliminando..." : "Eliminar mi cuenta"}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => router.back()}
            disabled={loading}
            style={{
              marginTop: 12,
              paddingVertical: 16,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#6D7B6C", fontWeight: "600", fontSize: 14 }}>
              Cancelar
            </Text>
          </Pressable>

          <Text style={{
            fontSize: 11, color: "#9E9E9E",
            marginTop: 24, textAlign: "center", lineHeight: 16, paddingHorizontal: 8,
          }}>
            ¿Solo necesitas cambiar tu información? Vuelve atrás y edita tu perfil — no
            es necesario eliminar tu cuenta.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
