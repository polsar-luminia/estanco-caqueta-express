import { View, Text, FlatList, Pressable } from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import Svg, { Path } from "react-native-svg";
import { getProductos, type Producto } from "../../src/lib/api";

type GridItem = Producto | { id: number; _spacer: true };
import { tracker } from "../../src/lib/tracker";
import { ProductCard } from "../../src/components/ProductCard";
import { ProductGridSkeleton } from "../../src/components/skeletons/ProductGridSkeleton";
import { ErrorState } from "../../src/components/ErrorState";

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
  const categoriaId = id && id.trim() ? Number(id) : NaN;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["productos", "categoria", categoriaId],
    queryFn: () => getProductos({ categoria: categoriaId, limite: 50 }),
    enabled: Number.isFinite(categoriaId) && categoriaId > 0,
  });

  const nombreCategoria = data?.productos?.[0]?.categoria || "Categoría";

  useEffect(() => {
    if (!isLoading && nombreCategoria !== "Categoría") {
      tracker.track('categoria_abierta', { categoria_id: categoriaId, nombre: nombreCategoria }, 'category/[id]');
    }
  }, [isLoading, categoriaId, nombreCategoria]);

  if (!Number.isFinite(categoriaId) || categoriaId <= 0) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
        <Text style={{ fontSize: 48, marginBottom: 12 }}>😕</Text>
        <Text style={{ fontSize: 18, fontWeight: "600", color: "#1F1F1F", textAlign: "center" }}>
          Categoría no encontrada
        </Text>
      </View>
    );
  }

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
      ) : isError ? (
        <View style={{ flex: 1, justifyContent: "center" }}>
          <ErrorState mensaje="No pudimos cargar esta categoría" onRetry={refetch} />
        </View>
      ) : (
        <FlatList<GridItem>
          data={(() => {
            const productos = data?.productos || [];
            const gridData: GridItem[] =
              productos.length % 2 !== 0
                ? [...productos, { id: -1, _spacer: true }]
                : productos;
            return gridData;
          })()}
          numColumns={2}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          columnWrapperStyle={{ gap: 12 }}
          keyExtractor={(item) => String(item.id)}
          initialNumToRender={8}
          maxToRenderPerBatch={4}
          windowSize={5}
          ListEmptyComponent={
            <View className="items-center py-8">
              <Text style={{ color: "#9CA3AF" }}>
                No hay productos en esta categoría
              </Text>
            </View>
          }
          renderItem={({ item, index }) => {
            if ("_spacer" in item) return <View style={{ flex: 1 }} />;
            return (
              <ProductCard
                product={item}
                onPress={() => router.push(`/product/${item.id}`)}
                priority={index < 8 ? "high" : "normal"}
              />
            );
          }}
        />
      )}
    </View>
  );
}
