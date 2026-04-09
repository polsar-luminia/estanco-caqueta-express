import { View, Text, ScrollView, FlatList, RefreshControl, Pressable } from "react-native";
import { useRef, useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { getCategorias, getDestacados, getPatrocinados, getHeroModo } from "../../src/lib/api";
import { useCartStore } from "../../src/stores/cart";
import { useAuthStore } from "../../src/stores/auth";
import { useTiendaAbierta } from "../../src/hooks/useTiendaAbierta";
import { ProductCard } from "../../src/components/ProductCard";
import { CategoryStrip } from "../../src/components/CategoryStrip";
import { ShimmerImage } from "../../src/components/ShimmerImage";
import { ProductGridSkeleton } from "../../src/components/skeletons/ProductGridSkeleton";
import { CategoryStripSkeleton } from "../../src/components/skeletons/CategoryStripSkeleton";
import { SkeletonBox } from "../../src/components/skeletons/SkeletonBox";
import { formatCOP } from "../../src/lib/format";
import type { Patrocinado } from "../../src/lib/api";
import { Dimensions } from "react-native";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const TIPO_CFG: Record<string, { label: string; color: string }> = {
  banner:           { label: "Descuento",        color: "#6B7280" },
  oferta:           { label: "Oferta",           color: "#D33587" },
  oferta_relampago: { label: "Oferta Relámpago", color: "#DC2626" },
  promocion:        { label: "Promoción",        color: "#7C3AED" },
  imperdible:       { label: "Imperdible",       color: "#EA580C" },
  irresistible:     { label: "Irresistible",     color: "#DC2626" },
};

const FALLBACK_IMG = "https://cdn.shopify.com/s/files/1/0906/3084/8816/collections/Diseno_sin_titulo_23.png";

function HeroSlide({ banner, onPress }: { banner: Patrocinado | undefined; onPress: () => void }) {
  const cfg = TIPO_CFG[banner?.tipo ?? "banner"] ?? TIPO_CFG["banner"];
  const titulo = banner?.titulo ?? "Descuentos en\ndomicilio";
  const imgUrl = banner?.imagen_url ?? FALLBACK_IMG;

  return (
    <View style={{ width: SCREEN_WIDTH - 32, height: 220, borderRadius: 12, overflow: "hidden" }}>
      <ShimmerImage
        imageUrl={imgUrl}
        style={{ width: "100%", height: 220, position: "absolute" }}
        contentFit="cover"
      />
      <LinearGradient
        colors={["rgba(0,0,0,0.8)", "transparent"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ position: "absolute", width: "100%", height: "100%" }}
      />
      <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: 20, gap: 6 }}>
        <View style={{ width: "58%", gap: 6 }}>
          <View style={{ alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, backgroundColor: cfg.color }}>
            <Text style={{ color: "#fff", fontSize: 8, fontWeight: "800", letterSpacing: 1.5, textTransform: "uppercase" }}>
              {cfg.label}
            </Text>
          </View>
          <Text style={{ color: "#fff", fontSize: 22, fontWeight: "800", lineHeight: 26 }}>
            {titulo}
          </Text>
          <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 11 }}>
            Domicilio en Florencia
          </Text>
          <Pressable
            style={{ alignSelf: "flex-start", marginTop: 4, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 12, backgroundColor: "#1FAF55" }}
            onPress={onPress}
          >
            <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>Pedir ahora</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function HeroCarousel({ banners, router }: { banners: Patrocinado[]; router: ReturnType<typeof useRouter> }) {
  const flatRef = useRef<FlatList>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  // Clon del primer banner al final para scroll infinito hacia la derecha
  const extended = banners.length > 1 ? [...banners, banners[0]] : banners;

  useEffect(() => {
    if (banners.length <= 1) return;
    const timer = setInterval(() => {
      const next = activeIndex + 1; // puede llegar hasta extended.length - 1 (el clon)
      flatRef.current?.scrollToIndex({ index: next, animated: true });
      setActiveIndex(next);
    }, 7000);
    return () => clearInterval(timer);
  }, [activeIndex, banners.length]);

  const handleScrollEnd = (e: any) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / (SCREEN_WIDTH - 32));
    if (idx >= banners.length) {
      // Llegamos al clon — jump silencioso al real sin animación
      flatRef.current?.scrollToIndex({ index: 0, animated: false });
      setActiveIndex(0);
    } else {
      setActiveIndex(idx);
    }
  };

  const dotIndex = activeIndex % banners.length;

  return (
    <View>
      <FlatList
        ref={flatRef}
        data={extended}
        horizontal
        pagingEnabled={false}
        snapToInterval={SCREEN_WIDTH - 32}
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        onMomentumScrollEnd={handleScrollEnd}
        renderItem={({ item }) => (
          <HeroSlide
            banner={item}
            onPress={() => item.producto?.id ? router.push(`/product/${item.producto.id}`) : null}
          />
        )}
      />
      {banners.length > 1 && (
        <View style={{ flexDirection: "row", justifyContent: "center", paddingTop: 8, gap: 6 }}>
          {banners.map((_, i) => (
            <View
              key={i}
              style={{
                width: dotIndex === i ? 20 : 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: dotIndex === i ? "#1FAF55" : "#D1D5DB",
              }}
            />
          ))}
        </View>
      )}
    </View>
  );
}


export default function HomeScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const cliente = useAuthStore((s) => s.cliente);
  const itemCount = useCartStore((s) => s.items.reduce((n, i) => n + i.cantidad, 0));
  const total = useCartStore((s) => s.items.reduce((t, i) => t + i.precioUnitario * i.cantidad, 0));

  const tienda = useTiendaAbierta();

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

  const { data: heroModo = "static" } = useQuery({
    queryKey: ["hero-modo"],
    queryFn: getHeroModo,
    staleTime: 5 * 60 * 1000,
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
            {/* Banner cerrado */}
            {!tienda.abierta && (
              <View
                className="mx-4 mt-3 rounded-xl overflow-hidden"
                style={{ backgroundColor: "#1A1C1A" }}
              >
                {/* Fila principal */}
                <View className="flex-row items-center px-4 pt-4 pb-3">
                  <View
                    style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#6B7280", marginRight: 10 }}
                  />
                  <View className="flex-1">
                    <Text style={{ fontSize: 13, fontWeight: "700", color: "#fff" }}>
                      Estamos cerrados
                    </Text>
                    <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", marginTop: 1 }}>
                      {tienda.proximaApertura} · Puedes explorar el catálogo
                    </Text>
                  </View>
                </View>
                {/* Horarios */}
                <View
                  style={{ borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.08)", marginHorizontal: 16, paddingVertical: 10, gap: 5 }}
                >
                  {[
                    { dias: "Lun – Jue", hora: "8:00 am – 7:00 pm" },
                    { dias: "Vie – Sáb", hora: "8:00 am – 12:00 am" },
                    { dias: "Domingo",   hora: "9:00 am – 4:30 pm" },
                  ].map(({ dias, hora }) => (
                    <View key={dias} style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>{dias}</Text>
                      <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", fontWeight: "600" }}>{hora}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

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
            </View>

            {/* Hero Banner */}
            <View className="mx-4 mt-4">
              {heroModo === "carousel" && patrocinados.length > 0 ? (
                <HeroCarousel banners={patrocinados} router={router} />
              ) : (
                <HeroSlide
                  banner={patrocinados[0]}
                  onPress={() => patrocinados[0]?.producto?.id ? router.push(`/product/${patrocinados[0].producto.id}`) : null}
                />
              )}
            </View>

            {/* Categorías */}
            <View className="px-4 pt-5 pb-2">
              <View className="flex-row justify-between items-center mb-3">
                <Text style={{ fontSize: 18, fontWeight: "700", color: "#1A1C1A" }}>Categorías</Text>
                <Pressable onPress={() => router.push("/(tabs)/search")}>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: "#1FAF55", textTransform: "uppercase", letterSpacing: 0.5 }}>
                    Ver todas
                  </Text>
                </Pressable>
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
                renderItem={({ item }) => (
                  <ProductCard
                    product={item}
                    onPress={() => router.push(`/product/${item.id}`)}
                    badge={(item as any).badge || undefined}
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
                    Domicilio{"\n"}En Florencia
                  </Text>
                  <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.8)", marginTop: 4 }}>
                    Envío $5.000 • Gratis con puntos
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
