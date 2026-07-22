import { View, Text, ScrollView, FlatList, RefreshControl, Pressable, type NativeSyntheticEvent, type NativeScrollEvent } from "react-native";
import { useRef, useState, useEffect } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { colors } from "../../src/constants/theme";
import { getCategorias, getDestacados, getPatrocinados, getHeroModo, getCombos, getOfertas, getDirecciones, type Combo } from "../../src/lib/api";
import { filtrarCategoriasIOS, filtrarProductosIOS, filtrarConProductoIOS } from "../../src/lib/iosFilters";
import { OfertasBannerCard } from "../../src/components/OfertasBannerCard";
import { useCartStore } from "../../src/stores/cart";
import { useAuthStore } from "../../src/stores/auth";
import { useTiendaAbierta } from "../../src/hooks/useTiendaAbierta";
import { ProductCard } from "../../src/components/ProductCard";
import { CategoryStrip } from "../../src/components/CategoryStrip";
import { BandaCerrado } from "../../src/components/BandaCerrado";
import { ShimmerImage } from "../../src/components/ShimmerImage";
import { ProductGridSkeleton } from "../../src/components/skeletons/ProductGridSkeleton";
import { CategoryStripSkeleton } from "../../src/components/skeletons/CategoryStripSkeleton";
import { SkeletonBox } from "../../src/components/skeletons/SkeletonBox";
import { ErrorState } from "../../src/components/ErrorState";
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

function HeroSlide({ banner, onPress }: { banner: Patrocinado | undefined; onPress: () => void }) {
  const cfg = TIPO_CFG[banner?.tipo ?? "banner"] ?? TIPO_CFG["banner"];
  const titulo = banner?.titulo ?? "Descuentos en\ndomicilio";
  const imgUrl = banner?.imagen_url;

  return (
    // Fondo de marca como fallback: si el banner no trae imagen, el hero se ve
    // intencional en verde en vez de depender de un CDN externo que puede romperse.
    <View style={{ width: SCREEN_WIDTH - 32, height: 220, borderRadius: 12, overflow: "hidden", backgroundColor: "#1FAF55" }}>
      {imgUrl ? (
        <ShimmerImage
          imageUrl={imgUrl}
          style={{ width: "100%", height: 220, position: "absolute" }}
          contentFit="cover"
        />
      ) : null}
      <LinearGradient
        colors={["rgba(0,0,0,0.52)", "rgba(0,0,0,0.10)"]}
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
  const activeIndexRef = useRef(0);
  const [activeIndex, setActiveIndex] = useState(0);

  // Clon del primer banner al final para scroll infinito hacia la derecha
  const extended = banners.length > 1 ? [...banners, banners[0]] : banners;

  useEffect(() => {
    if (banners.length <= 1) return;
    const timer = setInterval(() => {
      const next = activeIndexRef.current + 1;
      // Si rebasamos el clon (último índice de extended), volvemos al real sin animación
      if (next >= extended.length) {
        flatRef.current?.scrollToIndex({ index: 0, animated: false });
        activeIndexRef.current = 0;
        setActiveIndex(0);
        return;
      }
      flatRef.current?.scrollToIndex({ index: next, animated: true });
      activeIndexRef.current = next;
      setActiveIndex(next);
    }, 7000);
    return () => clearInterval(timer);
  }, [banners.length, extended.length]);

  const handleScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / (SCREEN_WIDTH - 32));
    if (idx >= banners.length) {
      // Llegamos al clon — jump silencioso al real sin animación
      flatRef.current?.scrollToIndex({ index: 0, animated: false });
      activeIndexRef.current = 0;
      setActiveIndex(0);
    } else {
      activeIndexRef.current = idx;
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
        onScrollToIndexFailed={() => {
          // Defensa: si el render aún no expone el índice solicitado, reseteamos al inicio.
          flatRef.current?.scrollToIndex({ index: 0, animated: false });
          activeIndexRef.current = 0;
          setActiveIndex(0);
        }}
        renderItem={({ item }) => (
          <HeroSlide
            banner={item}
            onPress={() => router.push(item.producto?.id ? `/product/${item.producto.id}` : "/ofertas")}
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


// Header verde de bloque del Inicio (rediseño Vibrante): ubicación de entrega,
// accesos a perfil/carrito y buscador. Reemplaza el header del logo + la vieja
// barra de dirección.
function HomeHeader({
  insets, dirActiva, isAuthenticated, itemCount, router,
}: {
  insets: { top: number };
  dirActiva: string | null;
  isAuthenticated: boolean;
  itemCount: number;
  router: ReturnType<typeof useRouter>;
}) {
  const iconBtn = {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center" as const, justifyContent: "center" as const,
  };
  return (
    <View
      style={{
        backgroundColor: colors.green,
        paddingTop: insets.top + 8,
        paddingHorizontal: 16,
        paddingBottom: 16,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
        shadowColor: colors.greenDeep,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.35,
        shadowRadius: 18,
        elevation: 8,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
        <Pressable
          onPress={() => router.push(isAuthenticated ? "/profile/direcciones" : "/(auth)/login")}
          style={{ flex: 1, paddingRight: 12 }}
          hitSlop={6}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Feather name="map-pin" size={11} color="rgba(255,255,255,0.85)" />
            <Text style={{ fontSize: 10.5, fontWeight: "600", color: "rgba(255,255,255,0.85)" }}>Entregar en</Text>
          </View>
          <Text style={{ fontSize: 14, fontWeight: "800", color: "#fff", marginTop: 1 }} numberOfLines={1}>
            {isAuthenticated ? (dirActiva || "Agrega tu dirección") : "Florencia, Caquetá"} ▾
          </Text>
        </Pressable>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable onPress={() => router.push("/profile")} style={iconBtn} accessibilityLabel="Mi perfil" accessibilityRole="button">
            <Feather name="user" size={19} color="#fff" />
          </Pressable>
          <Pressable onPress={() => router.push("/(tabs)/cart")} style={iconBtn} accessibilityLabel="Carrito" accessibilityRole="button">
            <Feather name="shopping-bag" size={18} color="#fff" />
            {itemCount > 0 && (
              <View style={{ position: "absolute", top: -4, right: -4, minWidth: 16, height: 16, paddingHorizontal: 3, borderRadius: 999, backgroundColor: colors.offer, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: "#fff", fontSize: 9, fontWeight: "800" }}>{itemCount > 99 ? "99+" : itemCount}</Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>
      <Pressable
        onPress={() => router.push("/(tabs)/search")}
        style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#fff", borderRadius: 14, paddingHorizontal: 13, paddingVertical: 11 }}
        accessibilityLabel="Buscar"
        accessibilityRole="button"
      >
        <Feather name="search" size={16} color={colors.faint} />
        <Text style={{ fontSize: 12.5, color: colors.faint, fontWeight: "500" }}>Busca tu licor favorito</Text>
      </Pressable>
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const cliente = useAuthStore((s) => s.cliente);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  // Selectores inline (no metodos): los metodos del store no son reactivos a cambios
  // del state — el banner inferior no desaparecia al limpiar carrito tras crear pedido.
  const itemCount = useCartStore((s) => s.items.reduce((sum, i) => sum + i.cantidad, 0));
  const total = useCartStore((s) => s.items.reduce((sum, i) => sum + i.cantidad * i.precioUnitario, 0));

  const tienda = useTiendaAbierta();

  const { data: categoriasRaw = [], isLoading: loadCat, isError: errorCat, isFetching: fetchCat } = useQuery({
    queryKey: ["categorias"],
    queryFn: getCategorias,
  });

  const { data: destacadosRaw = [], isLoading: loadDest, isError: errorDest, isFetching: fetchDest } = useQuery({
    queryKey: ["destacados"],
    queryFn: getDestacados,
  });

  const { data: patrocinadosRaw = [], isLoading: loadPat, isFetching: fetchPat } = useQuery({
    queryKey: ["patrocinados"],
    queryFn: getPatrocinados,
  });

  const { data: heroModo = "static" } = useQuery({
    queryKey: ["hero-modo"],
    queryFn: getHeroModo,
    staleTime: 5 * 60 * 1000,
  });

  const { data: ofertasRaw = [] } = useQuery({
    queryKey: ["ofertas"],
    queryFn: getOfertas,
  });

  const { data: combosRaw = [] } = useQuery({
    queryKey: ['combos'],
    queryFn: getCombos,
    staleTime: 5 * 60 * 1000,
  });

  // Mismo queryKey que cart.tsx → cache compartida, sin fetch extra.
  // enabled gateado: invitado no dispara /clientes/direcciones (evita 401).
  const { data: direcciones = [] } = useQuery({
    queryKey: ["direcciones"],
    queryFn: getDirecciones,
    enabled: isAuthenticated,
    staleTime: 60 * 1000,
  });
  const dirPred = direcciones.find((d) => d.predeterminada) || direcciones[0];
  const dirActiva = dirPred?.direccion ?? cliente?.direccion ?? null;

  // Apple §1.4.3 — defensa cliente para iOS por si el backend devuelve tabaco
  // (ej: cache vencido o regresión). El header X-Platform ya filtra server-side.
  const categorias = filtrarCategoriasIOS(categoriasRaw);
  const destacados = filtrarProductosIOS(destacadosRaw);
  const patrocinados = filtrarConProductoIOS(patrocinadosRaw);
  const ofertas = filtrarConProductoIOS(ofertasRaw);
  const combos = filtrarConProductoIOS(combosRaw);

  const isLoading = loadCat || loadDest || loadPat;
  // Error total: ambas queries principales fallaron y no hay datos cacheados
  const isError = (errorCat || errorDest) && !isLoading && categorias.length === 0 && destacados.length === 0;
  const isFetching = fetchCat || fetchDest || fetchPat;

  const onRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["categorias"] });
    queryClient.invalidateQueries({ queryKey: ["destacados"] });
    queryClient.invalidateQueries({ queryKey: ["patrocinados"] });
    queryClient.invalidateQueries({ queryKey: ["ofertas"] });
  };

  return (
    <View className="flex-1" style={{ backgroundColor: colors.bg }}>
      <HomeHeader
        insets={insets}
        dirActiva={dirActiva}
        isAuthenticated={isAuthenticated}
        itemCount={itemCount}
        router={router}
      />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: itemCount > 0 ? 172 : 102 }}
        refreshControl={
          <RefreshControl refreshing={!isLoading && isFetching} onRefresh={onRefresh} colors={["#1FAF55"]} />
        }
      >
        {isLoading ? (
          <View className="px-4 pt-4" style={{ gap: 16 }}>
            <SkeletonBox style={{ height: 56 }} className="rounded-xl" />
            <SkeletonBox style={{ height: 180 }} className="rounded-xl" />
            <CategoryStripSkeleton />
            <ProductGridSkeleton count={4} />
          </View>
        ) : isError ? (
          <View style={{ flex: 1, paddingTop: 80 }}>
            <ErrorState mensaje="No pudimos cargar el catálogo" onRetry={onRefresh} />
          </View>
        ) : (
          <>
            {/* Banda de tienda cerrada — motivo/estilo lo decide el backend */}
            <BandaCerrado tienda={tienda} style={{ marginHorizontal: 16, marginTop: 12 }} />

            {/* Categorías — arriba del hero (intención de compra primero) */}
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

            {/* Hero Banner — debajo de categorías (marketing después de utilidad) */}
            <View className="mx-4 mt-4">
              {patrocinados.length > 0 && (
                heroModo === "carousel" ? (
                  <HeroCarousel banners={patrocinados} router={router} />
                ) : (
                  <HeroSlide
                    banner={patrocinados[0]}
                    onPress={() => router.push(patrocinados[0]?.producto?.id ? `/product/${patrocinados[0].producto.id}` : "/ofertas")}
                  />
                )
              )}
            </View>

            {/* Ofertas — banner card prominente */}
            {ofertas.length > 0 && (
              <View className="px-4 pt-4">
                <OfertasBannerCard
                  ofertas={ofertas}
                  onPress={() => router.push("/ofertas")}
                />
              </View>
            )}

            {/* Combos — productos únicos con metadata especial (precio combo + fechas).
                El tap navega al producto subyacente (creado en Tryton/Shopify). */}
            {combos.length > 0 && (
              <View className="px-4 pt-3 pb-2">
                <Text style={{ fontSize: 18, fontWeight: '700', color: '#1A1C1A', marginBottom: 12 }}>Combos</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16, paddingHorizontal: 16 }}>
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    {combos.map((combo: Combo) => (
                      <Pressable
                        key={combo.id}
                        onPress={() => {
                          if (!combo.producto?.id) return;
                          const productoId = combo.producto.id;
                          const precioApp = combo.producto.precio_app;
                          const url = combo.precio_combo != null && precioApp != null && combo.precio_combo < precioApp
                            ? `/product/${productoId}?ofertaPrecio=${combo.precio_combo}`
                            : `/product/${productoId}`;
                          router.push(url);
                        }}
                        style={{ width: 180, backgroundColor: '#fff', borderRadius: 16, padding: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 2 }}
                      >
                        {combo.producto?.imagen_url ? (
                          <ShimmerImage
                            imageUrl={combo.producto.imagen_url}
                            fallbackCategory={combo.producto.categoria}
                            style={{ width: '100%', height: 100, borderRadius: 10, marginBottom: 10 }}
                            contentFit="cover"
                          />
                        ) : null}
                        {combo.precio_original && (
                          <Text style={{ fontSize: 10, color: '#9E9E9E', textDecorationLine: 'line-through', marginBottom: 2 }}>{formatCOP(combo.precio_original)}</Text>
                        )}
                        <Text style={{ fontSize: 18, fontWeight: '800', color: colors.ink, marginBottom: 4 }}>{formatCOP(combo.precio_combo)}</Text>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: '#1A1C1A', marginBottom: 4 }} numberOfLines={2}>{combo.nombre}</Text>
                        {combo.descripcion && <Text style={{ fontSize: 11, color: '#6D7B6C' }} numberOfLines={2}>{combo.descripcion}</Text>}
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>
              </View>
            )}

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
                    badge={item.badge || undefined}
                    badgeTexto={item.badge_texto}
                    badgeColor={item.badge_color}
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
