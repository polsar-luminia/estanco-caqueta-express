import { View, Text, Pressable, Linking, Alert } from "react-native";
import { useAuthStore } from "../../src/stores/auth";
import { WHATSAPP_SOPORTE } from "../../src/constants/config";

export default function ProfileScreen() {
  const cliente = useAuthStore((s) => s.cliente);
  const logout = useAuthStore((s) => s.logout);

  const handleLogout = () => {
    Alert.alert("Cerrar sesion", "Quieres salir de tu cuenta?", [
      { text: "No" },
      { text: "Si", style: "destructive", onPress: logout },
    ]);
  };

  return (
    <View className="flex-1 bg-gray-50 p-4">
      <View className="bg-white rounded-xl p-4 mb-4">
        <Text className="text-xl font-bold text-gray-800 mb-1">
          {cliente?.nombre}
        </Text>
        <Text className="text-sm text-gray-500">{cliente?.telefono}</Text>
        {cliente?.direccion && (
          <Text className="text-sm text-gray-500 mt-2">
            {cliente.direccion}
            {cliente.barrio ? ` - ${cliente.barrio}` : ""}
          </Text>
        )}
      </View>

      <Pressable
        onPress={() => Linking.openURL(WHATSAPP_SOPORTE)}
        className="bg-white rounded-xl p-4 mb-3 flex-row items-center"
      >
        <Text className="text-base text-green-700 flex-1">
          Soporte por WhatsApp
        </Text>
        <Text className="text-gray-400">{">"}</Text>
      </Pressable>

      <Pressable
        onPress={handleLogout}
        className="bg-white rounded-xl p-4 items-center mt-4"
      >
        <Text className="text-red-600 font-medium">Cerrar sesion</Text>
      </Pressable>

      <Text className="text-xs text-gray-400 text-center mt-8">
        Estanco Caqueta Express v1.0.0
      </Text>
    </View>
  );
}
