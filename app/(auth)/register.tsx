import { useState, useRef } from "react";
import { View, Text, Pressable, ScrollView, KeyboardAvoidingView, Platform, Image, Alert } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Link, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Toast from "react-native-toast-message";
import * as Sentry from "@sentry/react-native";
import { useAuthStore } from "../../src/stores/auth";
import { tracker } from "../../src/lib/tracker";
import { metaLogRegistration } from "../../src/lib/metaEvents";
import { DateValue, toISODate, calcularEdad } from "../../src/components/DateSelector";
import { InputField } from "../../src/components/InputField";
import { UserIcon, PhoneIcon, LockIcon } from "../../src/components/icons/AppIcons";
import { colors, shadows } from "../../src/constants/theme";

export default function RegisterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [aceptaMercadeo, setAceptaMercadeo] = useState(false);
  const [fecha, setFecha] = useState<DateValue>({});
  // Campo único DD/MM/AAAA con auto-formato (reemplaza los 3 selectores con modal)
  const [fechaTexto, setFechaTexto] = useState("");
  const [errorFecha, setErrorFecha] = useState("");
  const [loading, setLoading] = useState(false);
  const register = useAuthStore((s) => s.register);
  const submittingRef = useRef(false);

  // Errores de validación en tiempo real (onBlur)
  const [errorNombre, setErrorNombre] = useState("");
  const [errorTelefono, setErrorTelefono] = useState("");
  const [errorPassword, setErrorPassword] = useState("");

  const validarNombre = () => {
    if (nombre.trim().length < 2) {
      setErrorNombre("Ingresa tu nombre completo");
    } else {
      setErrorNombre("");
    }
  };

  const validarTelefono = () => {
    if (!telefono.trim()) {
      setErrorTelefono("");
      return;
    }
    if (!/^\d{10}$/.test(telefono.trim())) {
      setErrorTelefono("10 dígitos sin +57");
    } else {
      setErrorTelefono("");
    }
  };

  const validarPassword = () => {
    if (!password) {
      setErrorPassword("");
      return;
    }
    if (password.length < 8) {
      setErrorPassword("Mínimo 8 caracteres");
    } else {
      setErrorPassword("");
    }
  };

  // Auto-formato DD/MM/AAAA: inserta las barras mientras escribe y valida
  // fecha + edad apenas completa los 8 dígitos.
  const handleFechaChange = (text: string) => {
    const digits = text.replace(/\D/g, "").slice(0, 8);
    let out = digits;
    if (digits.length > 4) out = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    else if (digits.length > 2) out = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    setFechaTexto(out);

    if (digits.length === 8) {
      const v: DateValue = {
        day: Number(digits.slice(0, 2)),
        month: Number(digits.slice(2, 4)),
        year: Number(digits.slice(4)),
      };
      if (!toISODate(v)) {
        setErrorFecha("Fecha inválida (DD/MM/AAAA)");
        setFecha({});
        return;
      }
      const edad = calcularEdad(v);
      if (edad === null || edad < 18) {
        setErrorFecha("Debes tener 18 años o más");
        setFecha({});
        return;
      }
      setErrorFecha("");
      setFecha(v);
    } else {
      setFecha({});
      setErrorFecha("");
    }
  };

  const handleRegister = async () => {
    if (submittingRef.current) return;
    if (!nombre || !telefono || !password) {
      Toast.show({ type: "error", text1: "Completa todos los campos" });
      return;
    }
    if (!/^\d{10}$/.test(telefono.trim())) {
      Toast.show({ type: "error", text1: "Teléfono inválido", text2: "10 dígitos sin +57 (ej: 3001234567)" });
      return;
    }
    if (password.length < 8) {
      Toast.show({ type: "error", text1: "Contraseña muy corta", text2: "Mínimo 8 caracteres" });
      return;
    }
    const iso = toISODate(fecha);
    if (!iso) {
      Toast.show({ type: "error", text1: "Fecha de nacimiento inválida", text2: "Escríbela como DD/MM/AAAA (ej: 15/03/1995)" });
      return;
    }
    const edad = calcularEdad(fecha);
    if (edad === null || edad < 18) {
      Toast.show({ type: "error", text1: "Debes tener 18 años o más para registrarte" });
      return;
    }
    submittingRef.current = true;
    setLoading(true);
    try {
      await register(telefono.trim(), nombre.trim(), password, iso, aceptaMercadeo);
      tracker.track('registro_completado', {}, 'register');
      tracker.track('consentimiento_mercadeo_cambiado', { otorgado: aceptaMercadeo, origen: 'registro' }, 'register');
      metaLogRegistration();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "No se pudo crear la cuenta";
      // Caso "número ya registrado": diálogo con acciones directas en vez de
      // toast seco — el usuario suele no saber que ya tenía cuenta (ej. pruebas
      // previas) y se atasca intentando adivinar contraseñas.
      const yaRegistrado = /ya tiene una cuenta|ya está registrado|Ya existe una cuenta/i.test(msg);
      if (yaRegistrado) {
        Alert.alert(
          "Este número ya tiene cuenta",
          "Parece que ya te habías registrado con este teléfono. ¿Qué quieres hacer?",
          [
            { text: "Iniciar sesión", onPress: () => router.push("/(auth)/login") },
            { text: "Recuperar contraseña", onPress: () => router.push("/(auth)/forgot-password") },
            { text: "Cancelar", style: "cancel" },
          ],
        );
      } else {
        Sentry.captureException(err instanceof Error ? err : new Error(msg), { tags: { flow: "auth", screen: "register" } });
        Toast.show({ type: "error", text1: "No pudimos crear tu cuenta", text2: msg });
      }
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, position: "relative" }}>
      {/* Glow verde — top left */}
      <View style={{
        position: "absolute", top: -80, left: -50,
        width: 240, height: 240, borderRadius: 120,
        backgroundColor: "rgba(31,175,85,0.07)",
      }} />
      {/* Glow pink — bottom right */}
      <View style={{
        position: "absolute", bottom: 60, right: -50,
        width: 200, height: 200, borderRadius: 100,
        backgroundColor: "rgba(211,53,135,0.05)",
      }} />

      {/* Botón Volver — guest browsing */}
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
        accessibilityLabel="Volver"
      >
        <Feather name="chevron-left" size={20} color={colors.ink} />
        <Text style={{ fontSize: 14, fontWeight: "600", color: colors.ink }}>
          Volver
        </Text>
      </Pressable>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0}
        style={{ flex: 1 }}
      >
        <ScrollView automaticallyAdjustKeyboardInsets keyboardDismissMode="interactive"
          contentContainerStyle={{ padding: 24, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo zone */}
          <View style={{ alignItems: "center", paddingTop: 40, paddingBottom: 24 }}>
            <Image
              source={require("../../assets/logo-estanco.png")}
              style={{ width: 200, height: 48 }}
              resizeMode="contain"
            />
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 }}>
              <View style={{ width: 16, height: 1, backgroundColor: colors.line }} />
              <Text style={{ fontSize: 12, color: colors.faint }}>Crea tu cuenta gratis</Text>
              <View style={{ width: 16, height: 1, backgroundColor: colors.line }} />
            </View>
          </View>

          {/* Form */}
          <InputField
            label="Nombre Completo"
            icon={<UserIcon color={colors.muted} size={18} />}
            placeholder="Ej. Juan Pérez"
            value={nombre}
            onChangeText={setNombre}
            onBlur={validarNombre}
            error={errorNombre}
          />
          <InputField
            label="Número de Teléfono"
            icon={<PhoneIcon color={colors.muted} size={18} />}
            placeholder="+57 300 000 0000"
            value={telefono}
            onChangeText={setTelefono}
            keyboardType="phone-pad"
            onBlur={validarTelefono}
            error={errorTelefono}
          />
          <InputField
            label="Contraseña"
            icon={<LockIcon color={colors.muted} size={18} />}
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPass}
            showToggle
            onToggleSecure={() => setShowPass(!showPass)}
            onBlur={validarPassword}
            error={errorPassword}
            // Le dicen al gestor de contraseñas del sistema que esto es una
            // contraseña NUEVA, para que ofrezca guardarla. Sin estas dos props
            // el telefono no propone nada al crearla —solo el campo de login
            // las tenia—, asi que la persona se inventa una clave que su
            // dispositivo nunca guardo y una semana despues, cuando expira la
            // sesion, tiene que recordarla de memoria.
            textContentType="newPassword"
            autoComplete="new-password"
          />

          {/* Fecha de nacimiento — un solo campo con auto-formato */}
          <InputField
            label="Fecha de Nacimiento"
            icon={<Feather name="calendar" size={18} color={colors.muted} />}
            placeholder="DD/MM/AAAA"
            value={fechaTexto}
            onChangeText={handleFechaChange}
            keyboardType="number-pad"
            error={errorFecha}
          />

          {/* Mercadeo: casilla APARTE y DESMARCADA por defecto.
              Aparte, porque no se puede condicionar el servicio a aceptar publicidad:
              crear la cuenta y recibir ofertas son dos decisiones distintas.
              Desmarcada, porque una casilla premarcada no es una autorizacion expresa
              — es una que el usuario no tomo. Si no la toca, no se manda nada. */}
          <Pressable
            onPress={() => setAceptaMercadeo((v) => !v)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: aceptaMercadeo }}
            accessibilityLabel="Quiero recibir ofertas y promociones por WhatsApp y notificaciones"
            hitSlop={8}
            style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, marginTop: 18, paddingHorizontal: 4 }}
          >
            <View
              style={{
                width: 22, height: 22, borderRadius: 6, marginTop: 1,
                borderWidth: 2,
                borderColor: aceptaMercadeo ? colors.green : colors.muted,
                backgroundColor: aceptaMercadeo ? colors.green : "transparent",
                alignItems: "center", justifyContent: "center",
              }}
            >
              {aceptaMercadeo && <Feather name="check" size={14} color="#fff" />}
            </View>
            <Text style={{ flex: 1, fontSize: 12.5, color: colors.muted, lineHeight: 17 }}>
              Quiero recibir ofertas y promociones por WhatsApp y notificaciones.{" "}
              <Text style={{ color: colors.faint }}>
                Opcional — puedes cambiarlo cuando quieras desde tu perfil.
              </Text>
            </Text>
          </Pressable>

          {/* Aceptación implícita de políticas: el toque en "Crear Cuenta" es la
              aceptación expresa (patrón estándar; reemplaza los 2 checkboxes). */}
          <Text style={{ fontSize: 12.5, color: colors.muted, textAlign: "center", marginTop: 12, lineHeight: 17, paddingHorizontal: 8 }}>
            Al crear tu cuenta aceptas los{" "}
            <Text
              style={{ color: colors.green, fontWeight: "700" }}
              onPress={() => router.push("/support/terms")}
              accessibilityRole="link"
              accessibilityLabel="Leer los Términos y Condiciones"
            >
              Términos y Condiciones
            </Text>
            {" "}y autorizas el{" "}
            <Text
              style={{ color: colors.green, fontWeight: "700" }}
              onPress={() => router.push("/support/privacy")}
              accessibilityRole="link"
              accessibilityLabel="Leer la política de Tratamiento de Datos"
            >
              Tratamiento de tus Datos
            </Text>
            .
          </Text>

          {/* CTA — Crear Cuenta */}
          <Pressable
            onPress={handleRegister}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Crear cuenta"
            accessibilityState={{ disabled: loading }}
            style={{ marginTop: 14 }}
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
              <Text style={{ color: colors.white, fontWeight: "800", fontSize: 17 }}>
                {loading ? "Creando cuenta..." : "Crear Cuenta"}
              </Text>
            </LinearGradient>
          </Pressable>

          {/* Footer — link a login */}
          <View style={{ alignItems: "center", marginTop: 16 }}>
            <View style={{ flexDirection: "row" }}>
              <Text style={{ color: colors.muted, fontSize: 13 }}>¿Ya tienes una cuenta? </Text>
              <Link href="/(auth)/login" asChild>
                <Pressable
                  accessibilityRole="link"
                  accessibilityLabel="Iniciar sesión con una cuenta existente"
                  hitSlop={16}
                >
                  <Text style={{ color: colors.offer, fontSize: 13, fontWeight: "700" }}>Inicia sesión</Text>
                </Pressable>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
