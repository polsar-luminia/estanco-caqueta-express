import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Link } from "expo-router";
import Toast from "react-native-toast-message";
import { useAuthStore } from "../../src/stores/auth";

export default function LoginScreen() {
  const [telefono, setTelefono] = useState("");
  const [password, setPassword] = useState("");
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
    } catch (err: any) {
      Toast.show({
        type: "error",
        text1: "Error",
        text2: err.message || "No se pudo iniciar sesion",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1">
      <LinearGradient
        colors={["#1FAF55", "#FAFAF6"]}
        locations={[0, 0.45]}
        className="absolute top-0 left-0 right-0 bottom-0"
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
          keyboardShouldPersistTaps="handled"
          className="flex-1 px-6"
        >
          {/* --- Card --- */}
          <View
            className="bg-white rounded-2xl p-8"
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.08,
              shadowRadius: 16,
              elevation: 6,
            }}
          >
            {/* --- Logo --- */}
            <View className="items-center mb-6">
              {/* Icono placeholder */}
              <View className="w-16 h-16 rounded-2xl bg-[#1FAF55] items-center justify-center mb-3">
                <Text className="text-white text-2xl font-bold">EC</Text>
              </View>

              <View className="flex-row items-baseline">
                <Text className="text-3xl font-extrabold text-[#D33587]">
                  Estanco
                </Text>
                <Text className="text-3xl font-extrabold text-[#1FAF55] ml-2">
                  Caqueta
                </Text>
              </View>

              <View className="bg-[#1FAF55] rounded-md px-4 py-1 mt-1">
                <Text className="text-white text-xs font-bold tracking-widest">
                  EXPRESS
                </Text>
              </View>

              <Text className="text-sm text-gray-500 mt-3">
                Tus licores favoritos en minutos.
              </Text>
            </View>

            {/* --- Inputs --- */}
            <View className="gap-4 mb-4">
              {/* Telefono */}
              <View className="relative">
                <View className="absolute left-4 top-0 bottom-0 justify-center z-10">
                  <Text className="text-gray-400 text-base">📱</Text>
                </View>
                <TextInput
                  className="border border-gray-200 rounded-xl pl-12 pr-4 py-3.5 text-base text-gray-800 bg-gray-50"
                  placeholder="Telefono (ej: 3155519216)"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="phone-pad"
                  value={telefono}
                  onChangeText={setTelefono}
                  autoCapitalize="none"
                />
              </View>

              {/* Contrasena */}
              <View className="relative">
                <View className="absolute left-4 top-0 bottom-0 justify-center z-10">
                  <Text className="text-gray-400 text-base">🔒</Text>
                </View>
                <TextInput
                  className="border border-gray-200 rounded-xl pl-12 pr-4 py-3.5 text-base text-gray-800 bg-gray-50"
                  placeholder="Contrasena"
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                />
              </View>
            </View>

            {/* Olvidaste tu contrasena */}
            <Pressable className="self-end mb-6">
              <Text className="text-[#D33587] text-xs font-medium">
                Olvidaste tu contrasena?
              </Text>
            </Pressable>

            {/* Boton Ingresar */}
            <Pressable
              onPress={handleLogin}
              disabled={loading}
              className={`rounded-xl py-4 items-center ${
                loading ? "bg-gray-400" : "bg-[#1FAF55]"
              }`}
              style={{
                shadowColor: "#1FAF55",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 4,
              }}
            >
              <Text className="text-white font-bold text-base">
                {loading ? "Ingresando..." : "Ingresar"}
              </Text>
            </Pressable>

            {/* --- Divider --- */}
            <View className="flex-row items-center my-6">
              <View className="flex-1 h-px bg-gray-200" />
              <Text className="mx-4 text-xs text-gray-400">
                O continua con
              </Text>
              <View className="flex-1 h-px bg-gray-200" />
            </View>

            {/* --- Social buttons --- */}
            <View className="flex-row gap-3">
              <Pressable
                className="flex-1 flex-row items-center justify-center border border-gray-200 rounded-xl py-3"
              >
                <Text className="text-sm font-medium text-gray-600">
                  Google
                </Text>
              </Pressable>
              <Pressable
                className="flex-1 flex-row items-center justify-center border border-gray-200 rounded-xl py-3"
              >
                <Text className="text-sm font-medium text-gray-600">
                  Facebook
                </Text>
              </Pressable>
            </View>

            {/* --- Footer link --- */}
            <View className="flex-row justify-center mt-6">
              <Text className="text-sm text-gray-500">
                No tienes cuenta?{" "}
              </Text>
              <Link href="/(auth)/register" asChild>
                <Pressable>
                  <Text className="text-sm font-semibold text-[#D33587]">
                    Registrate
                  </Text>
                </Pressable>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
