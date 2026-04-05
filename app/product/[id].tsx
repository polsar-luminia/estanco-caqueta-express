import { View, Text, ScrollView, Pressable } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { getProducto } from "../../src/lib/api";
import { useCartStore } from "../../src/stores/cart";
import { formatCOP } from "../../src/lib/format";

const CATEGORY_PLACEHOLDERS: Record<string, string> = {
  Whisky: "https://placehold.co/400x400/1B5E20/white?text=Whisky",
  Tequila: "https://placehold.co/400x400/FF6F00/white?text=Tequila",
  Ron: "https://placehold.co/400x400/795548/white?text=Ron",
  Vodka: "https://placehold.co/400x400/2196F3/white?text=Vodka",
  Cerveza: "https://placehold.co/400x400/FFC107/333?text=Cerveza",
  Vino: "https://placehold.co/400x400/880E4F/white?text=Vino",
};

function getPlaceholder(categoria?: string): string {
  return (
    CATEGORY_PLACEHOLDERS[categoria || ""] ||
    "https://placehold.co/400x400/9E9E9E/white?text=Producto"
  );
}

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const addItem = useCartStore((s) => s.addItem);

  const { data: product, isLoading } = useQuery({
    queryKey: ["producto", id],
    queryFn: () => getProducto(Number(id)),
  });

  if (isLoading || !product) {
    return (
      <View className="flex-1 bg-white items-center justify-center">
        <Text className="text-gray-400">Cargando...</Text>
      </View>
    );
  }

  const imageUri = product.imagen_url || getPlaceholder(product.categoria);

  const handleAdd = () => {
    addItem({
      productoId: product.id,
      nombre: product.nombre,
      precioUnitario: product.precio_app,
      imagenUrl: product.imagen_url || undefined,
    });
  };

  return (
    <View className="flex-1 bg-white">
      <ScrollView>
        <Image
          source={{ uri: imageUri }}
          style={{ width: "100%", height: 300 }}
          contentFit="contain"
          className="bg-gray-100"
        />
        <View className="p-4">
          <Text className="text-xs text-gray-500 uppercase mb-1">
            {product.categoria}
          </Text>
          <Text className="text-xl font-bold text-gray-800 mb-2">
            {product.nombre}
          </Text>
          <Text className="text-2xl font-bold text-brand-800 mb-4">
            {formatCOP(product.precio_app)}
          </Text>
          {product.descripcion && (
            <Text className="text-base text-gray-600 leading-6 mb-4">
              {product.descripcion}
            </Text>
          )}
          {product.stock_total > 0 ? (
            <Text className="text-sm text-green-600">Disponible</Text>
          ) : (
            <Text className="text-sm text-red-600">Agotado</Text>
          )}
        </View>
      </ScrollView>

      <View className="border-t border-gray-200 px-4 py-4">
        <Pressable
          onPress={handleAdd}
          disabled={product.stock_total <= 0}
          className={`rounded-xl py-4 items-center ${
            product.stock_total <= 0 ? "bg-gray-300" : "bg-brand-700"
          }`}
        >
          <Text className="text-white font-bold text-base">
            Agregar al carrito
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
