import { View, Text, FlatList, Pressable, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import Svg, { Path } from "react-native-svg";
import { getProductos, type Producto } from "../../src/lib/api";
import { esCategoriaProhibidaIOS, filtrarProductosIOS } from "../../src/lib/iosFilters";

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
  const insets = useSafeAreaInsets();
  const categoriaId = id && id.trim() ? Number(id) : NaN;

  const PAGE_SIZE = 20;

  const {
    data,
    isLoading,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["productos", "categoria", categoriaId],
    queryFn: ({ pageParam }) =>
      getProductos({ categoria: categoriaId, pagina: pageParam, limite: PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.paginas > allPages.length ? allPages.length + 1 : undefined,
    enabled: Number.isFinite(categoriaId) && categoriaId > 0,
  });

  // Apple §1.4.3 — defensa cliente en iOS: si por error llega un producto
  // de tabaco/vape, lo filtramos. El backend ya bloquea por X-Platform.
  // Apple 2.1a — `p?.productos ?? []` evita TypeError si una página llega
  // sin `productos` (null/ausente).
  const productos = filtrarProductosIOS(
    data?.pages.flatMap((p) => p?.productos ?? []) ?? [],
  );
  const nombreCategoria = data?.pages[0]?.productos?.[0]?.categoria || "Categoría";

  // Si la categoría entera está bloqueada en iOS, mostrar "no encontrada".
  const categoriaBloqueada = esCategoriaProhibidaIOS(nombreCategoria);

  useEffect(() => {
    if (!isLoading && nombreCategoria !== "Categoría") {
      tracker.track('categoria_abierta', { categoria_id: categoriaId, nombre: nombreCategoria }, 'category/[id]');
    }
  }, [isLoading, categoriaId, nombreCategoria]);

  if (!Number.isFinite(categoriaId) || categoriaId <= 0 || categoriaBloqueada) {
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
          paddingTop: insets.top + 12,
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
          onEndReachedThreshold={0.5}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) fetchNextPage();
          }}
          ListFooterComponent={
            isFetchingNextPage ? (
              <View style={{ paddingVertical: 16, alignItems: "center" }}>
                <ActivityIndicator color="#1FAF55" />
              </View>
            ) : null
          }
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
