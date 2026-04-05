import { View, Text, Pressable } from "react-native";
import { useCartStore, type CartItem as CartItemType } from "../stores/cart";
import { formatCOP } from "../lib/format";

interface Props {
  item: CartItemType;
}

export function CartItem({ item }: Props) {
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);

  return (
    <View className="bg-white rounded-xl p-4 flex-row items-center">
      <View className="flex-1 mr-3">
        <Text className="text-sm font-medium text-gray-800" numberOfLines={2}>
          {item.nombre}
        </Text>
        <Text className="text-sm text-brand-800 mt-1">
          {formatCOP(item.precioUnitario)}
        </Text>
      </View>

      <View className="flex-row items-center gap-2">
        <Pressable
          onPress={() => updateQuantity(item.productoId, item.cantidad - 1)}
          className="w-8 h-8 rounded-lg bg-gray-100 items-center justify-center"
        >
          <Text className="text-lg text-gray-600">-</Text>
        </Pressable>
        <Text className="text-base font-semibold w-6 text-center">
          {item.cantidad}
        </Text>
        <Pressable
          onPress={() => updateQuantity(item.productoId, item.cantidad + 1)}
          className="w-8 h-8 rounded-lg bg-brand-100 items-center justify-center"
        >
          <Text className="text-lg text-brand-800">+</Text>
        </Pressable>
      </View>

      <Text className="text-base font-bold text-gray-800 ml-3 w-20 text-right">
        {formatCOP(item.precioUnitario * item.cantidad)}
      </Text>
    </View>
  );
}
