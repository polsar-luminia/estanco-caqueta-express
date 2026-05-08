import { useState, useRef } from "react";
import { View, Text, TextInput, Pressable, ScrollView, KeyboardAvoidingView, Platform, Image } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import Toast from "react-native-toast-message";
import * as Sentry from "@sentry/react-native";
import { useAuthStore } from "../../src/stores/auth";
import { tracker } from "../../src/lib/tracker";
import { PhoneIcon, LockIcon, EyeIcon, EyeOffIcon } from "../../src/components/icons/AppIcons";

export default function LoginScreen() {
  const router = useRouter();
  const [telefono, setTelefono] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<"phone" | "password" | null>(null);
  const [loginError, setLoginError] = useState(false);
  const [loginErrorMsg, setLoginErrorMsg] = useState("");
  const login = useAuthStore((s) => s.login);
  const submittingRef = useRef(false);

  const handleLogin = async () => {
    if (submittingRef.current) return;
    if (!telefono || !password) {
      Toast.show({ type: "error", text1: "Ingresa tu teléfono y contraseña" });
      return;
    }
    submittingRef.current = true;
    setLoading(true);
    setLoginError(false);
    try {
      await login(telefono.trim(), password);
      tracker.track("sesion_iniciada", {}, "login");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "No se pudo iniciar sesión";
      Sentry.captureException(err instanceof Error ? err : new Error(msg), {
        tags: { flow: "auth", screen: "login" },
      });
      setLoginError(true);
      setLoginErrorMsg(msg);
      Toast.show({ type: "error", text1: "No pudimos iniciar sesión", text2: msg });
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  const phoneStyle = {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 10,
    backgroundColor: focusedField === "phone" ? "#FFFFFF" : "#F4F4F0",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor:
      focusedField === "phone" ? "#1FAF55" : "transparent",
  };

  const passwordStyle = {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 10,
    backgroundColor: focusedField === "password" ? "#FFFFFF" : "#F4F4F0",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor:
      loginError ? "#D33587" : focusedField === "password" ? "#1FAF55" : "transparent",
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#FAFAF6" }}>
      {/* Ambient glow verde — top left */}
      <View
        style={{
          position: "absolute", top: -100, left: -60,
          width: 280, height: 280, borderRadius: 140,
          backgroundColor: "rgba(31,175,85,0.08)",
        }}
      />
      {/* Ambient glow pink — bottom right */}
      <View
        style={{
          position: "absolute", bottom: 60, right: -60,
          width: 240, height: 240, borderRadius: 120,
          backgroundColor: "rgba(211,53,135,0.06)",
        }}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingHorizontal: 24, paddingVertical: 32 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo zone */}
          <View style={{ alignItems: "center", paddingTop: 32, paddingBottom: 24 }}>
            <Image
              source={require("../../assets/logo-estanco.png")}
              style={{ width: 320, height: 76 }}
              resizeMode="contain"
            />
            {/* Tagline con líneas decorativas */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14 }}>
              <View style={{ width: 20, height: 1, backgroundColor: "#E2E3DF" }} />
              <Text style={{ fontSize: 12, color: "#BCCABA", letterSpacing: 0.5 }}>
                Tus productos favoritos en minutos
              </Text>
              <View style={{ width: 20, height: 1, backgroundColor: "#E2E3DF" }} />
            </View>
          </View>

          {/* Campo Teléfono */}
          <View style={{ gap: 6, marginBottom: 16 }}>
            <Text style={{
              fontSize: 10, fontWeight: "700", color: "#6D7B6C",
              textTransform: "uppercase", letterSpacing: 1.2,
              marginBottom: 6, marginLeft: 4,
            }}>
              Teléfono
            </Text>
            <View style={phoneStyle}>
              <PhoneIcon color="#6D7B6C" size={18} />
              <TextInput
                style={{ flex: 1, fontSize: 15, color: "#1A1C1A" }}
                placeholder="300 000 0000"
                placeholderTextColor="#BCCABA"
                keyboardType="phone-pad"
                value={telefono}
                onChangeText={setTelefono}
                autoCapitalize="none"
                onFocus={() => setFocusedField("phone")}
                onBlur={() => setFocusedField(null)}
              />
            </View>
          </View>

          {/* Campo Contraseña */}
          <View style={{ gap: 6, marginBottom: 8 }}>
            <Text style={{
              fontSize: 10, fontWeight: "700", color: "#6D7B6C",
              textTransform: "uppercase", letterSpacing: 1.2,
              marginBottom: 6, marginLeft: 4,
            }}>
              Contraseña
            </Text>
            <View style={passwordStyle}>
              <LockIcon color="#6D7B6C" size={18} />
              <TextInput
                style={{ flex: 1, fontSize: 15, color: "#1A1C1A" }}
                placeholder="••••••••"
                placeholderTextColor="#BCCABA"
                secureTextEntry={!showPass}
                autoCapitalize="none"
                textContentType="password"
                autoComplete="current-password"
                value={password}
                onChangeText={(t) => { setPassword(t); setLoginError(false); setLoginErrorMsg(""); }}
                onFocus={() => setFocusedField("password")}
                onBlur={() => setFocusedField(null)}
              />
              <Pressable
                onPress={() => setShowPass(!showPass)}
                accessibilityLabel="Mostrar contraseña"
              >
                {showPass
                  ? <EyeOffIcon color="#6D7B6C" size={18} />
                  : <EyeIcon color="#6D7B6C" size={18} />}
              </Pressable>
            </View>

            {loginError && (
              <Text style={{ fontSize: 11, color: "#D33587", fontWeight: "500", marginTop: 4, marginLeft: 4 }}>
                {loginErrorMsg || "Teléfono o contraseña incorrectos"}
              </Text>
            )}

            {/* Olvidaste contraseña */}
            <Pressable
              onPress={() => router.push("/(auth)/forgot-password")}
              style={{ alignSelf: "flex-end", marginTop: 4 }}
            >
              <Text style={{ fontSize: 12, color: "#1FAF55", fontWeight: "600" }}>
                ¿Olvidaste tu contraseña?
              </Text>
            </Pressable>
          </View>

          {/* Botón Ingresar */}
          <Pressable onPress={handleLogin} disabled={loading} style={{ marginTop: 8 }}>
            <LinearGradient
              colors={loading ? ["#9E9E9E", "#757575"] : ["#1FAF55", "#006D30"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                borderRadius: 14,
                paddingVertical: 16,
                alignItems: "center",
                justifyContent: "center",
                shadowColor: "#1FAF55",
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: loading ? 0 : 0.28,
                shadowRadius: 24,
                elevation: loading ? 0 : 6,
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 17 }}>
                {loading ? "Ingresando..." : "Ingresar"}
              </Text>
            </LinearGradient>
          </Pressable>

          {/* Divider ¿Eres nuevo? */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 28 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: "#E2E3DF" }} />
            <Text style={{ fontSize: 11, color: "#BCCABA" }}>¿Eres nuevo?</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: "#E2E3DF" }} />
          </View>

          {/* Botón Crear cuenta — ghost pink */}
          <Pressable
            onPress={() => router.push("/(auth)/register")}
            style={{
              borderWidth: 1.5,
              borderColor: "rgba(211,53,135,0.30)",
              borderRadius: 14,
              paddingVertical: 14,
              alignItems: "center",
              backgroundColor: "rgba(211,53,135,0.04)",
            }}
          >
            <Text style={{ fontSize: 15, fontWeight: "700", color: "#D33587" }}>
              Crear cuenta
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
