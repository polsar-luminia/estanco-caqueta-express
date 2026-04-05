import { View, Text, Pressable } from "react-native";
import { Image } from "expo-image";
import { formatCOP } from "../lib/format";
import { useCartStore } from "../stores/cart";
import type { Producto } from "../lib/api";

interface Props {
  product: Producto;
  onPress: () => void;
}

export function ProductCard({ product, onPress }: Props) {
  const addItem = useCartStore((s) => s.addItem);

  const imageUri =
    product.imagen_url ||
    "https://placehold.co/200x200/E8F5E9/1B5E20?text=" +
      encodeURIComponent(product.categoria || "P");

  const handleAdd = () => {
    addItem({
      productoId: product.id,
      nombre: product.nombre,
      precioUnitario: product.precio_app,
      imagenUrl: product.imagen_url || undefined,
    });
  };

  return (
    <Pressable
      onPress={onPress}
      className="flex-1 bg-white rounded-xl overflow-hidden border border-gray-100"
    >
      <Image
        source={{ uri: imageUri }}
        style={{ width: "100%", height: 140 }}
        contentFit="contain"
        className="bg-gray-50"
      />
      <View className="p-3">
        <Text className="text-xs text-gray-500 mb-1" numberOfLines={1}>
          {product.categoria}
        </Text>
        <Text className="text-sm font-medium text-gray-800 mb-2" numberOfLines={2}>
          {product.nombre}
        </Text>
        <View className="flex-row items-center justify-between">
          <Text className="text-base font-bold text-brand-800">
            {formatCOP(product.precio_app)}
          </Text>
          <Pressable
            onPress={(e) => {
              e.stopPropagation?.();
              handleAdd();
            }}
            className="bg-brand-700 rounded-lg px-3 py-1"
          >
            <Text className="text-white text-sm font-semibold">+</Text>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}
