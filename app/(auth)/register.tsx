import { useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { Link } from "expo-router";
import Toast from "react-native-toast-message";
import { useAuthStore } from "../../src/stores/auth";

export default function RegisterScreen() {
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const register = useAuthStore((s) => s.register);

  const handleRegister = async () => {
    if (!nombre || !telefono || !password) {
      Toast.show({ type: "error", text1: "Completa todos los campos" });
      return;
    }
    if (password.length < 6) {
      Toast.show({ type: "error", text1: "Contrasena muy corta", text2: "Minimo 6 caracteres" });
      return;
    }
    setLoading(true);
    try {
      await register(telefono.trim(), nombre.trim(), password);
    } catch (err: any) {
      Toast.show({ type: "error", text1: "Error", text2: err.message || "No se pudo crear la cuenta" });
    } finally {
      setLoading(false);
    }
  };

  const InputField = ({ label, icon, placeholder, value, onChangeText, keyboardType, secureTextEntry, showToggle }: any) => (
    <View style={{ gap: 4, marginBottom: 12 }}>
      <Text style={{ fontSize: 10, fontWeight: "700", color: "#6D7B6C", textTransform: "uppercase", letterSpacing: 1, marginLeft: 16 }}>
        {label}
      </Text>
      <View className="flex-row items-center" style={{ backgroundColor: "#F4F4F0", borderRadius: 999, paddingHorizontal: 20, paddingVertical: 14 }}>
        <Text style={{ fontSize: 18, marginRight: 12, color: "#6D7B6C" }}>{icon}</Text>
        <TextInput
          className="flex-1 text-base"
          style={{ color: "#1A1C1A" }}
          placeholder={placeholder}
          placeholderTextColor="#BCCABA"
          keyboardType={keyboardType || "default"}
          secureTextEntry={secureTextEntry}
          value={value}
          onChangeText={onChangeText}
          autoCapitalize={keyboardType === "phone-pad" || keyboardType === "email-address" ? "none" : "words"}
        />
        {showToggle && (
          <Pressable onPress={() => setShowPass(!showPass)}>
            <Text style={{ fontSize: 18, color: "#6D7B6C" }}>{showPass ? "🙈" : "👁️"}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );

  return (
    <View className="flex-1" style={{ backgroundColor: "#FFFFFF" }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo */}
          <View className="items-center mb-8">
            <View
              className="items-center justify-center mb-4"
              style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: "#F4F4F0" }}
            >
              <Text style={{ fontSize: 28 }}>🍾</Text>
            </View>
            <View className="flex-row items-baseline">
              <Text style={{ fontWeight: "800", fontSize: 28, color: "#D33587" }}>Estanco</Text>
              <Text style={{ fontWeight: "800", fontSize: 28, color: "#1FAF55", marginLeft: 4 }}>Caquetá</Text>
            </View>
            <Text style={{ fontWeight: "900", fontSize: 18, color: "#D33587", letterSpacing: 4, fontStyle: "italic", marginTop: -2 }}>
              EXPRESS
            </Text>
            <Text style={{ color: "#6D7B6C", fontSize: 13, marginTop: 12 }}>
              Tu licorera favorita en minutos
            </Text>
          </View>

          {/* Form */}
          <InputField label="Nombre Completo" icon="👤" placeholder="Ej. Juan Pérez" value={nombre} onChangeText={setNombre} />
          <InputField label="Número de Teléfono" icon="📱" placeholder="+57 300 000 0000" value={telefono} onChangeText={setTelefono} keyboardType="phone-pad" />
          <InputField label="Contraseña" icon="🔒" placeholder="••••••••" value={password} onChangeText={setPassword} secureTextEntry={!showPass} showToggle />

          {/* Button */}
          <Pressable
            onPress={handleRegister}
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
              {loading ? "Creando cuenta..." : "Crear Cuenta"}
            </Text>
          </Pressable>

          {/* Login link */}
          <View className="items-center mt-6">
            <View className="flex-row">
              <Text style={{ color: "#6D7B6C", fontSize: 13 }}>¿Ya tienes una cuenta? </Text>
              <Link href="/(auth)/login" asChild>
                <Pressable>
                  <Text style={{ color: "#D33587", fontSize: 13, fontWeight: "700" }}>Inicia sesión</Text>
                </Pressable>
              </Link>
            </View>
          </View>

          {/* Divider */}
          <View className="flex-row items-center my-8">
            <View className="flex-1" style={{ height: 1, backgroundColor: "rgba(188,202,186,0.2)" }} />
            <Text style={{ color: "#6D7B6C", fontSize: 9, fontWeight: "700", letterSpacing: 2, textTransform: "uppercase", marginHorizontal: 12 }}>
              O continúa con
            </Text>
            <View className="flex-1" style={{ height: 1, backgroundColor: "rgba(188,202,186,0.2)" }} />
          </View>

          {/* Social */}
          <View className="flex-row" style={{ gap: 12 }}>
            <Pressable
              className="flex-1 flex-row items-center justify-center py-3.5"
              style={{ borderRadius: 999, borderWidth: 1, borderColor: "rgba(188,202,186,0.3)", backgroundColor: "#fff" }}
            >
              <Text style={{ fontSize: 14, marginRight: 8 }}>🔵</Text>
              <Text style={{ fontSize: 13, fontWeight: "700", color: "#1A1C1A" }}>Google</Text>
            </Pressable>
            <Pressable
              className="flex-1 flex-row items-center justify-center py-3.5"
              style={{ borderRadius: 999, backgroundColor: "#1877F2" }}
            >
              <Text style={{ fontSize: 14, marginRight: 8 }}>📘</Text>
              <Text style={{ fontSize: 13, fontWeight: "700", color: "#fff" }}>Facebook</Text>
            </Pressable>
          </View>

          {/* Terms */}
          <View className="items-center mt-8">
            <Text style={{ fontSize: 9, color: "#6D7B6C", textAlign: "center", letterSpacing: 1, textTransform: "uppercase", lineHeight: 14 }}>
              Al registrarte, aceptas nuestros Términos de Servicio y Política de Privacidad.
            </Text>
            <View className="flex-row mt-4" style={{ gap: 6 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#1FAF55" }} />
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#D33587" }} />
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#1FAF55" }} />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
