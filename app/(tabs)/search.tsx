import { useState, useCallback } from "react";
import { View, TextInput, FlatList, Text } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { buscarProductos } from "../../src/lib/api";
import { ProductCard } from "../../src/components/ProductCard";
import { ProductGridSkeleton } from "../../src/components/skeletons/ProductGridSkeleton";

export default function SearchScreen() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  const debounceRef = useCallback(
    (() => {
      let timeout: ReturnType<typeof setTimeout>;
      return (value: string) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => setDebouncedQuery(value), 400);
      };
    })(),
    []
  );

  const handleChange = (text: string) => {
    setQuery(text);
    debounceRef(text);
  };

  const { data: resultados = [], isLoading } = useQuery({
    queryKey: ["buscar", debouncedQuery],
    queryFn: () => buscarProductos(debouncedQuery),
    enabled: debouncedQuery.length >= 2,
  });

  return (
    <View className="flex-1 bg-gray-50">
      <View className="px-4 pt-4 pb-2">
        <TextInput
          className="bg-white border border-gray-300 rounded-xl px-4 py-3 text-base"
          placeholder="Buscar licores, dulces, cervezas..."
          value={query}
          onChangeText={handleChange}
          autoFocus
        />
      </View>

      {isLoading && debouncedQuery.length >= 2 && (
        <View className="px-4 pt-2">
          <ProductGridSkeleton count={4} />
        </View>
      )}

      {debouncedQuery.length >= 2 && resultados.length === 0 && !isLoading && (
        <View className="px-4 py-8 items-center">
          <Text className="text-gray-500">
            No se encontraron productos para "{debouncedQuery}"
          </Text>
        </View>
      )}

      <FlatList
        data={resultados}
        numColumns={2}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 90 }}
        columnWrapperStyle={{ gap: 12 }}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <ProductCard
            product={item}
            onPress={() => router.push(`/product/${item.id}`)}
          />
        )}
      />
    </View>
  );
}
