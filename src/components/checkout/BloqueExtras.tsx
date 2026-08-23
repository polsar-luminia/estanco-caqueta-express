// Frío asegurado y canje de puntos, juntos, en su propia tarjeta ANTES del
// desglose. Antes vivían dentro de la lista de precios (cart.tsx:1103-1166),
// mezclando decisiones ("¿lo quieres frío?") con lecturas ("Subtotal: $X").
// Fondo `colors.lowfill`: se leen como formulario, no como promoción — estos
// switches no venden, modifican el total.

import { View, Text, Pressable, Switch } from "react-native";
import { colors, fuentes } from "../../constants/theme";
import { formatCOP } from "../../lib/format";

interface Props {
  frioActivo: boolean;
  hayElegibles: boolean;
  quiereFrio: boolean;
  frioCosto: number;
  todosElegibles: boolean;
  itemsElegibles: { nombre: string }[];
  onToggleFrio: (v: boolean) => void;

  mostrarPuntos: boolean;
  puedeUsarPuntos: boolean;
  puntosParaEnvioGratis: number;
  puntos: number;
  usarPuntos: boolean;
  onToggleUsarPuntos: (v: boolean) => void;
}

export function BloqueExtras({
  frioActivo,
  hayElegibles,
  quiereFrio,
  frioCosto,
  todosElegibles,
  itemsElegibles,
  onToggleFrio,
  mostrarPuntos,
  puedeUsarPuntos,
  puntosParaEnvioGratis,
  puntos,
  usarPuntos,
  onToggleUsarPuntos,
}: Props) {
  const hayFrio = frioActivo && hayElegibles;
  const hayPuntos = mostrarPuntos && (puedeUsarPuntos || puntos > 0);
  if (!hayFrio && !hayPuntos) return null;

  return (
    <View style={{ gap: 8 }}>
      {hayFrio && (
        <View className="rounded-xl p-3" style={{ backgroundColor: quiereFrio ? "rgba(15,58,107,0.08)" : colors.lowfill }}>
          {/* El Switch va como hermano del Pressable, no dentro: anidado, un tap
              sobre él dispararía los dos handlers y el check quedaría igual. */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Pressable
              onPress={() => onToggleFrio(!quiereFrio)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: quiereFrio }}
              accessibilityLabel={`Asegurar frío por ${formatCOP(frioCosto)}`}
              style={{ flex: 1, minHeight: 44, justifyContent: "center" }}
            >
              <Text style={{ fontSize: 15, fontFamily: fuentes.destacado, color: "#1A1C1A" }}>
                ¿Lo quieres frío? +{formatCOP(frioCosto)}
              </Text>
              <Text style={{ fontFamily: fuentes.destacado, fontSize: 13, lineHeight: 18, color: "#6D7B6C", marginTop: 3 }} numberOfLines={2}>
                {todosElegibles
                  ? "Todo tu pedido va frío."
                  : `Aseguramos frío para: ${itemsElegibles.map((i) => i.nombre).slice(0, 3).join(", ")}${itemsElegibles.length > 3 ? ` y ${itemsElegibles.length - 3} más` : ""}.`}
              </Text>
            </Pressable>
            <Switch
              value={quiereFrio}
              onValueChange={onToggleFrio}
              accessibilityLabel={`Asegurar frío por ${formatCOP(frioCosto)}`}
              trackColor={{ false: "#E2E3DF", true: "#0F3A6B" }}
              thumbColor="#fff"
            />
          </View>
        </View>
      )}

      {mostrarPuntos && puedeUsarPuntos && (
        <View className="flex-row justify-between items-center rounded-xl p-3" style={{ backgroundColor: colors.lowfill }}>
          <View className="flex-1">
            <Text style={{ fontSize: 13, fontFamily: fuentes.destacado, color: "#1A1C1A" }}>Usar {puntosParaEnvioGratis} puntos</Text>
            <Text style={{ fontFamily: fuentes.destacado, fontSize: 12, color: "#6D7B6C" }}>Envío gratis (tienes {puntos} pts)</Text>
          </View>
          <Switch
            value={usarPuntos}
            onValueChange={onToggleUsarPuntos}
            trackColor={{ false: "#E2E3DF", true: colors.green }}
            thumbColor="#fff"
          />
        </View>
      )}
      {mostrarPuntos && !puedeUsarPuntos && puntos > 0 && (
        <Text style={{ fontFamily: fuentes.destacado, fontSize: 12, color: "#6D7B6C", fontStyle: "italic", marginLeft: 4 }}>
          Tienes {puntos} pts. Necesitas {puntosParaEnvioGratis} para envío gratis.
        </Text>
      )}
    </View>
  );
}
