import { View, Text, ScrollView, FlatList, RefreshControl } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { getCategorias, getDestacados, getPatrocinados } from "../../src/lib/api";
import { ProductCard } from "../../src/components/ProductCard";
import { CategoryStrip } from "../../src/components/CategoryStrip";
import { BannerCarousel } from "../../src/components/BannerCarousel";
import { ProductGridSkeleton } from "../../src/components/skeletons/ProductGridSkeleton";
import { CategoryStripSkeleton } from "../../src/components/skeletons/CategoryStripSkeleton";
import { BannerSkeleton } from "../../src/components/skeletons/BannerSkeleton";

export default function HomeScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: categorias = [], isLoading: loadCat } = useQuery({
    queryKey: ["categorias"],
    queryFn: getCategorias,
  });

  const { data: destacados = [], isLoading: loadDest } = useQuery({
    queryKey: ["destacados"],
    queryFn: getDestacados,
  });

  const { data: patrocinados = [], isLoading: loadPat } = useQuery({
    queryKey: ["patrocinados"],
    queryFn: getPatrocinados,
  });

  const isLoading = loadCat || loadDest || loadPat;
  const banners = patrocinados.filter((p) => p.tipo === "banner");

  const onRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["categorias"] });
    queryClient.invalidateQueries({ queryKey: ["destacados"] });
    queryClient.invalidateQueries({ queryKey: ["patrocinados"] });
  };

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      refreshControl={
        <RefreshControl refreshing={false} onRefresh={onRefresh} colors={["#17994A"]} />
      }
    >
      {isLoading ? (
        <>
          <BannerSkeleton />
          <View className="px-4 py-4">
            <CategoryStripSkeleton />
          </View>
          <View className="px-4 pb-6">
            <ProductGridSkeleton count={6} />
          </View>
        </>
      ) : (
        <>
          {banners.length > 0 && <BannerCarousel banners={banners} />}

          <View className="px-4 py-4">
            <Text className="text-lg font-bold text-gray-800 mb-3">
              Categorias
            </Text>
            <CategoryStrip
              categorias={categorias}
              onSelect={(id) => router.push(`/category/${id}`)}
            />
          </View>

          <View className="px-4 pb-6">
            <Text className="text-lg font-bold text-gray-800 mb-3">
              Destacados
            </Text>
            <FlatList
              data={destacados}
              numColumns={2}
              scrollEnabled={false}
              columnWrapperStyle={{ gap: 12 }}
              contentContainerStyle={{ gap: 12 }}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <ProductCard
                  product={item}
                  onPress={() => router.push(`/product/${item.id}`)}
                />
              )}
            />
          </View>
        </>
      )}
    </ScrollView>
  );
}
