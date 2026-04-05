import { View, Text, ScrollView, FlatList, Pressable } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { getCategorias, getDestacados, getPatrocinados } from "../../src/lib/api";
import { ProductCard } from "../../src/components/ProductCard";
import { CategoryStrip } from "../../src/components/CategoryStrip";
import { SponsoredBanner } from "../../src/components/SponsoredBanner";

export default function HomeScreen() {
  const router = useRouter();

  const { data: categorias = [] } = useQuery({
    queryKey: ["categorias"],
    queryFn: getCategorias,
  });

  const { data: destacados = [] } = useQuery({
    queryKey: ["destacados"],
    queryFn: getDestacados,
  });

  const { data: patrocinados = [] } = useQuery({
    queryKey: ["patrocinados"],
    queryFn: getPatrocinados,
  });

  const banners = patrocinados.filter((p) => p.tipo === "banner");

  return (
    <ScrollView className="flex-1 bg-gray-50">
      {banners.length > 0 && <SponsoredBanner banners={banners} />}

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
    </ScrollView>
  );
}
