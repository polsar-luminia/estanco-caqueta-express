// Resumen de una línea en el checkout: "3 productos · $45.000" + "Editar".
// Reemplaza a FilaPedidoColapsado (Rediseño canasta/checkout, plan §Parte 2):
// el checkout ya no muestra los productos línea por línea — eso vive en la
// canasta (app/(tabs)/cart.tsx) — así que no hace falta un acordeón que
// desplegar, solo un enlace de vuelta.
import { View, Text, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors, fuentes } from "../../constants/theme";
import { formatCOP } from "../../lib/format";

interface Props {
  nItems: number;
  subtotal: number;
  onEditar: () => void;
}

export function ResumenPedidoFila({ nItems, subtotal, onEditar }: Props) {
  const plural = nItems === 1 ? "producto" : "productos";
  return (
    <Pressable
      onPress={onEditar}
      accessibilityRole="button"
      accessibilityLabel={`Tu pedido: ${nItems} ${plural}, ${formatCOP(subtotal)}. Toca para editar`}
      className="flex-row items-center p-4 rounded-2xl"
      style={{ backgroundColor: colors.surface, minHeight: 56 }}
    >
      <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: "rgba(31,175,85,0.08)", alignItems: "center", justifyContent: "center" }}>
        <Feather name="shopping-bag" size={16} color={colors.green} />
      </View>
      <View className="flex-1 ml-3">
        <Text accessibilityRole="header" style={{ fontSize: 15, fontFamily: fuentes.titulo, color: "#1A1C1A" }}>
          Tu pedido
        </Text>
        <Text style={{ fontFamily: fuentes.destacado, fontSize: 12, color: "#6D7B6C", marginTop: 1 }}>
          {nItems} {plural} · {formatCOP(subtotal)}
        </Text>
      </View>
      <Text style={{ fontSize: 13, fontFamily: fuentes.destacado, color: colors.green }}>Editar</Text>
    </Pressable>
  );
}
