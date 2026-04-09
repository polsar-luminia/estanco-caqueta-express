import { View, Text, ScrollView } from "react-native";
import { Stack } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { BackButton } from "../../src/components/BackButton";

const METODOS = [
  {
    icon: "dollar-sign" as const,
    titulo: "Efectivo",
    descripcion: "Paga en billetes al domiciliario cuando recibas tu pedido.",
    color: "#1FAF55",
    bg: "rgba(31,175,85,0.08)",
  },
  {
    icon: "smartphone" as const,
    titulo: "Código QR",
    descripcion: "El domiciliario lleva un código QR para pagar con Nequi, Daviplata o cualquier app bancaria.",
    color: "#D33587",
    bg: "rgba(211,53,135,0.08)",
  },
  {
    icon: "credit-card" as const,
    titulo: "Datáfono",
    descripcion: "Tarjeta débito o crédito. El domiciliario lleva datáfono inalámbrico para pagar contra entrega.",
    color: "#6366F1",
    bg: "rgba(99,102,241,0.08)",
  },
];

export default function MetodosPagoScreen() {
  return (
    <View className="flex-1" style={{ backgroundColor: "#FAFAF6" }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", paddingTop: 56, paddingBottom: 16, paddingHorizontal: 16, backgroundColor: "#FAFAF6", borderBottomWidth: 1, borderBottomColor: "#EFEFEB" }}>
        <BackButton style={{ paddingRight: 16 }} />
        <Text style={{ flex: 1, fontSize: 17, fontWeight: "800", color: "#1A1C1A", textAlign: "center", marginRight: 60 }}>
          Métodos de Pago
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
        <View style={{ backgroundColor: "#1A1C1A", borderRadius: 16, padding: 20, marginBottom: 4 }}>
          <Text style={{ fontSize: 10, fontWeight: "700", color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: 2, marginBottom: 8 }}>
            Todo contra entrega
          </Text>
          <Text style={{ fontSize: 16, fontWeight: "700", color: "#fff", lineHeight: 22 }}>
            Paga cuando recibas tu pedido. No manejamos pagos anticipados.
          </Text>
        </View>

        {METODOS.map((m) => (
          <View key={m.titulo} style={{ backgroundColor: "#fff", borderRadius: 16, padding: 20, flexDirection: "row", alignItems: "flex-start", gap: 16, borderWidth: 1, borderColor: "#F4F4F0" }}>
            <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: m.bg, alignItems: "center", justifyContent: "center" }}>
              <Feather name={m.icon} size={20} color={m.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: "700", color: "#1A1C1A", marginBottom: 4 }}>{m.titulo}</Text>
              <Text style={{ fontSize: 13, color: "#6D7B6C", lineHeight: 19 }}>{m.descripcion}</Text>
            </View>
          </View>
        ))}

        <View style={{ backgroundColor: "#F4F4F0", borderRadius: 12, padding: 16, marginTop: 8 }}>
          <Text style={{ fontSize: 12, color: "#6D7B6C", textAlign: "center", lineHeight: 18 }}>
            ¿Preguntas sobre tu pago? Escríbenos por WhatsApp y te ayudamos de inmediato.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
