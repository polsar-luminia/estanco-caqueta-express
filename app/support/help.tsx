import { useState, useMemo } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { MessageIcon } from "../../src/components/icons/AppIcons";
import { colors, shadows, fuentes } from "../../src/constants/theme";
import { useQuery } from "@tanstack/react-query";
import { useTiendaAbierta } from "../../src/hooks/useTiendaAbierta";
import { useSoporte } from "../../src/lib/soporte";
import { getConfigApp } from "../../src/lib/api";
import { MEDIOS_PAGO_RESPALDO } from "../../src/constants/config";
import { HORARIO_FALLBACK } from "../../src/components/BandaCerrado";

// Antes "¿Qué métodos de pago aceptan?" y el aviso de pedido incompleto
// tenían el catálogo y el número de soporte quemados aquí — una TERCERA
// fuente de verdad además de terms.tsx y metodos-pago.tsx. Ahora se arman en
// el componente con lo que sirve /configuracion-app (093): un solo lugar
// que puede desincronizarse, no tres.
const FAQ_ESTATICA = [
  {
    q: "¿Cuál es el pedido mínimo?",
    a: "El pedido mínimo es de $30.000 COP para entregas a domicilio en Florencia.",
  },
  {
    q: "¿Puedo cancelar mi pedido?",
    a: "Sí, puedes cancelar tu pedido mientras esté en estado 'Recibido'. Una vez en preparación o en camino, no es posible cancelar.",
  },
  {
    q: "¿Qué hago si mi pedido llega incompleto o dañado?",
    a: "Contáctanos inmediatamente por WhatsApp. Tomaremos una foto del problema y te enviaremos un reemplazo o reembolso.",
  },
  {
    q: "¿Venden a menores de edad?",
    a: "No. La venta de bebidas alcohólicas y tabaco está prohibida a menores de 18 años conforme a la ley colombiana. El domiciliario puede solicitar identificación.",
  },
  {
    q: "¿Dónde tienen cobertura?",
    a: "Operamos en el casco urbano de Florencia, Caquetá.",
  },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Pressable
      onPress={() => setOpen(!open)}
      accessibilityRole="button"
      accessibilityLabel={open ? `Contraer la respuesta de: ${q}` : `Ver la respuesta de: ${q}`}
      className="rounded-2xl overflow-hidden"
      style={{ backgroundColor: colors.surface, ...shadows.card }}
    >
      <View className="flex-row items-center justify-between p-4">
        <Text style={{ fontFamily: fuentes.destacado, flex: 1, fontSize: 14, color: colors.ink, marginRight: 12 }}>{q}</Text>
        <Feather name={open ? "chevron-up" : "chevron-down"} size={18} color={colors.green} />
      </View>
      {open && (
        <View className="px-4 pb-4">
          <View style={{ height: 1, backgroundColor: colors.line, marginBottom: 12 }} />
          <Text style={{ fontFamily: fuentes.destacado, fontSize: 13, color: colors.muted, lineHeight: 20 }}>{a}</Text>
        </View>
      )}
    </Pressable>
  );
}

export default function HelpScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // El horario lo configura el admin: se pide al backend en vez de quemarlo,
  // que es lo que hacía que esta pantalla quedara mintiendo tras cada cambio.
  const tienda = useTiendaAbierta();
  const horario = tienda.horario?.length ? tienda.horario : HORARIO_FALLBACK;
  const { telefono, correo, abrirWhatsApp, abrirTelefono } = useSoporte();

  // Mismo queryKey que cart.tsx y las demás: comparten caché.
  const { data: configApp } = useQuery({
    queryKey: ["config-app"],
    queryFn: getConfigApp,
    staleTime: 5 * 60 * 1000,
  });
  const mediosPago = configApp?.medios_pago ?? MEDIOS_PAGO_RESPALDO;

  // La pregunta de horarios se arma con el mismo dato que ve la banda de
  // cerrado, para que no puedan contradecirse. La de métodos de pago, con el
  // catálogo servido — así no hay un cuarto lugar que se desincroniza cuando
  // cambie el catálogo real (los otros tres: cart.tsx, terms.tsx, metodos-pago.tsx).
  const faq = useMemo(() => {
    const lineas = horario.map(({ dias, horas }) => `${dias}: ${horas.join(" y ")}`).join("\n");
    return [
      FAQ_ESTATICA[0],
      {
        q: "¿Cuáles son los horarios de entrega?",
        a: `${lineas}\n\nPedidos después del cierre se despachan al siguiente día.`,
      },
      {
        q: "¿Qué métodos de pago aceptan?",
        a: `Pago contra entrega. Aceptamos: ${mediosPago.map((m) => m.etiqueta).join(", ")}.`,
      },
      ...FAQ_ESTATICA.slice(1),
    ];
  }, [horario, mediosPago]);

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
        <Text style={{ fontFamily: fuentes.destacado, fontSize: 18, color: colors.ink }}>Centro de Ayuda</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 20 }}>
        {/* Contact Card */}
        <View className="rounded-2xl p-5" style={{ backgroundColor: colors.lowfill }}>
          <Text style={{ fontFamily: fuentes.destacado, fontSize: 18, color: colors.ink, marginBottom: 4 }}>
            ¿Necesitas ayuda?
          </Text>
          <Text style={{ fontFamily: fuentes.destacado, fontSize: 13, color: colors.muted, marginBottom: 16 }}>
            Estamos disponibles para resolver cualquier duda o problema con tu pedido.
          </Text>

          <Pressable
            onPress={abrirWhatsApp}
            accessibilityRole="link"
            accessibilityLabel="Escribirnos por WhatsApp"
            className="flex-row items-center justify-center py-3.5 rounded-xl mb-3"
            style={{ backgroundColor: "#25D366" }}
          >
            <MessageIcon color="#fff" size={20} />
            <Text style={{ fontFamily: fuentes.destacado, color: "#fff", fontSize: 15 }}>Escribir por WhatsApp</Text>
          </Pressable>

          <Pressable
            onPress={abrirTelefono}
            accessibilityRole="link"
            accessibilityLabel={`Llamarnos al ${telefono}`}
            className="flex-row items-center justify-center py-3.5 rounded-xl"
            style={{ backgroundColor: colors.surface }}
          >
            <Feather name="phone" size={16} color={colors.green} />
            <Text style={{ fontFamily: fuentes.destacado, color: colors.ink, fontSize: 14, marginLeft: 8 }}>Llamar</Text>
          </Pressable>
        </View>

        {/* Business Info */}
        <View className="rounded-2xl p-5" style={{ backgroundColor: colors.surface, ...shadows.card }}>
          <Text style={{ fontFamily: fuentes.destacado, fontSize: 14, color: colors.ink, marginBottom: 12 }}>Información</Text>

          <View style={{ gap: 10 }}>
            <View className="flex-row" style={{ gap: 10 }}>
              <Feather name="map-pin" size={16} color={colors.green} style={{ marginTop: 2 }} />
              <Text style={{ fontFamily: fuentes.destacado, fontSize: 13, color: colors.muted, flex: 1 }}>Carrera 10 #16-86, Florencia, Caquetá</Text>
            </View>
            <View className="flex-row" style={{ gap: 10 }}>
              <Feather name="mail" size={16} color={colors.green} style={{ marginTop: 2 }} />
              <Text style={{ fontFamily: fuentes.destacado, fontSize: 13, color: colors.muted }}>{correo}</Text>
            </View>
            <View className="flex-row" style={{ gap: 10 }}>
              <Feather name="clock" size={16} color={colors.green} style={{ marginTop: 2 }} />
              <View>
                {horario.map(({ dias, horas }) => (
                  <Text key={dias} style={{ fontFamily: fuentes.destacado, fontSize: 13, color: colors.muted }}>
                    {dias}: {horas.join(" y ")}
                  </Text>
                ))}
              </View>
            </View>
          </View>
        </View>

        {/* FAQ */}
        <View>
          <Text style={{ fontFamily: fuentes.destacado, fontSize: 18, color: colors.ink, marginBottom: 12 }}>
            Preguntas Frecuentes
          </Text>
          <View style={{ gap: 10 }}>
            {faq.map((item, i) => (
              <FaqItem key={i} q={item.q} a={item.a} />
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
