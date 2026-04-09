import { Pressable, Text } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";

export function BackButton({ style }: { style?: object }) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.back()}
      style={[{ flexDirection: "row", alignItems: "center", gap: 4 }, style]}
    >
      <Feather name="chevron-left" size={22} color="#1A1C1A" />
      <Text style={{ fontSize: 15, fontWeight: "600", color: "#1A1C1A" }}>Volver</Text>
    </Pressable>
  );
}
