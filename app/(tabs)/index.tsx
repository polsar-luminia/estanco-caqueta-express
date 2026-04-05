import { View, Text, ScrollView, FlatList, RefreshControl, Pressable } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { getCategorias, getDestacados, getPatrocinados } from "../../src/lib/api";
import { useCartStore } from "../../src/stores/cart";
import { useAuthStore } from "../../src/stores/auth";
import { ProductCard } from "../../src/components/ProductCard";
import { CategoryStrip } from "../../src/components/CategoryStrip";
import { ShimmerImage } from "../../src/components/ShimmerImage";
import { ProductGridSkeleton } from "../../src/components/skeletons/ProductGridSkeleton";
import { CategoryStripSkeleton } from "../../src/components/skeletons/CategoryStripSkeleton";
import { SkeletonBox } from "../../src/components/skeletons/SkeletonBox";
import { formatCOP } from "../../src/lib/format";

const BADGES = ["Top Ventas", "Oferta", null, null, "Top Ventas", null];

export default function HomeScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const cliente = useAuthStore((s) => s.cliente);
  const itemCount = useCartStore((s) => s.getItemCount());
  const total = useCartStore((s) => s.getTotal());

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

  const onRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["categorias"] });
    queryClient.invalidateQueries({ queryKey: ["destacados"] });
    queryClient.invalidateQueries({ queryKey: ["patrocinados"] });
  };

  return (
    <View className="flex-1" style={{ backgroundColor: "#FAFAF6" }}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: itemCount > 0 ? 160 : 90 }}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={onRefresh} colors={["#1FAF55"]} />
        }
      >
        {isLoading ? (
          <View className="px-4 pt-4" style={{ gap: 16 }}>
            <SkeletonBox style={{ height: 56 }} className="rounded-xl" />
            <SkeletonBox style={{ height: 180 }} className="rounded-xl" />
            <CategoryStripSkeleton />
            <ProductGridSkeleton count={4} />
          </View>
        ) : (
          <>
            {/* Barra de dirección */}
            <View
              className="mx-4 mt-3 flex-row items-center p-4 rounded-xl"
              style={{ backgroundColor: "#F4F4F0" }}
            >
              <Feather name="map-pin" size={18} color="#1FAF55" />
              <View className="ml-2 flex-1">
                <Text style={{ fontSize: 9, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, color: "#6D7B6C" }}>
                  Entregar en
                </Text>
                <Text className="text-sm font-semibold text-gray-800" numberOfLines={1}>
                  {cliente?.direccion || "Florencia, Caquetá"}
                </Text>
              </View>
              <Feather name="chevron-down" size={18} color="#6D7B6C" />
            </View>

            {/* Hero Banner */}
            <View className="mx-4 mt-4 rounded-xl overflow-hidden" style={{ height: 190 }}>
              <ShimmerImage
                imageUrl={patrocinados[0]?.imagen_url || "https://cdn.shopify.com/s/files/1/0906/3084/8816/collections/Diseno_sin_titulo_23.png"}
                style={{ width: "100%", height: 190, position: "absolute" }}
                contentFit="cover"
              />
              <LinearGradient
                colors={["rgba(0,0,0,0.8)", "transparent"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ position: "absolute", width: "100%", height: "100%" }}
              />
              <View className="flex-1 justify-center px-5" style={{ gap: 6 }}>
                <View className="self-start px-2 py-1 rounded" style={{ backgroundColor: "#D33587" }}>
                  <Text style={{ color: "#fff", fontSize: 8, fontWeight: "800", letterSpacing: 1.5, textTransform: "uppercase" }}>
                    Oferta Relámpago
                  </Text>
                </View>
                <Text style={{ color: "#fff", fontSize: 24, fontWeight: "800", lineHeight: 28 }}>
                  Aguardiente{"\n"}en Descuento
                </Text>
                <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 12 }}>
                  Llega en menos de 15 minutos
                </Text>
                <Pressable
                  className="self-start mt-1 px-5 py-2 rounded-xl"
                  style={{ backgroundColor: "#1FAF55" }}
                >
                  <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>Pedir ahora</Text>
                </Pressable>
              </View>
            </View>

            {/* Categorías */}
            <View className="px-4 pt-5 pb-2">
              <View className="flex-row justify-between items-center mb-3">
                <Text style={{ fontSize: 18, fontWeight: "700", color: "#1A1C1A" }}>Categorías</Text>
                <Text style={{ fontSize: 11, fontWeight: "700", color: "#1FAF55", textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Ver todas
                </Text>
              </View>
              <CategoryStrip
                categorias={categorias}
                onSelect={(id) => router.push(`/category/${id}`)}
              />
            </View>

            {/* Destacados */}
            <View className="px-4 pt-3 pb-4">
              <Text style={{ fontSize: 18, fontWeight: "700", color: "#1A1C1A", marginBottom: 12 }}>
                Destacados de la Semana
              </Text>
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

            {/* Express Banner */}
            <View className="mx-4 mb-4 rounded-xl overflow-hidden" style={{ backgroundColor: "#D33587" }}>
              <View className="flex-row items-center p-5">
                <View className="flex-1" style={{ gap: 4 }}>
                  <Text style={{ fontSize: 9, fontWeight: "700", color: "rgba(255,255,255,0.7)", letterSpacing: 2, textTransform: "uppercase" }}>
                    Servicio Express
                  </Text>
                  <Text style={{ fontSize: 22, fontWeight: "900", color: "#fff", fontStyle: "italic", textTransform: "uppercase", lineHeight: 26 }}>
                    Florencia{"\n"}En 15 Minutos
                  </Text>
                  <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.8)", marginTop: 4 }}>
                    Tarifa plana de envío $2.000
                  </Text>
                </View>
                <Text style={{ fontSize: 50, opacity: 0.25 }}>🛵</Text>
              </View>
            </View>
          </>
        )}
      </ScrollView>

      {/* Floating Cart Bar */}
      {itemCount > 0 && (
        <Pressable
          onPress={() => router.push("/(tabs)/cart")}
          className="absolute left-4 right-4"
          style={{
            bottom: 80,
            backgroundColor: "rgba(255,255,255,0.92)",
            borderRadius: 16,
            padding: 14,
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.12,
            shadowRadius: 16,
            elevation: 10,
          }}
        >
          <View className="flex-row items-center">
            <View
              className="items-center justify-center rounded-lg"
              style={{ width: 32, height: 32, backgroundColor: "#1FAF55" }}
            >
              <Text style={{ color: "#fff", fontWeight: "800", fontSize: 13 }}>{itemCount}</Text>
            </View>
            <View className="ml-3">
              <Text style={{ fontSize: 9, fontWeight: "700", color: "#9E9E9E", textTransform: "uppercase", letterSpacing: 0.5 }}>
                Tu Pedido
              </Text>
              <Text style={{ fontSize: 14, fontWeight: "800", color: "#1A1C1A" }}>
                {formatCOP(total)}
              </Text>
            </View>
          </View>
          <View className="px-5 py-2 rounded-lg" style={{ backgroundColor: "#D33587" }}>
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Ver Carrito
            </Text>
          </View>
        </Pressable>
      )}
    </View>
  );
}
