import { View, Text, Pressable } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useCartStore, type CartItem as CartItemType } from "../stores/cart";
import { formatCOP } from "../lib/format";
import { ShimmerImage } from "./ShimmerImage";
import Toast from "react-native-toast-message";

function MinusIcon() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Path d="M5 12h14" stroke="#1FAF55" strokeWidth={2.5} strokeLinecap="round" />
    </Svg>
  );
}

function PlusIcon() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Path d="M12 5v14M5 12h14" stroke="#1FAF55" strokeWidth={2.5} strokeLinecap="round" />
    </Svg>
  );
}

interface Props {
  item: CartItemType;
}

export function CartItem({ item }: Props) {
  const updateQuantity = useCartStore((s) => s.updateQuantity);

  return (
    <View
      className="flex-row items-center bg-white p-4"
      style={{
        borderRadius: 16,
        shadowColor: "#1A1C1A",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 12,
        elevation: 2,
        gap: 14,
      }}
    >
      {/* Image */}
      <View style={{ width: 76, height: 76, borderRadius: 12, overflow: "hidden", backgroundColor: "#F4F4F0" }}>
        <ShimmerImage
          imageUrl={item.imagenUrl}
          style={{ width: 76, height: 76 }}
          contentFit="cover"
        />
      </View>

      {/* Info */}
      <View className="flex-1">
        <Text style={{ fontWeight: "700", fontSize: 14, color: "#1A1C1A", lineHeight: 18 }} numberOfLines={2}>
          {item.nombre}
        </Text>
        <Text style={{ color: "#D33587", fontWeight: "700", fontSize: 17, marginTop: 4 }}>
          {formatCOP(item.precioUnitario)}
        </Text>
      </View>

      {/* Quantity */}
      <View
        className="flex-row items-center"
        style={{ backgroundColor: "#F4F4F0", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 8, gap: 10 }}
      >
        <Pressable
          onPress={() => {
            if (item.cantidad - 1 === 0) Toast.show({ type: "info", text1: "Producto eliminado del carrito" });
            updateQuantity(item.productoId, item.cantidad - 1);
          }}
          className="items-center justify-center"
          style={{ padding: 4 }}
          accessibilityLabel="Reducir cantidad"
          accessibilityRole="button"
        >
          <MinusIcon />
        </Pressable>
        <Text style={{ fontWeight: "700", fontSize: 14, minWidth: 16, textAlign: "center" }}>
          {item.cantidad}
        </Text>
        <Pressable
          onPress={() => updateQuantity(item.productoId, item.cantidad + 1)}
          className="items-center justify-center"
          style={{ padding: 4 }}
          accessibilityLabel="Aumentar cantidad"
          accessibilityRole="button"
        >
          <PlusIcon />
        </Pressable>
      </View>
    </View>
  );
}
