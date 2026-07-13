import { useState, useRef } from "react";
import { View, Text, Pressable, ScrollView, KeyboardAvoidingView, Platform, Image } from "react-native";
import { useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import * as Sentry from "@sentry/react-native";
import { InputField } from "../../src/components/InputField";
import { PhoneIcon } from "../../src/components/icons/AppIcons";
import { solicitarResetPassword } from "../../src/lib/api";
import { colors, shadows } from "../../src/constants/theme";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [telefono, setTelefono] = useState("");
  const [errorTelefono, setErrorTelefono] = useState("");
  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);

  const validarTelefono = () => {
    if (!telefono.trim()) { setErrorTelefono(""); return; }
    if (!/^\d{10}$/.test(telefono.trim())) {
      setErrorTelefono("10 dígitos sin +57");
    } else {
      setErrorTelefono("");
    }
  };

  // Flujo: el backend decide el canal de envio (SMS por defecto mientras la
  // WABA de Meta esta bloqueada). El cliente solo solicita el OTP. La
  // pantalla verify-otp tiene un boton "Reenviar" que vuelve a pedir uno nuevo.
  const handleSolicitar = async () => {
    if (submittingRef.current) return;
    const tel = telefono.trim();
    if (!tel || !/^\d{10}$/.test(tel)) {
      setErrorTelefono("10 dígitos sin +57");
      return;
    }
    submittingRef.current = true;
    setLoading(true);
    try {
      await solicitarResetPassword(tel);
      router.push({ pathname: "/(auth)/verify-otp", params: { telefono: tel } });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "No se pudo enviar el código";
      // Caso especial: numero no registrado → CTA al registro en vez de error generico
      if (msg === "Este número no está registrado.") {
        Toast.show({
          type: "info",
          text1: "Número no registrado",
          text2: "Crea una cuenta para empezar a pedir.",
          onPress: () => router.replace("/(auth)/register"),
        });
        return;
      }
      Sentry.captureException(err instanceof Error ? err : new Error(msg), { tags: { flow: "auth", screen: "forgot-password" } });
      Toast.show({ type: "error", text1: "Error", text2: msg });
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  return (
    <View className="flex-1" style={{ backgroundColor: colors.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0} className="flex-1">
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 80, paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="items-center mb-8">
            <Image
              source={require("../../assets/logo-estanco.png")}
              style={{ width: 260, height: 104 }}
              resizeMode="contain"
            />
            <Text style={{ color: colors.muted, fontSize: 13, marginTop: 12, textAlign: "center" }}>
              Te enviaremos un código de verificación
            </Text>
          </View>

          <Text style={{ fontSize: 20, fontWeight: "700", color: colors.ink, marginBottom: 8, textAlign: "center" }}>
            Recuperar contraseña
          </Text>

          <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 20, textAlign: "center", lineHeight: 18 }}>
            Ingresa tu número y te enviaremos un{"\n"}
            <Text style={{ fontWeight: "600", color: colors.ink }}>código de 6 dígitos</Text> en segundos.
          </Text>

          <InputField
            label="Número de Teléfono"
            icon={<PhoneIcon color={colors.muted} size={18} />}
            placeholder="3001234567"
            value={telefono}
            onChangeText={setTelefono}
            keyboardType="phone-pad"
            onBlur={validarTelefono}
            error={errorTelefono}
          />

          <Pressable
            onPress={handleSolicitar}
            disabled={loading}
            className="items-center mt-4"
            style={{
              backgroundColor: loading ? colors.faint : colors.green,
              paddingVertical: 16,
              borderRadius: 14,
              ...(loading ? {} : shadows.greenBtn),
            }}
            accessibilityRole="button"
            accessibilityLabel="Enviar código de verificación"
          >
            <Text style={{ color: colors.white, fontWeight: "800", fontSize: 17 }}>
              {loading ? "Enviando..." : "Enviar código"}
            </Text>
          </Pressable>

          <Pressable onPress={() => router.back()} className="items-center mt-6">
            <Text style={{ color: colors.muted, fontSize: 13 }}>← Volver al inicio de sesión</Text>
          </Pressable>

          {/* Link de registro PERSISTENTE (M-AUTH-17): no depende del 404 del
              backend. Cuando el backend pase al 200 genérico anti-enumeración,
              el CTA condicional de "número no registrado" deja de aparecer, pero
              el usuario sin cuenta igual tiene una salida clara aquí. */}
          <Pressable onPress={() => router.replace("/(auth)/register")} className="items-center mt-4">
            <Text style={{ color: colors.muted, fontSize: 13 }}>
              ¿No tienes cuenta? <Text style={{ color: colors.offer, fontWeight: "700" }}>Regístrate</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
