import { View, Text, ScrollView, FlatList, RefreshControl, Pressable } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
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
      className="flex-1"
      style={{ backgroundColor: "#FAFAF6" }}
      refreshControl={
        <RefreshControl refreshing={false} onRefresh={onRefresh} colors={["#17994A"]} />
      }
    >
      {isLoading ? (
        <>
          {/* Skeleton para búsqueda */}
          <View className="px-4 pt-4 pb-2">
            <View
              className="rounded-xl"
              style={{ height: 52, backgroundColor: "#E2E3DF" }}
            />
          </View>
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
          {/* Barra de búsqueda */}
          <Pressable
            className="mx-4 mt-4 mb-2"
            onPress={() => router.push("/(tabs)/search")}
          >
            <View
              className="flex-row items-center rounded-xl"
              style={{ backgroundColor: "#E2E3DF", paddingVertical: 14, paddingLeft: 48, paddingRight: 16 }}
            >
              <Feather
                name="search"
                size={20}
                color="#6B7280"
                style={{ position: "absolute", left: 16 }}
              />
              <Text className="text-gray-500 text-base">
                ¿Qué te apetece hoy?
              </Text>
            </View>
          </Pressable>

          {/* Banner carousel */}
          {banners.length > 0 && <BannerCarousel banners={banners} />}

          {/* Categorías */}
          <View className="px-4 pt-4 pb-2">
            <Text className="text-lg font-bold text-gray-800 mb-3">
              Explorar Categorías
            </Text>
            <CategoryStrip
              categorias={categorias}
              onSelect={(id) => router.push(`/category/${id}`)}
            />
          </View>

          {/* Destacados */}
          <View className="px-4 pt-4 pb-6">
            <View className="flex-row items-center mb-3">
              <View
                className="rounded-full mr-2"
                style={{ width: 8, height: 8, backgroundColor: "#D33587" }}
              />
              <Text className="text-lg font-bold text-gray-800">
                Destacados
              </Text>
            </View>
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
