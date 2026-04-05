import { useState } from "react";
import { View, Text, ScrollView, Pressable, Linking } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";

const FAQ = [
  {
    q: "¿Cuál es el pedido mínimo?",
    a: "El pedido mínimo es de $30.000 COP para entregas a domicilio en Florencia.",
  },
  {
    q: "¿Cuánto tarda la entrega?",
    a: "Nuestro servicio express entrega en 15-20 minutos dentro de Florencia. En zonas más alejadas puede tomar hasta 45 minutos.",
  },
  {
    q: "¿Cuáles son los horarios de entrega?",
    a: "Lunes a Jueves: 8:00 a.m. – 7:00 p.m.\nViernes y Sábado: 8:00 a.m. – 12:00 a.m.\nDomingos: 9:00 a.m. – 4:30 p.m.\nFestivos: 9:30 a.m. – 5:00 p.m.\n\nPedidos después del cierre se despachan al siguiente día.",
  },
  {
    q: "¿Qué métodos de pago aceptan?",
    a: "Actualmente aceptamos pago contra entrega en efectivo. Pronto habilitaremos pagos con tarjeta y transferencias.",
  },
  {
    q: "¿Puedo cancelar mi pedido?",
    a: "Sí, puedes cancelar tu pedido mientras esté en estado 'Recibido'. Una vez en preparación o en camino, no es posible cancelar.",
  },
  {
    q: "¿Qué hago si mi pedido llega incompleto o dañado?",
    a: "Contáctanos inmediatamente por WhatsApp al 315 551 9216. Tomaremos una foto del problema y te enviaremos un reemplazo o reembolso.",
  },
  {
    q: "¿Venden a menores de edad?",
    a: "No. La venta de bebidas alcohólicas y tabaco está prohibida a menores de 18 años conforme a la ley colombiana. El domiciliario puede solicitar identificación.",
  },
  {
    q: "¿Tienen servicio en municipios cercanos?",
    a: "Por ahora solo operamos en el casco urbano de Florencia. Estamos trabajando para expandirnos a Morelia, Belén y otros municipios.",
  },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Pressable
      onPress={() => setOpen(!open)}
      className="bg-white rounded-2xl overflow-hidden"
      style={{
        shadowColor: "#1A1C1A", shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.03, shadowRadius: 12, elevation: 1,
      }}
    >
      <View className="flex-row items-center justify-between p-4">
        <Text style={{ flex: 1, fontSize: 14, fontWeight: "600", color: "#1A1C1A", marginRight: 12 }}>{q}</Text>
        <Feather name={open ? "chevron-up" : "chevron-down"} size={18} color="#1FAF55" />
      </View>
      {open && (
        <View className="px-4 pb-4">
          <View style={{ height: 1, backgroundColor: "#F4F4F0", marginBottom: 12 }} />
          <Text style={{ fontSize: 13, color: "#6D7B6C", lineHeight: 20 }}>{a}</Text>
        </View>
      )}
    </Pressable>
  );
}

export default function HelpScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-white">
      {/* Header */}
      <View className="flex-row items-center px-4 pt-4 pb-2" style={{ gap: 12 }}>
        <Pressable onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color="#1A1C1A" />
        </Pressable>
        <Text style={{ fontSize: 18, fontWeight: "700", color: "#1A1C1A" }}>Centro de Ayuda</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 20 }}>
        {/* Contact Card */}
        <View className="rounded-2xl p-5" style={{ backgroundColor: "#F4F4F0" }}>
          <Text style={{ fontSize: 18, fontWeight: "700", color: "#1A1C1A", marginBottom: 4 }}>
            ¿Necesitas ayuda?
          </Text>
          <Text style={{ fontSize: 13, color: "#6D7B6C", marginBottom: 16 }}>
            Estamos disponibles para resolver cualquier duda o problema con tu pedido.
          </Text>

          <Pressable
            onPress={() => Linking.openURL("https://wa.me/573155519216")}
            className="flex-row items-center justify-center py-3.5 rounded-xl mb-3"
            style={{ backgroundColor: "#25D366" }}
          >
            <Text style={{ fontSize: 18, marginRight: 8 }}>💬</Text>
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>WhatsApp: 315 551 9216</Text>
          </Pressable>

          <Pressable
            onPress={() => Linking.openURL("tel:+573155519216")}
            className="flex-row items-center justify-center py-3.5 rounded-xl"
            style={{ backgroundColor: "#fff" }}
          >
            <Feather name="phone" size={16} color="#1FAF55" />
            <Text style={{ color: "#1A1C1A", fontWeight: "600", fontSize: 14, marginLeft: 8 }}>Llamar</Text>
          </Pressable>
        </View>

        {/* Business Info */}
        <View className="rounded-2xl p-5 bg-white" style={{ borderWidth: 1, borderColor: "#F4F4F0" }}>
          <Text style={{ fontSize: 14, fontWeight: "700", color: "#1A1C1A", marginBottom: 12 }}>Información</Text>

          <View style={{ gap: 10 }}>
            <View className="flex-row" style={{ gap: 10 }}>
              <Feather name="map-pin" size={16} color="#1FAF55" style={{ marginTop: 2 }} />
              <Text style={{ fontSize: 13, color: "#6D7B6C", flex: 1 }}>Carrera 10 #16-86, Florencia, Caquetá</Text>
            </View>
            <View className="flex-row" style={{ gap: 10 }}>
              <Feather name="mail" size={16} color="#1FAF55" style={{ marginTop: 2 }} />
              <Text style={{ fontSize: 13, color: "#6D7B6C" }}>Pys-marketexpress@hotmail.com</Text>
            </View>
            <View className="flex-row" style={{ gap: 10 }}>
              <Feather name="clock" size={16} color="#1FAF55" style={{ marginTop: 2 }} />
              <View>
                <Text style={{ fontSize: 13, color: "#6D7B6C" }}>Lun-Jue: 8am – 7pm</Text>
                <Text style={{ fontSize: 13, color: "#6D7B6C" }}>Vie-Sáb: 8am – 12am</Text>
                <Text style={{ fontSize: 13, color: "#6D7B6C" }}>Dom: 9am – 4:30pm</Text>
                <Text style={{ fontSize: 13, color: "#6D7B6C" }}>Festivos: 9:30am – 5pm</Text>
              </View>
            </View>
          </View>
        </View>

        {/* FAQ */}
        <View>
          <Text style={{ fontSize: 18, fontWeight: "700", color: "#1A1C1A", marginBottom: 12 }}>
            Preguntas Frecuentes
          </Text>
          <View style={{ gap: 10 }}>
            {FAQ.map((item, i) => (
              <FaqItem key={i} q={item.q} a={item.a} />
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
