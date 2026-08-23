// Cabecera del carrito: "3 productos · $95.000 ⌄", colapsada por defecto.
// Absorbe la función del título "Tu Carrito" que se elimina (823-827): lleva
// accessibilityRole="header", que el título de antes no tenía.

import { View, Text, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors, fuentes } from "../../constants/theme";
import { formatCOP } from "../../lib/format";

interface Props {
  nItems: number;
  subtotal: number;
  abierto: boolean;
  onToggle: () => void;
}

export function FilaPedidoColapsado({ nItems, subtotal, abierto, onToggle }: Props) {
  const plural = nItems === 1 ? "producto" : "productos";
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityState={{ expanded: abierto }}
      accessibilityLabel={`Tu pedido: ${nItems} ${plural}, ${formatCOP(subtotal)}. ${abierto ? "Toca para colapsar" : "Toca para ver los productos"}`}
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
      <Feather name={abierto ? "chevron-up" : "chevron-down"} size={20} color="#6D7B6C" />
    </Pressable>
  );
}
