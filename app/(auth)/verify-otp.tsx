import { useState } from "react";
import { View, Text, Pressable, ScrollView, KeyboardAvoidingView, Platform, Image } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import Toast from "react-native-toast-message";
import { InputField } from "../../src/components/InputField";
import { verificarResetPassword, solicitarResetPassword } from "../../src/lib/api";

export default function VerifyOtpScreen() {
  const router = useRouter();
  const { telefono } = useLocalSearchParams<{ telefono: string }>();

  const [codigo, setCodigo] = useState("");
  const [nuevaPassword, setNuevaPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [errorCodigo, setErrorCodigo] = useState("");
  const [errorPassword, setErrorPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [reenviando, setReenviando] = useState(false);

  const validarCodigo = () => {
    if (codigo && !/^\d{6}$/.test(codigo)) {
      setErrorCodigo("Debe ser exactamente 6 dígitos");
    } else {
      setErrorCodigo("");
    }
  };

  const validarPassword = () => {
    if (nuevaPassword && nuevaPassword.length < 8) {
      setErrorPassword("Mínimo 8 caracteres");
    } else {
      setErrorPassword("");
    }
  };

  const handleVerificar = async () => {
    if (!/^\d{6}$/.test(codigo)) {
      setErrorCodigo("Debe ser exactamente 6 dígitos");
      return;
    }
    if (nuevaPassword.length < 8) {
      setErrorPassword("Mínimo 8 caracteres");
      return;
    }
    setLoading(true);
    try {
      await verificarResetPassword(telefono, codigo, nuevaPassword);
      Toast.show({ type: "success", text1: "¡Listo!", text2: "Contraseña actualizada correctamente" });
      router.replace("/(auth)/login");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Código inválido o expirado";
      Toast.show({ type: "error", text1: "Error", text2: msg });
    } finally {
      setLoading(false);
    }
  };

  const handleReenviar = async () => {
    setReenviando(true);
    try {
      await solicitarResetPassword(telefono);
      Toast.show({ type: "success", text1: "Código reenviado", text2: "Revisa tu WhatsApp" });
    } catch {
      Toast.show({ type: "error", text1: "No se pudo reenviar", text2: "Intenta de nuevo" });
    } finally {
      setReenviando(false);
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
          </View>

          <Text style={{ fontSize: 20, fontWeight: "700", color: "#1A1C1A", marginBottom: 8, textAlign: "center" }}>
            Ingresa el código
          </Text>
          <Text style={{ fontSize: 13, color: "#6D7B6C", marginBottom: 24, textAlign: "center" }}>
            Enviamos un código de 6 dígitos al WhatsApp{"\n"}
            <Text style={{ fontWeight: "700", color: "#1A1C1A" }}>+57 {telefono}</Text>
          </Text>

          <InputField
            label="Código de verificación"
            icon="🔑"
            placeholder="123456"
            value={codigo}
            onChangeText={setCodigo}
            keyboardType="number-pad"
            onBlur={validarCodigo}
            error={errorCodigo}
          />

          <InputField
            label="Nueva Contraseña"
            icon="🔒"
            placeholder="••••••••"
            value={nuevaPassword}
            onChangeText={setNuevaPassword}
            secureTextEntry={!showPass}
            showToggle
            onToggleSecure={() => setShowPass(!showPass)}
            onBlur={validarPassword}
            error={errorPassword}
          />

          <Pressable
            onPress={handleVerificar}
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
          >
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 17 }}>
              {loading ? "Verificando..." : "Cambiar contraseña"}
            </Text>
          </Pressable>

          <Pressable onPress={handleReenviar} disabled={reenviando} className="items-center mt-5">
            <Text style={{ color: "#1FAF55", fontSize: 13, fontWeight: "600" }}>
              {reenviando ? "Reenviando..." : "¿No recibiste el código? Reenviar"}
            </Text>
          </Pressable>

          <Pressable onPress={() => router.back()} className="items-center mt-3">
            <Text style={{ color: "#6D7B6C", fontSize: 13 }}>← Volver</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
