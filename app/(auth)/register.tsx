import { useState } from "react";
import { View, Text, Pressable, ScrollView, KeyboardAvoidingView, Platform, Image } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Link, useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import * as Sentry from "@sentry/react-native";
import { useAuthStore } from "../../src/stores/auth";
import { tracker } from "../../src/lib/tracker";
import { DateSelector, DateValue, toISODate, calcularEdad } from "../../src/components/DateSelector";
import { InputField } from "../../src/components/InputField";
import { CheckboxRow } from "../../src/components/CheckboxRow";
import { UserIcon, PhoneIcon, LockIcon } from "../../src/components/icons/AppIcons";

export default function RegisterScreen() {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [fecha, setFecha] = useState<DateValue>({});
  const [aceptaTerminos, setAceptaTerminos] = useState(false);
  const [aceptaDatos, setAceptaDatos] = useState(false);
  const [loading, setLoading] = useState(false);
  const register = useAuthStore((s) => s.register);

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

  const handleRegister = async () => {
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
      Toast.show({ type: "error", text1: "Fecha de nacimiento incompleta o inválida" });
      return;
    }
    const edad = calcularEdad(fecha);
    if (edad === null || edad < 18) {
      Toast.show({ type: "error", text1: "Debes tener 18 años o más para registrarte" });
      return;
    }
    if (!aceptaTerminos) {
      Toast.show({ type: "error", text1: "Debes aceptar los Términos y Condiciones" });
      return;
    }
    if (!aceptaDatos) {
      Toast.show({ type: "error", text1: "Debes autorizar el tratamiento de datos personales" });
      return;
    }
    setLoading(true);
    try {
      await register(telefono.trim(), nombre.trim(), password, iso);
      tracker.track('registro_completado', {}, 'register');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "No se pudo crear la cuenta";
      Sentry.captureException(err instanceof Error ? err : new Error(msg), { tags: { flow: "auth", screen: "register" } });
      Toast.show({ type: "error", text1: "Error", text2: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#FAFAF6", position: "relative" }}>
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

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0}
        style={{ flex: 1 }}
      >
        <ScrollView
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
              <View style={{ width: 16, height: 1, backgroundColor: "#E2E3DF" }} />
              <Text style={{ fontSize: 11, color: "#BCCABA" }}>Crea tu cuenta gratis</Text>
              <View style={{ width: 16, height: 1, backgroundColor: "#E2E3DF" }} />
            </View>
          </View>

          {/* Form */}
          <InputField
            label="Nombre Completo"
            icon={<UserIcon color="#6D7B6C" size={18} />}
            placeholder="Ej. Juan Pérez"
            value={nombre}
            onChangeText={setNombre}
            onBlur={validarNombre}
            error={errorNombre}
          />
          <InputField
            label="Número de Teléfono"
            icon={<PhoneIcon color="#6D7B6C" size={18} />}
            placeholder="+57 300 000 0000"
            value={telefono}
            onChangeText={setTelefono}
            keyboardType="phone-pad"
            onBlur={validarTelefono}
            error={errorTelefono}
          />
          <InputField
            label="Contraseña"
            icon={<LockIcon color="#6D7B6C" size={18} />}
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPass}
            showToggle
            onToggleSecure={() => setShowPass(!showPass)}
            onBlur={validarPassword}
            error={errorPassword}
          />

          {/* Fecha de nacimiento */}
          <View style={{ marginBottom: 12 }}>
            <DateSelector value={fecha} onChange={setFecha} />
          </View>

          {/* Checkboxes de políticas */}
          <View style={{ gap: 10, marginTop: 8 }}>
            <CheckboxRow checked={aceptaTerminos} onToggle={() => setAceptaTerminos(!aceptaTerminos)}>
              Acepto los{" "}
              <Text
                style={{ color: "#1FAF55", fontWeight: "700" }}
                onPress={(e) => { e.stopPropagation(); router.push("/support/terms"); }}
              >
                Términos y Condiciones
              </Text>
            </CheckboxRow>

            <CheckboxRow checked={aceptaDatos} onToggle={() => setAceptaDatos(!aceptaDatos)}>
              Autorizo el tratamiento de mis{" "}
              <Text
                style={{ color: "#1FAF55", fontWeight: "700" }}
                onPress={(e) => { e.stopPropagation(); router.push("/support/privacy"); }}
              >
                Datos Personales
              </Text>
            </CheckboxRow>
          </View>

          {/* CTA — Crear Cuenta */}
          <Pressable onPress={handleRegister} disabled={loading} style={{ marginTop: 20 }}>
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
                {loading ? "Creando cuenta..." : "Crear Cuenta"}
              </Text>
            </LinearGradient>
          </Pressable>

          {/* Footer — link a login */}
          <View style={{ alignItems: "center", marginTop: 16 }}>
            <View style={{ flexDirection: "row" }}>
              <Text style={{ color: "#6D7B6C", fontSize: 13 }}>¿Ya tienes una cuenta? </Text>
              <Link href="/(auth)/login" asChild>
                <Pressable>
                  <Text style={{ color: "#D33587", fontSize: 13, fontWeight: "700" }}>Inicia sesión</Text>
                </Pressable>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
