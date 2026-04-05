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

const BADGES = ["Mas Vendido", "Oferta", null, null, "Mas Vendido", null];

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
      contentContainerStyle={{ paddingBottom: 90 }}
      refreshControl={
        <RefreshControl refreshing={false} onRefresh={onRefresh} colors={["#1FAF55"]} />
      }
    >
      {isLoading ? (
        <>
          <View className="px-4 pt-4 pb-2">
            <View className="rounded-xl" style={{ height: 48, backgroundColor: "#E2E3DF" }} />
          </View>
          <View className="px-4 py-4">
            <CategoryStripSkeleton />
          </View>
          <View className="px-4 pb-6">
            <ProductGridSkeleton count={6} />
          </View>
        </>
      ) : (
        <>
          {/* Search bar */}
          <Pressable
            className="mx-4 mt-3 mb-2"
            onPress={() => router.push("/(tabs)/search")}
          >
            <View
              className="flex-row items-center rounded-xl"
              style={{ backgroundColor: "#E8E8E5", paddingVertical: 12, paddingLeft: 44, paddingRight: 16 }}
            >
              <Feather
                name="search"
                size={18}
                color="#6D7B6C"
                style={{ position: "absolute", left: 14 }}
              />
              <Text style={{ color: "#6D7B6C", fontSize: 14 }}>
                ¿Qué te apetece hoy?
              </Text>
            </View>
          </Pressable>

          {/* Banner carousel */}
          {banners.length > 0 && <BannerCarousel banners={banners} />}

          {/* Categorías */}
          <View className="px-4 pt-4 pb-2">
            <Text className="text-base font-bold text-gray-800 mb-3">
              Explorar Categorías
            </Text>
            <CategoryStrip
              categorias={categorias}
              onSelect={(id) => router.push(`/category/${id}`)}
            />
          </View>

          {/* Destacados */}
          <View className="px-4 pt-3 pb-6">
            <View className="flex-row items-center mb-3">
              <View
                className="rounded-full mr-2"
                style={{ width: 8, height: 8, backgroundColor: "#D33587" }}
              />
              <Text className="text-base font-bold text-gray-800">
                Destacados
              </Text>
            </View>
            <FlatList
              data={destacados}
              numColumns={2}
              scrollEnabled={false}
              columnWrapperStyle={{ gap: 10 }}
              contentContainerStyle={{ gap: 10 }}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item, index }) => (
                <ProductCard
                  product={item}
                  onPress={() => router.push(`/product/${item.id}`)}
                  badge={BADGES[index % BADGES.length] || undefined}
                />
              )}
            />
          </View>
        </>
      )}
    </ScrollView>
  );
}
