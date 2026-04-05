import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
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
      Toast.show({ type: "error", text1: "Error", text2: err.message || "No se pudo iniciar sesion" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-brand-900"
    >
      <View className="flex-1 justify-center px-6">
        <Text className="text-4xl font-bold text-white text-center mb-2">
          Estanco Caqueta
        </Text>
        <Text className="text-lg text-brand-200 text-center mb-10">
          Express
        </Text>

        <View className="bg-white rounded-2xl p-6 gap-4">
          <Text className="text-lg font-semibold text-gray-800">
            Iniciar sesion
          </Text>

          <TextInput
            className="border border-gray-300 rounded-xl px-4 py-3 text-base"
            placeholder="Telefono (ej: 3155519216)"
            keyboardType="phone-pad"
            value={telefono}
            onChangeText={setTelefono}
            autoCapitalize="none"
          />

          <TextInput
            className="border border-gray-300 rounded-xl px-4 py-3 text-base"
            placeholder="Contrasena"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <Pressable
            onPress={handleLogin}
            disabled={loading}
            className={`rounded-xl py-4 items-center ${
              loading ? "bg-gray-400" : "bg-brand-700"
            }`}
          >
            <Text className="text-white font-semibold text-base">
              {loading ? "Ingresando..." : "Ingresar"}
            </Text>
          </Pressable>

          <Link href="/(auth)/register" asChild>
            <Pressable className="py-2 items-center">
              <Text className="text-brand-700 text-sm">
                No tienes cuenta? Registrate
              </Text>
            </Pressable>
          </Link>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
