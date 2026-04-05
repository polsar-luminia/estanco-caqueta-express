import { View, Text, Pressable } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useCartStore, type CartItem as CartItemType } from "../stores/cart";
import { formatCOP } from "../lib/format";
import { ShimmerImage } from "./ShimmerImage";

interface Props {
  item: CartItemType;
}

export function CartItem({ item }: Props) {
  const updateQuantity = useCartStore((s) => s.updateQuantity);

  return (
    <View
      className="bg-white p-3 rounded-xl border border-gray-100 flex-row items-center"
      style={{
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 1,
      }}
    >
      {/* Imagen */}
      <View className="w-20 h-20 rounded-lg bg-gray-50 overflow-hidden">
        <ShimmerImage
          imageUrl={item.imagenUrl}
          contentFit="cover"
          style={{ width: 80, height: 80 }}
        />
      </View>

      {/* Contenido */}
      <View className="flex-1 ml-3 mr-2">
        <Text className="font-semibold text-sm text-gray-800" numberOfLines={2}>
          {item.nombre}
        </Text>
        <Text className="font-bold text-sm mt-1" style={{ color: "#D33587" }}>
          {formatCOP(item.precioUnitario)}
        </Text>
      </View>

      {/* Controles de cantidad */}
      <View className="bg-gray-100 rounded-full p-1 flex-row items-center">
        <Pressable
          onPress={() => updateQuantity(item.productoId, item.cantidad - 1)}
          className="w-7 h-7 rounded-full bg-white items-center justify-center"
        >
          <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
            <Path
              d="M5 12h14"
              stroke="#6B7280"
              strokeWidth={2}
              strokeLinecap="round"
            />
          </Svg>
        </Pressable>

        <Text className="w-6 text-center font-bold text-sm">
          {item.cantidad}
        </Text>

        <Pressable
          onPress={() => updateQuantity(item.productoId, item.cantidad + 1)}
          className="w-7 h-7 rounded-full bg-white items-center justify-center"
        >
          <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
            <Path
              d="M12 5v14M5 12h14"
              stroke="#6B7280"
              strokeWidth={2}
              strokeLinecap="round"
            />
          </Svg>
        </Pressable>
      </View>
    </View>
  );
}
