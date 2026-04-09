import { View, Text, FlatList, Pressable } from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import Svg, { Path } from "react-native-svg";
import { getProductos } from "../../src/lib/api";
import { tracker } from "../../src/lib/tracker";
import { ProductCard } from "../../src/components/ProductCard";
import { ProductGridSkeleton } from "../../src/components/skeletons/ProductGridSkeleton";

function ChevronLeftIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M15 18l-6-6 6-6" stroke="#1A1C1A" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export default function CategoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const { data, isLoading } = useQuery({
    queryKey: ["productos", "categoria", id],
    queryFn: () => getProductos({ categoria: Number(id), limite: 50 }),
  });

  const nombreCategoria = data?.productos?.[0]?.categoria || "Categoría";

  useEffect(() => {
    if (!isLoading && nombreCategoria !== "Categoría") {
      tracker.track('categoria_abierta', { categoria_id: Number(id), nombre: nombreCategoria }, 'category/[id]');
    }
  }, [isLoading]);

  return (
    <View className="flex-1" style={{ backgroundColor: "#FAFAF6" }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header propio */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingTop: 56,
          paddingBottom: 16,
          paddingHorizontal: 16,
          backgroundColor: "#FAFAF6",
          borderBottomWidth: 1,
          borderBottomColor: "#EFEFEB",
        }}
      >
        <Pressable
          onPress={() => router.back()}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            paddingRight: 16,
          }}
        >
          <ChevronLeftIcon />
          <Text style={{ fontSize: 15, fontWeight: "600", color: "#1A1C1A" }}>
            Volver
          </Text>
        </Pressable>

        <Text
          style={{
            flex: 1,
            fontSize: 17,
            fontWeight: "800",
            color: "#1A1C1A",
            textAlign: "center",
            marginRight: 60,
          }}
          numberOfLines={1}
        >
          {isLoading ? "" : nombreCategoria}
        </Text>
      </View>

      {isLoading ? (
        <View className="p-4">
          <ProductGridSkeleton count={8} />
        </View>
      ) : (
        <FlatList
          data={(() => {
            const productos = data?.productos || [];
            return productos.length % 2 !== 0 ? [...productos, { id: -1, _spacer: true } as any] : productos;
          })()}
          numColumns={2}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          columnWrapperStyle={{ gap: 12 }}
          keyExtractor={(item) => String(item.id)}
          ListEmptyComponent={
            <View className="items-center py-8">
              <Text style={{ color: "#9CA3AF" }}>
                No hay productos en esta categoría
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            if (item._spacer) return <View style={{ flex: 1 }} />;
            return (
              <ProductCard
                product={item}
                onPress={() => router.push(`/product/${item.id}`)}
              />
            );
          }}
        />
      )}
    </View>
  );
}
