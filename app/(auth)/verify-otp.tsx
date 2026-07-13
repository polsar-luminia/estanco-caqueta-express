import { useState, useRef, useEffect } from "react";
import { View, Text, Pressable, ScrollView, KeyboardAvoidingView, Platform, Image } from "react-native";
import { useRouter, useLocalSearchParams, Redirect } from "expo-router";
import Toast from "react-native-toast-message";
import * as Sentry from "@sentry/react-native";
import { InputField } from "../../src/components/InputField";
import { KeyIcon, LockIcon } from "../../src/components/icons/AppIcons";
import { verificarResetPassword, solicitarResetPassword } from "../../src/lib/api";
import { colors, shadows } from "../../src/constants/theme";

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
  const verificandoRef = useRef(false);
  const reenviandoRef = useRef(false);

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
    if (verificandoRef.current) return;
    if (!/^\d{6}$/.test(codigo)) {
      setErrorCodigo("Debe ser exactamente 6 dígitos");
      return;
    }
    if (nuevaPassword.length < 8) {
      setErrorPassword("Mínimo 8 caracteres");
      return;
    }
    verificandoRef.current = true;
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
      verificandoRef.current = false;
      setLoading(false);
    }
  };

  // Reenviar: dispara un nuevo OTP. El backend decide el canal (SMS hoy).
  const handleReenviar = async () => {
    if (reenviandoRef.current) return;
    reenviandoRef.current = true;
    setReenviando(true);
    try {
      await solicitarResetPassword(telefono);
      Toast.show({ type: "success", text1: "Código reenviado", text2: "Revisa tus mensajes en unos segundos" });
      // Cooldown 30s para evitar spam de OTP (cada envio tiene costo)
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
      reenviandoRef.current = false;
      setReenviando(false);
    }
  };

  return (
    <View className="flex-1" style={{ backgroundColor: colors.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0} className="flex-1">
        <ScrollView automaticallyAdjustKeyboardInsets keyboardDismissMode="interactive"
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

          <Text style={{ fontSize: 20, fontWeight: "700", color: colors.ink, marginBottom: 8, textAlign: "center" }}>
            Ingresa el código
          </Text>
          <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 16, textAlign: "center" }}>
            Enviamos un código de 6 dígitos al{"\n"}
            <Text style={{ fontWeight: "700", color: colors.ink }}>+57 {telefono}</Text>
          </Text>

          <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 20, textAlign: "center", lineHeight: 16 }}>
            ¿No te llegó? Espera unos segundos y luego toca{" "}
            <Text style={{ fontWeight: "700", color: colors.green }}>Reenviar</Text> abajo.
          </Text>

          <InputField
            label="Código de verificación"
            icon={<KeyIcon color={colors.muted} size={18} />}
            placeholder="123456"
            value={codigo}
            onChangeText={setCodigo}
            keyboardType="number-pad"
            onBlur={validarCodigo}
            error={errorCodigo}
          />

          <InputField
            label="Nueva Contraseña"
            icon={<LockIcon color={colors.muted} size={18} />}
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
              backgroundColor: loading ? colors.faint : colors.green,
              paddingVertical: 16,
              borderRadius: 14,
              ...(loading ? {} : shadows.greenBtn),
            }}
          >
            <Text style={{ color: colors.white, fontWeight: "800", fontSize: 17 }}>
              {loading ? "Verificando..." : "Cambiar contraseña"}
            </Text>
          </Pressable>

          <Pressable onPress={handleReenviar} disabled={reenviando || cooldownSegundos > 0} className="items-center mt-5">
            <Text style={{ color: cooldownSegundos > 0 ? colors.faint : colors.green, fontSize: 13, fontWeight: "600" }}>
              {reenviando ? "Reenviando..." : cooldownSegundos > 0 ? `Reenviar en ${cooldownSegundos}s` : "¿No recibiste el código? Reenviar"}
            </Text>
          </Pressable>

          <Pressable onPress={() => router.back()} className="items-center mt-3">
            <Text style={{ color: colors.muted, fontSize: 13 }}>← Volver</Text>
          </Pressable>

          {/* M-AUTH-17: salida clara si el número no tenía cuenta. Con el backend
              anti-enumeración (200 genérico), quien escribió un número sin cuenta
              aterriza aquí esperando un código que no llega — este link lo rescata. */}
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
