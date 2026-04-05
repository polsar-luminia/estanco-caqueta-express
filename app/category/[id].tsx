import { View, Text, FlatList, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { getProductos } from "../../src/lib/api";
import { ProductCard } from "../../src/components/ProductCard";

export default function CategoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const { data, isLoading } = useQuery({
    queryKey: ["productos", "categoria", id],
    queryFn: () => getProductos({ categoria: Number(id), limite: 50 }),
  });

  if (isLoading) {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center">
        <ActivityIndicator color="#17994A" />
      </View>
    );
  }

  return (
    <FlatList
      className="flex-1 bg-gray-50"
      data={data?.productos || []}
      numColumns={2}
      contentContainerStyle={{ padding: 16, gap: 12 }}
      columnWrapperStyle={{ gap: 12 }}
      keyExtractor={(item) => String(item.id)}
      ListEmptyComponent={
        <View className="items-center py-8">
          <Text className="text-gray-400">
            No hay productos en esta categoria
          </Text>
        </View>
      }
      renderItem={({ item }) => (
        <ProductCard
          product={item}
          onPress={() => router.push(`/product/${item.id}`)}
        />
      )}
    />
  );
}
