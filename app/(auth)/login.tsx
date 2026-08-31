import { useState, useRef } from "react";
import { View, Text, TextInput, Pressable, ScrollView, KeyboardAvoidingView, Platform, Image } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Toast from "react-native-toast-message";
import * as Sentry from "@sentry/react-native";
import { useAuthStore } from "../../src/stores/auth";
import { tracker } from "../../src/lib/tracker";
import { aplicarModoPorTelefono } from "../../src/lib/backendPruebas";
import { PhoneIcon, LockIcon, EyeIcon, EyeOffIcon } from "../../src/components/icons/AppIcons";
import { colors, radii, shadows, fuentes } from "../../src/constants/theme";

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [telefono, setTelefono] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<"phone" | "password" | null>(null);
  const [loginError, setLoginError] = useState(false);
  const [loginErrorMsg, setLoginErrorMsg] = useState("");
  // Tras 2 fallos la recuperacion deja de ser un enlace pequeño y pasa a ser un
  // boton. Es el unico camino que de verdad rescata gente: de 155 dispositivos
  // que llegaron a /forgot-password, 82 entraron despues. Y el momento es
  // estrechisimo — de los que fallan, o se resuelve en la misma sentada o se
  // pierden: 131 de 217 no volvieron nunca, y solo 21 volvieron pasada la hora.
  const [fallos, setFallos] = useState(0);
  // Error del TELEFONO, separado del de credenciales. Sin esto el aviso de
  // formato salia bajo el campo de contraseña y con ese campo en rojo — o sea,
  // el mismo defecto que este trabajo viene a arreglar: un mensaje que señala
  // al campo equivocado.
  const [errorTelefono, setErrorTelefono] = useState("");
  const login = useAuthStore((s) => s.login);
  const submittingRef = useRef(false);

  // Misma limpieza que hace el backend, para no mandar algo que ya sabemos que
  // va a fallar. `login.tsx` era la UNICA de las tres pantallas que no validaba
  // el formato (register.tsx y forgot-password.tsx si lo hacen desde siempre),
  // asi que un digito de mas o un "+57" volvia como "Teléfono o contraseña
  // incorrectos" — un mensaje que apunta al lado equivocado y manda a la
  // persona a cambiar una contraseña que estaba bien.
  const telefonoLimpio = (t: string) => {
    const limpio = t.replace(/[\s.\-()]/g, "");
    if (/^\d{10}$/.test(limpio)) return limpio;
    const sinIndicativo = limpio.replace(/^\+?57/, "");
    return /^3\d{9}$/.test(sinIndicativo) ? sinIndicativo : limpio;
  };

  const handleLogin = async () => {
    if (submittingRef.current) return;
    if (!telefono || !password) {
      Toast.show({ type: "error", text1: "Ingresa tu teléfono y contraseña" });
      return;
    }
    const tel = telefonoLimpio(telefono);
    if (!/^\d{10}$/.test(tel)) {
      setErrorTelefono("Escribe los 10 dígitos de tu celular, sin +57");
      Toast.show({ type: "error", text1: "Teléfono incompleto", text2: "Son 10 dígitos, sin el +57" });
      return;
    }
    setErrorTelefono("");
    submittingRef.current = true;
    setLoading(true);
    setLoginError(false);
    // A.2 — el login es un paso del checkout: si se pierde gente aquí, se pierden
    // pedidos. Sin estos dos eventos no hay forma de saberlo.
    tracker.track("login_iniciado", { origen: "login" }, "login");
    try {
      // Numero de prueba -> toda la app pasa a staging ANTES de autenticar (el
      // token queda emitido por el backend correcto). Cualquier otro numero
      // devuelve la app a produccion. Ver src/lib/backendPruebas.ts.
      await aplicarModoPorTelefono(tel);
      await login(tel, password);
      setFallos(0);
      tracker.track("sesion_iniciada", {}, "login");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "No se pudo iniciar sesión";
      const status = (err as { status?: number } | undefined)?.status;
      setFallos((n) => n + 1);
      // El mensaje del backend es una etiqueta acotada (credenciales, bloqueo,
      // red), no texto del usuario: no lleva PII.
      tracker.track("login_fallido", { motivo: msg.slice(0, 80) }, "login");
      // Un bloqueo NO es un fallo de credenciales, y hasta hoy se contaban
      // juntos. Los 33 casos de `Error 429` se identificaron por el TEXTO del
      // mensaje, que es fragil: un cambio de copy en el backend rompia la
      // metrica en silencio, y de hecho ya habia pasado. El status no se
      // desincroniza de ningun copy.
      //   429 = limitador (por IP+telefono) · 423 = bloqueo de la cuenta
      if (status === 429 || status === 423) {
        const espera = (err as { retryAfter?: number } | undefined)?.retryAfter;
        tracker.track(
          "login_bloqueado",
          { origen: status === 429 ? "rate_limit" : "lockout", espera_segundos: espera },
          "login",
        );
      }
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
    backgroundColor: colors.surface,
    borderRadius: radii.input,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: errorTelefono
      ? colors.danger
      : focusedField === "phone" ? colors.green : colors.line,
  };

  const passwordStyle = {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: radii.input,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor:
      loginError ? colors.danger : focusedField === "password" ? colors.green : colors.line,
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
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

      {/* Botón Volver — Apple §5.1.1(v) guest browsing: el usuario debe poder
          regresar al catálogo sin iniciar sesión. canGoBack() = stack push;
          replace fallback = entrada directa a /(auth)/login. */}
      <Pressable
        onPress={() => {
          if (router.canGoBack()) router.back();
          else router.replace("/(tabs)");
        }}
        hitSlop={12}
        style={{
          position: "absolute",
          top: insets.top + 8,
          left: 16,
          zIndex: 10,
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          paddingHorizontal: 12,
          paddingVertical: 8,
          backgroundColor: "rgba(255,255,255,0.75)",
          borderRadius: 999,
          borderWidth: 1,
          borderColor: "rgba(226,227,223,0.6)",
        }}
        accessibilityRole="button"
        accessibilityLabel="Volver al catálogo"
      >
        <Feather name="chevron-left" size={20} color={colors.ink} />
        <Text style={{ fontSize: 14, fontFamily: fuentes.destacado, color: colors.ink }}>
          Volver
        </Text>
      </Pressable>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0}
        style={{ flex: 1 }}
      >
        <ScrollView automaticallyAdjustKeyboardInsets keyboardDismissMode="interactive"
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
              <View style={{ width: 20, height: 1, backgroundColor: colors.line }} />
              <Text style={{ fontFamily: fuentes.destacado, fontSize: 12, color: colors.faint, letterSpacing: 0.5 }}>
                Tus productos favoritos en minutos
              </Text>
              <View style={{ width: 20, height: 1, backgroundColor: colors.line }} />
            </View>
          </View>

          {/* Campo Teléfono */}
          <View style={{ gap: 6, marginBottom: 16 }}>
            <Text style={{
              fontSize: 12, fontFamily: fuentes.destacado, color: colors.muted,
              textTransform: "uppercase", letterSpacing: 1.2,
              marginBottom: 6, marginLeft: 4,
            }}>
              Teléfono
            </Text>
            <View style={phoneStyle}>
              <PhoneIcon color={colors.muted} size={18} />
              <TextInput
                style={{ flex: 1, fontFamily: fuentes.destacado, fontSize: 15, color: colors.ink }}
                placeholder="300 000 0000"
                placeholderTextColor={colors.faint}
                keyboardType="phone-pad"
                value={telefono}
                onChangeText={(v) => { setTelefono(v); if (errorTelefono) setErrorTelefono(""); }}
                autoCapitalize="none"
                onFocus={() => setFocusedField("phone")}
                onBlur={() => setFocusedField(null)}
              />
            </View>
            {errorTelefono !== "" && (
              <Text style={{ fontSize: 12, color: colors.danger, fontFamily: fuentes.destacado, marginTop: 4, marginLeft: 4 }}>
                {errorTelefono}
              </Text>
            )}
          </View>

          {/* Campo Contraseña */}
          <View style={{ gap: 6, marginBottom: 8 }}>
            <Text style={{
              fontSize: 12, fontFamily: fuentes.destacado, color: colors.muted,
              textTransform: "uppercase", letterSpacing: 1.2,
              marginBottom: 6, marginLeft: 4,
            }}>
              Contraseña
            </Text>
            <View style={passwordStyle}>
              <LockIcon color={colors.muted} size={18} />
              <TextInput
                style={{ flex: 1, fontFamily: fuentes.destacado, fontSize: 15, color: colors.ink }}
                // El placeholder NO puede ser puntos: es indistinguible de una
                // contraseña ya escrita, asi que nadie sabe si el campo esta vacio
                // o lleno. Lo encontro un explorador encarnando a un usuario, que
                // tropezo con ello cuatro veces seguidas ("muestra punticos y yo no
                // he escrito nada"), y antes habia hecho perder pasos a una prueba
                // manual por lo mismo.
                placeholder="Tu contraseña"
                placeholderTextColor={colors.faint}
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
                accessibilityRole="button"
                accessibilityLabel={showPass ? "Ocultar contraseña" : "Mostrar contraseña"}
                // Icono de 18 px dentro del campo: hitSlop para no ensanchar el input.
                hitSlop={13}
              >
                {showPass
                  ? <EyeOffIcon color={colors.muted} size={18} />
                  : <EyeIcon color={colors.muted} size={18} />}
              </Pressable>
            </View>

            {loginError && (
              <Text style={{ fontSize: 12, color: colors.danger, fontFamily: fuentes.destacado, marginTop: 4, marginLeft: 4 }}>
                {loginErrorMsg || "Teléfono o contraseña incorrectos"}
              </Text>
            )}

            {/* Olvidaste contraseña.
                Con 2 o mas fallos deja de ser un enlace de 12px alineado a la
                derecha y pasa a ser un boton de ancho completo. No es cosmetica:
                es la unica salida que rescata gente (82 de 155), y la ventana
                para usarla es la misma sentada — quien no la encuentra ahi, no
                vuelve. */}
            {fallos >= 2 ? (
              <Pressable
                onPress={() => router.push("/(auth)/forgot-password")}
                accessibilityRole="button"
                accessibilityLabel="Recuperar tu contraseña"
                style={{
                  marginTop: 12,
                  paddingVertical: 13,
                  borderRadius: radii.input,
                  borderWidth: 1.5,
                  borderColor: colors.green,
                  alignItems: "center",
                }}
              >
                <Text style={{ fontSize: 14, color: colors.green, fontFamily: fuentes.destacado }}>
                  Recuperar mi contraseña
                </Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={() => router.push("/(auth)/forgot-password")}
                accessibilityRole="button"
                accessibilityLabel="Recuperar tu contraseña"
                hitSlop={16}
                style={{ alignSelf: "flex-end", marginTop: 4 }}
              >
                <Text style={{ fontSize: 12, color: colors.green, fontFamily: fuentes.destacado }}>
                  ¿Olvidaste tu contraseña?
                </Text>
              </Pressable>
            )}
          </View>

          {/* Botón Ingresar */}
          <Pressable
            onPress={handleLogin}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Iniciar sesión"
            accessibilityState={{ disabled: loading }}
            style={{ marginTop: 8 }}
          >
            <LinearGradient
              colors={loading ? [colors.faint, "#757575"] : [colors.green, colors.greenDeep]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                borderRadius: 14,
                paddingVertical: 16,
                alignItems: "center",
                justifyContent: "center",
                ...(loading ? {} : shadows.greenBtn),
              }}
            >
              <Text style={{ color: colors.white, fontFamily: fuentes.destacado, fontSize: 17 }}>
                {loading ? "Ingresando..." : "Ingresar"}
              </Text>
            </LinearGradient>
          </Pressable>

          {/* Divider ¿Eres nuevo? */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 28 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.line }} />
            <Text style={{ fontFamily: fuentes.destacado, fontSize: 12, color: colors.faint }}>¿Eres nuevo?</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.line }} />
          </View>

          {/* Botón Crear cuenta — ghost coral */}
          <Pressable
            onPress={() => router.push("/(auth)/register")}
            accessibilityRole="button"
            accessibilityLabel="Crear una cuenta nueva"
            style={{
              borderWidth: 1.5,
              borderColor: "rgba(240,101,63,0.30)",
              borderRadius: 14,
              paddingVertical: 14,
              alignItems: "center",
              backgroundColor: "rgba(240,101,63,0.04)",
            }}
          >
            <Text style={{ fontSize: 15, fontFamily: fuentes.destacado, color: colors.offer }}>
              Crear cuenta
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
