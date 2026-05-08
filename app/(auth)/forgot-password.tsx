import { useState } from "react";
import { View, Text, Pressable, ScrollView, KeyboardAvoidingView, Platform, Image, Linking } from "react-native";
import { useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import * as Sentry from "@sentry/react-native";
import { InputField } from "../../src/components/InputField";
import { PhoneIcon } from "../../src/components/icons/AppIcons";
import { solicitarResetPassword } from "../../src/lib/api";
import { WHATSAPP_NEGOCIO_LINK } from "../../src/constants/config";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [telefono, setTelefono] = useState("");
  const [errorTelefono, setErrorTelefono] = useState("");
  const [loading, setLoading] = useState(false);

  const validarTelefono = () => {
    if (!telefono.trim()) { setErrorTelefono(""); return; }
    if (!/^\d{10}$/.test(telefono.trim())) {
      setErrorTelefono("10 dígitos sin +57");
    } else {
      setErrorTelefono("");
    }
  };

  // Flujo: abrir WhatsApp del negocio (abre ventana 24h en Meta) + disparar OTP en
  // paralelo. Meta entrega el OTP UTILITY una vez la ventana este abierta.
  // La pantalla verify-otp tiene un boton "Reenviar" que vuelve a abrir WhatsApp.
  const handleSolicitar = async () => {
    const tel = telefono.trim();
    if (!tel || !/^\d{10}$/.test(tel)) {
      setErrorTelefono("10 dígitos sin +57");
      return;
    }
    setLoading(true);

    // 1. Abrir WhatsApp del negocio — Meta entrega OTP solo cuando la ventana 24h está abierta.
    // Si Linking falla, el OTP llega huérfano (Meta no lo entrega sin ventana activa).
    const wsAbierto = await Linking.openURL(WHATSAPP_NEGOCIO_LINK).then(() => true).catch(() => false);
    if (!wsAbierto) {
      Sentry.captureException(new Error('forgot_password_linking_failed'), { extra: { url: WHATSAPP_NEGOCIO_LINK }, tags: { flow: "auth", screen: "forgot-password" } });
      Toast.show({
        type: "error",
        text1: "No se pudo abrir WhatsApp",
        text2: "Verifica que tengas WhatsApp instalado",
      });
      setLoading(false);
      return;
    }

    // 2. Disparar OTP (Meta lo entregará en la ventana recién abierta)
    try {
      await solicitarResetPassword(tel);
      router.push({ pathname: "/(auth)/verify-otp", params: { telefono: tel } });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "No se pudo enviar el código";
      Sentry.captureException(err instanceof Error ? err : new Error(msg), { tags: { flow: "auth", screen: "forgot-password" } });
      Toast.show({ type: "error", text1: "Error", text2: msg });
    } finally {
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
              Te enviaremos un código por WhatsApp
            </Text>
          </View>

          <Text style={{ fontSize: 20, fontWeight: "700", color: "#1A1C1A", marginBottom: 8, textAlign: "center" }}>
            Recuperar contraseña
          </Text>

          <Text style={{ fontSize: 13, color: "#6D7B6C", marginBottom: 20, textAlign: "center", lineHeight: 18 }}>
            Te abriremos WhatsApp con un mensaje listo para enviar al negocio.{"\n"}
            <Text style={{ fontWeight: "600", color: "#1A1C1A" }}>Mándalo y vuelve a la app</Text> — tu código llegará en segundos.
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
            accessibilityLabel="Abrir WhatsApp y enviar código"
          >
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 17 }}>
              {loading ? "Enviando..." : "Abrir WhatsApp y enviar código"}
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
