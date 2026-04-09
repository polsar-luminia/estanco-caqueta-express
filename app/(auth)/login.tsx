import { useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, KeyboardAvoidingView, Platform, Image } from "react-native";
import { Link } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import Toast from "react-native-toast-message";
import { useAuthStore } from "../../src/stores/auth";
import { tracker } from "../../src/lib/tracker";

export default function LoginScreen() {
  const [telefono, setTelefono] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);

  const handleLogin = async () => {
    if (!telefono || !password) {
      Toast.show({ type: "error", text1: "Ingresa tu telefono y contrasena" });
      return;
    }
    setLoading(true);
    try {
      await login(telefono.trim(), password);
      tracker.track('sesion_iniciada', {}, 'login');
    } catch (err: any) {
      Toast.show({ type: "error", text1: "Error", text2: err.message || "No se pudo iniciar sesion" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1">
      {/* Gradient background */}
      <LinearGradient
        colors={["#1FAF55", "rgba(31,175,85,0.08)", "#FAFAF6"]}
        locations={[0, 0.25, 0.5]}
        style={{ position: "absolute", width: "100%", height: "100%" }}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Card */}
          <View
            className="bg-white rounded-2xl p-8"
            style={{
              shadowColor: "#1A1C1A",
              shadowOffset: { width: 0, height: 12 },
              shadowOpacity: 0.06,
              shadowRadius: 32,
              elevation: 4,
            }}
          >
            {/* Logo */}
            <View className="items-center mb-8">
              <Image
                source={require("../../assets/logo-estanco.png")}
                style={{ width: 260, height: 104 }}
                resizeMode="contain"
              />
              <Text style={{ color: "#6D7B6C", fontSize: 13, marginTop: 12 }}>
                Tus licores favoritos en minutos.
              </Text>
            </View>

            {/* Phone */}
            <View style={{ gap: 4, marginBottom: 16 }}>
              <Text style={{ fontSize: 10, fontWeight: "700", color: "#6D7B6C", textTransform: "uppercase", letterSpacing: 1, marginLeft: 4 }}>
                Número de Teléfono
              </Text>
              <View className="flex-row items-center rounded-2xl" style={{ backgroundColor: "#E2E3DF", paddingHorizontal: 16, paddingVertical: 14 }}>
                <Text style={{ fontSize: 18, marginRight: 10, color: "#6D7B6C" }}>📱</Text>
                <TextInput
                  className="flex-1 text-base"
                  style={{ color: "#1A1C1A" }}
                  placeholder="300 000 0000"
                  placeholderTextColor="#BCCABA"
                  keyboardType="phone-pad"
                  value={telefono}
                  onChangeText={setTelefono}
                  autoCapitalize="none"
                />
              </View>
            </View>

            {/* Password */}
            <View style={{ gap: 4, marginBottom: 8 }}>
              <Text style={{ fontSize: 10, fontWeight: "700", color: "#6D7B6C", textTransform: "uppercase", letterSpacing: 1, marginLeft: 4 }}>
                Contraseña
              </Text>
              <View className="flex-row items-center rounded-2xl" style={{ backgroundColor: "#E2E3DF", paddingHorizontal: 16, paddingVertical: 14 }}>
                <Text style={{ fontSize: 18, marginRight: 10, color: "#6D7B6C" }}>🔒</Text>
                <TextInput
                  className="flex-1 text-base"
                  style={{ color: "#1A1C1A" }}
                  placeholder="••••••••"
                  placeholderTextColor="#BCCABA"
                  secureTextEntry={!showPass}
                  value={password}
                  onChangeText={setPassword}
                />
                <Pressable onPress={() => setShowPass(!showPass)}>
                  <Text style={{ fontSize: 18, color: "#6D7B6C" }}>{showPass ? "🙈" : "👁️"}</Text>
                </Pressable>
              </View>
              <Text className="self-end mt-1" style={{ fontSize: 11, color: "#1FAF55", fontWeight: "500" }}>
                ¿Olvidaste tu contraseña?
              </Text>
            </View>

            {/* Button */}
            <Pressable
              onPress={handleLogin}
              disabled={loading}
              className="items-center rounded-xl mt-4"
              style={{
                backgroundColor: loading ? "#9E9E9E" : "#1FAF55",
                paddingVertical: 16,
                shadowColor: "#1FAF55",
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.2,
                shadowRadius: 16,
                elevation: 4,
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 17 }}>
                {loading ? "Ingresando..." : "Ingresar"}
              </Text>
            </Pressable>

            {/* Footer */}
            <View className="items-center mt-8">
              <View className="flex-row">
                <Text style={{ color: "#6D7B6C", fontSize: 13 }}>¿No tienes una cuenta? </Text>
                <Link href="/(auth)/register" asChild>
                  <Pressable>
                    <Text style={{ color: "#D33587", fontSize: 13, fontWeight: "700" }}>Regístrate</Text>
                  </Pressable>
                </Link>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
