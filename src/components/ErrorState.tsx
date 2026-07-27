import { View, Text, Pressable } from "react-native";

interface Props {
  mensaje?: string;
  onRetry?: () => void;
}

export function ErrorState({ mensaje = "No pudimos cargar la información", onRetry }: Props) {
  return (
    <View style={{ alignItems: "center", justifyContent: "center", padding: 32 }}>
      <Text style={{ fontSize: 40, marginBottom: 12 }}>😕</Text>
      <Text style={{ fontSize: 16, fontWeight: "600", color: "#1F1F1F", marginBottom: 6, textAlign: "center" }}>
        {mensaje}
      </Text>
      <Text style={{ fontSize: 13, color: "#6B6B6B", textAlign: "center", marginBottom: 20 }}>
        Verifica tu conexión e intenta de nuevo
      </Text>
      {onRetry && (
        <Pressable
          onPress={onRetry}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="Reintentar la carga"
          style={{ backgroundColor: "#1FAF55", paddingHorizontal: 28, paddingVertical: 10, borderRadius: 999 }}
        >
          <Text style={{ color: "white", fontWeight: "600", fontSize: 14 }}>Reintentar</Text>
        </Pressable>
      )}
    </View>
  );
}
