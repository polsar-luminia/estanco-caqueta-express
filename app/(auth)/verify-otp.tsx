import { useState, useRef, useEffect } from "react";
import { View, Text, Pressable, ScrollView, KeyboardAvoidingView, Platform, Image, Linking } from "react-native";
import { useRouter, useLocalSearchParams, Redirect } from "expo-router";
import Toast from "react-native-toast-message";
import * as Sentry from "@sentry/react-native";
import { InputField } from "../../src/components/InputField";
import { KeyIcon, LockIcon } from "../../src/components/icons/AppIcons";
import { verificarResetPassword, solicitarResetPassword } from "../../src/lib/api";
import { WHATSAPP_NEGOCIO_LINK } from "../../src/constants/config";

export default function VerifyOtpScreen() {
  const router = useRouter();
  const { telefono } = useLocalSearchParams<{ telefono: string }>();
  const telefonoValido = !!telefono && /^\d{10}$/.test(telefono);

  // TODOS los hooks DEBEN llamarse antes de cualquier return condicional
  // (rules-of-hooks). El guard va después.
  const [codigo, setCodigo] = useState("");
  const [nuevaPassword, setNuevaPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [errorCodigo, setErrorCodigo] = useState("");
  const [errorPassword, setErrorPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [reenviando, setReenviando] = useState(false);
  const [cooldownSegundos, setCooldownSegundos] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (cooldownRef.current) clearInterval(cooldownRef.current); }, []);

  // Si llegan acá sin telefono (deep link directo, navegación rota), volver
  // a la pantalla de solicitar en lugar de crashear al llamar al API.
  if (!telefonoValido) {
    return <Redirect href="/(auth)/forgot-password" />;
  }

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
      Sentry.captureException(err instanceof Error ? err : new Error(msg), { tags: { flow: "auth", screen: "verify-otp" } });
      Toast.show({ type: "error", text1: "Error", text2: msg });
    } finally {
      setLoading(false);
    }
  };

  // Reenviar: vuelve a abrir WhatsApp del negocio (asegura ventana 24h abierta)
  // y dispara nuevo OTP en paralelo. Si la primera vez Meta silencio el envio
  // por falta de ventana, esta vez si entrega.
  const handleReenviar = async () => {
    setReenviando(true);
    Linking.openURL(WHATSAPP_NEGOCIO_LINK).catch(() => {
      // Si WhatsApp no abre, igual seguimos: tal vez ya tiene ventana abierta
    });
    try {
      await solicitarResetPassword(telefono);
      Toast.show({ type: "success", text1: "Código reenviado", text2: "Manda el saludo en WhatsApp y revisa el código" });
      // Cooldown 30s para evitar spam de OTP (Meta cobra por cada envío UTILITY)
      setCooldownSegundos(30);
      cooldownRef.current = setInterval(() => {
        setCooldownSegundos((s) => {
          if (s <= 1) { clearInterval(cooldownRef.current!); cooldownRef.current = null; return 0; }
          return s - 1;
        });
      }, 1000);
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
          <Text style={{ fontSize: 13, color: "#6D7B6C", marginBottom: 16, textAlign: "center" }}>
            Enviamos un código de 6 dígitos al WhatsApp{"\n"}
            <Text style={{ fontWeight: "700", color: "#1A1C1A" }}>+57 {telefono}</Text>
          </Text>

          <Text style={{ fontSize: 12, color: "#8B968A", marginBottom: 20, textAlign: "center", lineHeight: 16 }}>
            ¿No te llegó? Asegúrate de haber enviado el saludo al negocio en WhatsApp.
            Si no lo hiciste, toca <Text style={{ fontWeight: "700", color: "#1FAF55" }}>Reenviar</Text> abajo.
          </Text>

          <InputField
            label="Código de verificación"
            icon={<KeyIcon color="#6D7B6C" size={18} />}
            placeholder="123456"
            value={codigo}
            onChangeText={setCodigo}
            keyboardType="number-pad"
            onBlur={validarCodigo}
            error={errorCodigo}
          />

          <InputField
            label="Nueva Contraseña"
            icon={<LockIcon color="#6D7B6C" size={18} />}
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

          <Pressable onPress={handleReenviar} disabled={reenviando || cooldownSegundos > 0} className="items-center mt-5">
            <Text style={{ color: cooldownSegundos > 0 ? "#9E9E9E" : "#1FAF55", fontSize: 13, fontWeight: "600" }}>
              {reenviando ? "Reenviando..." : cooldownSegundos > 0 ? `Reenviar en ${cooldownSegundos}s` : "¿No recibiste el código? Reenviar"}
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
