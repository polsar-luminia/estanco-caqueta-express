// Barra flotante sticky que aparece cuando hay items en el carrito.
// Patron estandar de e-commerce (Rappi, iFood, Amazon): feedback visual
// inmediato al agregar producto + acceso rapido al carrito sin perder
// contexto de navegacion.
//
// Se monta en pantallas donde el usuario podria agregar items: producto,
// (opcional fase 2: categoria, search, home).

import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useCartStore } from "../stores/cart";
import { formatCOP } from "../lib/format";
import { CARD_SHADOW } from "../constants/styles";
import { fuentes } from "../constants/theme";

export function CartFloatingBar({ bottomOffset = 24 }: { bottomOffset?: number } = {}) {
  const router = useRouter();

  // Selectores inline (no metodos del store) — patron documentado en CLAUDE.md.
  // Los metodos del store no son reactivos a cambios de items, por eso usamos
  // selectores derivados directos.
  const itemCount = useCartStore((s) =>
    s.items.reduce((sum, i) => sum + i.cantidad, 0)
  );
  const total = useCartStore((s) =>
    s.items.reduce((sum, i) => sum + i.cantidad * i.precioUnitario, 0)
  );

  if (itemCount === 0) return null;

  return (
    <View
      style={{
        position: "absolute",
        bottom: bottomOffset,
        left: 16,
        right: 16,
        backgroundColor: "#fff",
        borderRadius: 16,
        paddingVertical: 12,
        paddingHorizontal: 16,
        flexDirection: "row",
        alignItems: "center",
        ...CARD_SHADOW,
      }}
      pointerEvents="box-none"
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: "#1FAF55",
          alignItems: "center",
          justifyContent: "center",
          marginRight: 12,
        }}
      >
        <Text style={{ color: "#fff", fontFamily: fuentes.destacado, fontSize: 14 }}>
          {itemCount}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 12, color: "#6D7B6C", fontFamily: fuentes.destacado }}>
          TU PEDIDO
        </Text>
        <Text style={{ fontSize: 16, fontFamily: fuentes.destacado, color: "#1A1C1A" }}>
          {formatCOP(total)}
        </Text>
      </View>
      <Pressable
        onPress={() => router.push("/(tabs)/cart")}
        style={{
          backgroundColor: "#D33587",
          borderRadius: 999,
          paddingVertical: 10,
          paddingHorizontal: 18,
        }}
        accessibilityRole="button"
        accessibilityLabel="Ver carrito"
      >
        <Text style={{ color: "#fff", fontFamily: fuentes.destacado, fontSize: 13 }}>
          VER CARRITO
        </Text>
      </Pressable>
    </View>
  );
}
