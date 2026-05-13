import { View, Text, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";

const SECTIONS = [
  {
    title: "1. Responsable del Tratamiento",
    body: "Organización Polo & Salazar ZOMAC S.A.S.\nNIT: 901.327.818-0\nDirección: Carrera 10 #16-86, Florencia, Caquetá, Colombia\nCorreo: app@estancocaqueta.com\nTeléfono: +57 318 949 5704",
  },
  {
    title: "2. Datos que Recopilamos",
    body: "Al registrarte y usar la aplicación, recopilamos los siguientes datos personales:\n\n• Nombre completo\n• Número de teléfono\n• Fecha de nacimiento\n• Dirección(es) de entrega\n• Historial de pedidos\n• Token de notificaciones push (para enviarte actualizaciones sobre tus pedidos y comunicaciones de marketing relacionadas con productos, promociones y recordatorios)\n• Comportamiento dentro de la aplicación (carritos abandonados, frecuencia de uso, productos vistos) para personalizar tus comunicaciones",
  },
  {
    title: "3. Finalidad del Tratamiento",
    body: "Tus datos personales son utilizados para:\n\n• Gestionar y procesar tus pedidos\n• Coordinar las entregas a domicilio\n• Enviarte notificaciones push sobre el estado de tus pedidos\n• Enviarte notificaciones push de marketing, incluyendo: recordatorios de carritos con productos pendientes (carrito abandonado), recomendaciones cuando llevas tiempo sin abrir la app (re-engagement) y promociones programadas en horarios específicos (por ejemplo, ofertas de fin de semana)\n• Estas comunicaciones de marketing están sujetas a una frecuencia máxima de 2 mensajes por semana y puedes desactivarlas en cualquier momento desde la configuración de tu dispositivo o solicitándolo a app@estancocaqueta.com\n• Mejorar la experiencia de la aplicación\n• Cumplir con las obligaciones legales aplicables, incluida la verificación de mayoría de edad conforme a la Ley 124 de 1994",
  },
  {
    title: "4. Base Legal",
    body: "El tratamiento de tus datos personales se realiza con fundamento en:\n\n• Tu consentimiento expreso otorgado al momento del registro (Ley 1581 de 2012, Art. 6, literal a).\n• Decreto 1377 de 2013, reglamentario de la Ley 1581.\n\nPuedes retirar tu consentimiento en cualquier momento enviando una solicitud a app@estancocaqueta.com, sin que ello afecte la licitud del tratamiento previo.",
  },
  {
    title: "5. Derechos del Titular",
    body: "Como titular de los datos personales tienes derecho a:\n\n• Conocer, actualizar y rectificar tus datos.\n• Solicitar la supresión de tus datos cuando no exista deber legal de conservarlos.\n• Ser informado sobre el uso que se da a tus datos.\n• Revocar la autorización y/o solicitar la supresión del dato.\n\nPara ejercer estos derechos, envía tu solicitud a:\napp@estancocaqueta.com\n\nTiempos de respuesta: consultas 10 días hábiles, reclamos 15 días hábiles.",
  },
  {
    title: "6. Vigencia y Seguridad",
    body: "Tus datos serán conservados mientras tu cuenta permanezca activa o mientras sea necesario para cumplir con las finalidades descritas o las obligaciones legales.\n\nImplementamos medidas técnicas y organizacionales para proteger tus datos contra acceso no autorizado, pérdida o divulgación indebida. Los datos se almacenan en servidores ubicados en la Unión Europea bajo estándares de seguridad reconocidos internacionalmente.",
  },
];

export default function PrivacyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-white">
      {/* Header */}
      <View className="flex-row items-center px-4 pb-2" style={{ gap: 12, paddingTop: insets.top + 8 }}>
        <Pressable onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color="#1A1C1A" />
        </Pressable>
        <Text style={{ fontSize: 18, fontWeight: "700", color: "#1A1C1A" }}>Política de Privacidad</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* Header info */}
        <View className="rounded-2xl p-5 mb-5" style={{ backgroundColor: "#F4F4F0" }}>
          <Text style={{ fontSize: 10, fontWeight: "700", color: "#6D7B6C", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>
            Última actualización
          </Text>
          <Text style={{ fontSize: 14, fontWeight: "600", color: "#1A1C1A" }}>8 de mayo de 2026</Text>
          <Text style={{ fontSize: 12, color: "#6D7B6C", marginTop: 8, lineHeight: 18 }}>
            Conoce cómo Polo & Salazar ZOMAC S.A.S. trata y protege tus datos personales conforme a la Ley 1581 de 2012.
          </Text>
        </View>

        {/* Sections */}
        <View style={{ gap: 20 }}>
          {SECTIONS.map((sec, i) => (
            <View key={i}>
              <Text style={{ fontSize: 15, fontWeight: "700", color: "#1A1C1A", marginBottom: 8 }}>
                {sec.title}
              </Text>
              <Text style={{ fontSize: 13, color: "#6D7B6C", lineHeight: 20 }}>
                {sec.body}
              </Text>
            </View>
          ))}
        </View>

        {/* Footer */}
        <View className="items-center mt-8">
          <Text style={{ fontSize: 10, color: "#BCCABA", textAlign: "center", letterSpacing: 1, textTransform: "uppercase" }}>
            Organización Polo & Salazar ZOMAC S.A.S.
          </Text>
          <Text style={{ fontSize: 10, color: "#BCCABA", marginTop: 2 }}>
            NIT 901.327.818-0 • Florencia, Caquetá
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
