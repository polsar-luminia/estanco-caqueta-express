import { View, Text, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { colors } from "../../src/constants/theme";

const SECTIONS = [
  {
    title: "1. Identificación del Responsable",
    body: "Organización Polo & Salazar ZOMAC S.A.S.\nNIT: 901.327.818-0\nDirección: Carrera 10 #16-86, Florencia, Caquetá, Colombia\nCorreo: app@estancocaqueta.com\nTeléfono: +57 318 949 5704",
  },
  {
    title: "2. Objeto y Aceptación",
    body: "Los presentes Términos y Condiciones regulan el uso de la aplicación móvil Estanco Caquetá Express y los servicios de venta y entrega a domicilio de bebidas alcohólicas, snacks y productos complementarios en la ciudad de Florencia, Caquetá.\n\nAl registrarse y utilizar la aplicación, el usuario acepta íntegramente estos términos.",
  },
  {
    title: "3. Requisitos de Uso",
    body: "• Ser mayor de 18 años conforme a la legislación colombiana.\n• Proporcionar datos verídicos al momento del registro.\n• El domiciliario verificará el documento de identidad del comprador antes de entregar productos restringidos a mayores de 18 años (licor, tabaco, vapes), conforme a las Leyes 124 de 1994 y 1335 de 2009.\n• La venta de bebidas embriagantes y productos derivados del tabaco a menores de edad está prohibida por las leyes colombianas.",
  },
  {
    title: "4. Productos y Precios",
    body: "• Los precios se expresan en pesos colombianos (COP) e incluyen impuestos aplicables.\n• Los precios pueden variar sin previo aviso.\n• La disponibilidad de productos está sujeta al inventario en tiempo real.\n• Las imágenes son de referencia y pueden diferir del producto real.",
  },
  {
    title: "5. Pedidos y Entrega",
    body: "• Pedido mínimo: $30.000 COP.\n• Cobertura: casco urbano de Florencia, Caquetá.\n• Horarios de entrega: Lunes a Jueves 7am-12m y 2pm-7pm, Viernes 7am-12m y 2pm-12am, Sábado 7am-12am, Domingos 9am-4:30pm. El horario vigente siempre se muestra en la app.\n• Pedidos realizados después del horario se despachan al siguiente día hábil.\n• Pago contra entrega: efectivo, transferencia por código QR o datáfono (tarjeta débito/crédito).\n• Costo de envío: $5.000 COP (puede canjearse con puntos del programa de fidelización).",
  },
  {
    title: "6. Cancelaciones y Devoluciones",
    body: "• El usuario puede cancelar su pedido mientras esté en estado 'Recibido'.\n• Una vez el pedido esté en preparación o en camino, no se aceptan cancelaciones.\n• En caso de productos defectuosos o errores en el pedido, el usuario debe reportarlo dentro de las 2 horas siguientes a la entrega vía WhatsApp.\n• Se realizará reemplazo del producto o reembolso según el caso.",
  },
  {
    title: "7. Protección de Datos Personales",
    body: "El tratamiento de datos personales se rige por la Ley 1581 de 2012 y el Decreto 1377 de 2013.\n\nDatos recopilados: nombre, teléfono, dirección de entrega, historial de pedidos.\n\nFinalidades: gestión de pedidos, entregas, comunicación operativa sobre tus pedidos y mejora del servicio.\n\nComunicaciones comerciales: el envío de promociones y ofertas por notificación push o por WhatsApp requiere una autorización aparte, que es opcional. No otorgarla no limita tu uso de la aplicación ni tu posibilidad de comprar, y puedes revocarla cuando quieras desde Perfil › Notificaciones y comunicaciones. Aun sin ella seguirás recibiendo los mensajes operativos de tus pedidos y los códigos de verificación, porque son parte del servicio. El detalle está en la Política de Privacidad.\n\nDerechos del titular: conocer, actualizar, rectificar y suprimir datos enviando solicitud a app@estancocaqueta.com.\n\nTiempos de respuesta: consultas 10 días hábiles, reclamos 15 días hábiles.",
  },
  {
    title: "8. Propiedad Intelectual",
    body: "Todos los contenidos de la aplicación (diseños, logotipos, textos, imágenes) son propiedad de Organización Polo & Salazar ZOMAC S.A.S. y están protegidos por las leyes de propiedad intelectual colombianas.",
  },
  {
    title: "9. Limitación de Responsabilidad",
    body: "• La empresa no se responsabiliza por interrupciones del servicio debido a causas de fuerza mayor.\n• La empresa no garantiza disponibilidad ininterrumpida de la aplicación.\n• El usuario es responsable de la veracidad de los datos proporcionados, especialmente la dirección de entrega.",
  },
  {
    title: "10. Ley Aplicable",
    body: "Estos términos se rigen por las leyes de la República de Colombia. Cualquier controversia se resolverá ante los tribunales competentes de Florencia, Caquetá.\n\nBeber con moderación. Prohíbase el expendio de bebidas embriagantes a menores de edad. El exceso de alcohol es perjudicial para la salud.",
  },
];

export default function TermsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1" style={{ backgroundColor: colors.bg }}>
      {/* Header */}
      <View className="flex-row items-center px-4 pb-2" style={{ gap: 12, paddingTop: insets.top + 8 }}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={11}
          accessibilityRole="button"
          accessibilityLabel="Volver a la pantalla anterior"
        >
          <Feather name="arrow-left" size={22} color={colors.ink} />
        </Pressable>
        <Text style={{ fontSize: 18, fontWeight: "700", color: colors.ink }}>Términos y Condiciones</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* Header info */}
        <View className="rounded-2xl p-5 mb-5" style={{ backgroundColor: colors.lowfill }}>
          <Text style={{ fontSize: 12, fontWeight: "700", color: colors.muted, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>
            Última actualización
          </Text>
          <Text style={{ fontSize: 14, fontWeight: "600", color: colors.ink }}>Octubre 3, 2025</Text>
          <Text style={{ fontSize: 12, color: colors.muted, marginTop: 8, lineHeight: 18 }}>
            Al usar Estanco Caquetá Express, aceptas los siguientes términos y condiciones que regulan el servicio.
          </Text>
        </View>

        {/* Sections */}
        <View style={{ gap: 20 }}>
          {SECTIONS.map((sec, i) => (
            <View key={i}>
              <Text style={{ fontSize: 15, fontWeight: "700", color: colors.ink, marginBottom: 8 }}>
                {sec.title}
              </Text>
              <Text style={{ fontSize: 13, color: colors.muted, lineHeight: 20 }}>
                {sec.body}
              </Text>
            </View>
          ))}
        </View>

        {/* Footer */}
        <View className="items-center mt-8">
          <Text style={{ fontSize: 12, color: colors.faint, textAlign: "center", letterSpacing: 1, textTransform: "uppercase" }}>
            Organización Polo & Salazar ZOMAC S.A.S.
          </Text>
          <Text style={{ fontSize: 12, color: colors.faint, marginTop: 2 }}>
            NIT 901.327.818-0 • Florencia, Caquetá
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
