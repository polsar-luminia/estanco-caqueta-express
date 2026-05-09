import { useState, useRef } from "react";
import { View, Text, Pressable, ScrollView, KeyboardAvoidingView, Platform, Image } from "react-native";
import { useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import * as Sentry from "@sentry/react-native";
import { InputField } from "../../src/components/InputField";
import { PhoneIcon } from "../../src/components/icons/AppIcons";
import { solicitarResetPassword } from "../../src/lib/api";

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
      Sentry.captureException(err instanceof Error ? err : new Error(msg), { tags: { flow: "auth", screen: "forgot-password" } });
      Toast.show({ type: "error", text1: "Error", text2: msg });
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  return (
    <View className="flex-1" style={{ backgroundColor: "#FFFFFF" }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0} className="flex-1">
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="items-center mb-8">
            <Image
              source={require("../../assets/logo-estanco.png")}
              style={{ width: 260, height: 104 }}
              resizeMode="contain"
            />
            <Text style={{ color: "#6D7B6C", fontSize: 13, marginTop: 12, textAlign: "center" }}>
              Te enviaremos un código de verificación
            </Text>
          </View>

          <Text style={{ fontSize: 20, fontWeight: "700", color: "#1A1C1A", marginBottom: 8, textAlign: "center" }}>
            Recuperar contraseña
          </Text>

          <Text style={{ fontSize: 13, color: "#6D7B6C", marginBottom: 20, textAlign: "center", lineHeight: 18 }}>
            Ingresa tu número y te enviaremos un{"\n"}
            <Text style={{ fontWeight: "600", color: "#1A1C1A" }}>código de 6 dígitos</Text> en segundos.
          </Text>

          <InputField
            label="Número de Teléfono"
            icon={<PhoneIcon color="#6D7B6C" size={18} />}
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
              backgroundColor: loading ? "#9E9E9E" : "#1FAF55",
              paddingVertical: 16,
              borderRadius: 999,
              shadowColor: "#1FAF55",
              shadowOffset: { width: 0, height: 12 },
              shadowOpacity: 0.2,
              shadowRadius: 32,
              elevation: 6,
            }}
            accessibilityRole="button"
            accessibilityLabel="Enviar código de verificación"
          >
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 17 }}>
              {loading ? "Enviando..." : "Enviar código"}
            </Text>
          </Pressable>

          <Pressable onPress={() => router.back()} className="items-center mt-6">
            <Text style={{ color: "#6D7B6C", fontSize: 13 }}>← Volver al inicio de sesión</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
