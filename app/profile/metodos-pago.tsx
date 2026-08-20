import { View, Text, ScrollView } from "react-native";
import { Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { BackButton } from "../../src/components/BackButton";
import { colors, radii, shadows, fuentes } from "../../src/constants/theme";

const METODOS = [
  {
    icon: "dollar-sign" as const,
    titulo: "Efectivo",
    descripcion: "Paga en billetes al domiciliario cuando recibas tu pedido.",
    color: colors.green,
    bg: "rgba(31,175,85,0.08)",
  },
  {
    icon: "smartphone" as const,
    titulo: "Código QR",
    descripcion: "El domiciliario lleva un código QR para pagar con Nequi, Daviplata o cualquier app bancaria.",
    color: colors.pink,
    bg: "rgba(224,69,123,0.08)",
  },
  {
    icon: "credit-card" as const,
    titulo: "Datáfono",
    descripcion: "Tarjeta débito o crédito. El domiciliario lleva datáfono inalámbrico para pagar contra entrega.",
    color: colors.purple,
    bg: "rgba(124,92,255,0.08)",
  },
];

export default function MetodosPagoScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1" style={{ backgroundColor: colors.bg }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", paddingTop: insets.top + 12, paddingBottom: 16, paddingHorizontal: 16, backgroundColor: colors.bg, borderBottomWidth: 1, borderBottomColor: colors.line }}>
        <BackButton style={{ paddingRight: 16 }} />
        <Text style={{ flex: 1, fontSize: 17, fontFamily: fuentes.destacado, color: colors.ink, textAlign: "center", marginRight: 60 }}>
          Métodos de Pago
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
        <View style={{ backgroundColor: colors.ink, borderRadius: radii.card, padding: 20, marginBottom: 4 }}>
          <Text style={{ fontSize: 12, fontFamily: fuentes.destacado, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: 2, marginBottom: 8 }}>
            Todo contra entrega
          </Text>
          <Text style={{ fontSize: 16, fontFamily: fuentes.destacado, color: "#fff", lineHeight: 22 }}>
            Paga cuando recibas tu pedido. No manejamos pagos anticipados.
          </Text>
        </View>

        {METODOS.map((m) => (
          <View key={m.titulo} style={{ backgroundColor: colors.surface, borderRadius: radii.card, padding: 20, flexDirection: "row", alignItems: "flex-start", gap: 16, ...shadows.card }}>
            <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: m.bg, alignItems: "center", justifyContent: "center" }}>
              <Feather name={m.icon} size={20} color={m.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontFamily: fuentes.destacado, color: colors.ink, marginBottom: 4 }}>{m.titulo}</Text>
              <Text style={{ fontFamily: fuentes.destacado, fontSize: 13, color: colors.muted, lineHeight: 19 }}>{m.descripcion}</Text>
            </View>
          </View>
        ))}

        <View style={{ backgroundColor: colors.lowfill, borderRadius: 12, padding: 16, marginTop: 8 }}>
          <Text style={{ fontFamily: fuentes.destacado, fontSize: 12, color: colors.muted, textAlign: "center", lineHeight: 18 }}>
            ¿Preguntas sobre tu pago? Escríbenos por WhatsApp y te ayudamos de inmediato.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
