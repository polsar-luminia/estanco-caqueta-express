import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { Link } from "expo-router";
import { useAuthStore } from "../../src/stores/auth";

export default function RegisterScreen() {
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const register = useAuthStore((s) => s.register);

  const handleRegister = async () => {
    if (!nombre || !telefono || !password) {
      Alert.alert("Error", "Completa todos los campos");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Error", "La contrasena debe tener al menos 6 caracteres");
      return;
    }
    setLoading(true);
    try {
      await register(telefono.trim(), nombre.trim(), password);
    } catch (err: any) {
      Alert.alert("Error", err.message || "No se pudo crear la cuenta");
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
          Crear cuenta
        </Text>
        <Text className="text-base text-brand-200 text-center mb-10">
          Pide a domicilio en Florencia
        </Text>

        <View className="bg-white rounded-2xl p-6 gap-4">
          <TextInput
            className="border border-gray-300 rounded-xl px-4 py-3 text-base"
            placeholder="Tu nombre"
            value={nombre}
            onChangeText={setNombre}
          />

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
            placeholder="Contrasena (minimo 6 caracteres)"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <Pressable
            onPress={handleRegister}
            disabled={loading}
            className={`rounded-xl py-4 items-center ${
              loading ? "bg-gray-400" : "bg-brand-700"
            }`}
          >
            <Text className="text-white font-semibold text-base">
              {loading ? "Creando cuenta..." : "Registrarme"}
            </Text>
          </Pressable>

          <Link href="/(auth)/login" asChild>
            <Pressable className="py-2 items-center">
              <Text className="text-brand-700 text-sm">
                Ya tienes cuenta? Inicia sesion
              </Text>
            </Pressable>
          </Link>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
