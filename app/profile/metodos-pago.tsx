import { View, Text, ScrollView } from "react-native";
import { Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { BackButton } from "../../src/components/BackButton";
import { colors, radii, shadows, fuentes } from "../../src/constants/theme";
import { getConfigApp } from "../../src/lib/api";
import { MEDIOS_PAGO_RESPALDO, ICONOS_MEDIO, ICONO_MEDIO_GENERICO } from "../../src/constants/config";

export default function MetodosPagoScreen() {
  const insets = useSafeAreaInsets();

  // Mismo queryKey que cart.tsx y las demás: comparten caché.
  const { data: configApp } = useQuery({
    queryKey: ["config-app"],
    queryFn: getConfigApp,
    staleTime: 5 * 60 * 1000,
  });
  // Antes esta pantalla tenía su propio catálogo (093 lo generaliza): el
  // servidor manda la lista vigente, y esto cae al respaldo local solo
  // mientras arranca o si el backend no responde.
  const medios = configApp?.medios_pago ?? MEDIOS_PAGO_RESPALDO;

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

        {medios.map((m) => {
          const icono = ICONOS_MEDIO[m.codigo] ?? ICONO_MEDIO_GENERICO;
          return (
            <View key={m.codigo} style={{ backgroundColor: colors.surface, borderRadius: radii.card, padding: 20, flexDirection: "row", alignItems: "flex-start", gap: 16, ...shadows.card }}>
              <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: icono.bg, alignItems: "center", justifyContent: "center" }}>
                <Feather name={icono.icon} size={20} color={icono.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontFamily: fuentes.destacado, color: colors.ink, marginBottom: 4 }}>{m.etiqueta}</Text>
                <Text style={{ fontFamily: fuentes.destacado, fontSize: 13, color: colors.muted, lineHeight: 19 }}>{m.descripcion}</Text>
              </View>
            </View>
          );
        })}

        <View style={{ backgroundColor: colors.lowfill, borderRadius: 12, padding: 16, marginTop: 8 }}>
          <Text style={{ fontFamily: fuentes.destacado, fontSize: 12, color: colors.muted, textAlign: "center", lineHeight: 18 }}>
            ¿Preguntas sobre tu pago? Escríbenos por WhatsApp y te ayudamos de inmediato.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
