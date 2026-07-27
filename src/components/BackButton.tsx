import { Pressable, Text } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";

export function BackButton({ style }: { style?: object }) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.back()}
      accessibilityRole="button"
      accessibilityLabel="Volver"
      // La flecha mas el texto no llegan a 44 pt de alto; hitSlop agranda el area
      // util sin mover el diseño de los encabezados donde vive.
      hitSlop={12}
      style={[{ flexDirection: "row", alignItems: "center", gap: 4, minHeight: 44 }, style]}
    >
      <Feather name="chevron-left" size={22} color="#1A1C1A" />
      <Text style={{ fontSize: 15, fontWeight: "600", color: "#1A1C1A" }}>Volver</Text>
    </Pressable>
  );
}
