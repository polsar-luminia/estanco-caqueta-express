import { useState, useEffect } from "react";
import { View, Text, Pressable, Dimensions, ScrollView as RNScrollView } from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import Toast from "react-native-toast-message";
import { getProducto, getSugerencias } from "../../src/lib/api";
import { ProductCard } from "../../src/components/ProductCard";
import { tracker } from "../../src/lib/tracker";
import { useCartStore } from "../../src/stores/cart";
import { formatCOP } from "../../src/lib/format";
import { ShimmerImage } from "../../src/components/ShimmerImage";
import { SkeletonBox } from "../../src/components/skeletons/SkeletonBox";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const HEADER_MAX = SCREEN_HEIGHT * 0.45;

/* ── Inline SVG icons (no icon lib installed) ─────────────── */

function CheckIcon() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20 6L9 17l-5-5"
        stroke="#1FAF55"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function MinusIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 12h14"
        stroke="#1A1C1A"
        strokeWidth={2.5}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function PlusIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 5v14M5 12h14"
        stroke="#1A1C1A"
        strokeWidth={2.5}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/* ── Skeleton loader ──────────────────────────────────────── */

function ProductDetailSkeleton() {
  return (
    <View className="flex-1 bg-white">
      <SkeletonBox
        style={{ width: "100%", height: HEADER_MAX }}
        className="rounded-none"
      />
      <View className="p-5" style={{ gap: 10 }}>
        <SkeletonBox style={{ width: "30%", height: 12 }} className="rounded" />
        <SkeletonBox style={{ width: "45%", height: 14 }} className="rounded" />
        <SkeletonBox style={{ width: "75%", height: 24 }} className="rounded" />
        <SkeletonBox style={{ width: "40%", height: 20 }} className="rounded" />
        <SkeletonBox
          style={{ width: "100%", height: 80 }}
          className="rounded mt-3"
        />
      </View>
    </View>
  );
}

/* ── Main screen ──────────────────────────────────────────── */

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const addItemWithQuantity = useCartStore((s) => s.addItemWithQuantity);
  const scrollY = useSharedValue(0);
  const [quantity, setQuantity] = useState(1);

  const { data: product, isLoading } = useQuery({
    queryKey: ["producto", id],
    queryFn: () => getProducto(Number(id)),
  });

  const { data: sugerencias = [] } = useQuery({
    queryKey: ["sugerencias", id],
    queryFn: () => getSugerencias(Number(id)),
    enabled: !!id,
  });

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const headerStyle = useAnimatedStyle(() => ({
    height: interpolate(
      scrollY.value,
      [0, HEADER_MAX],
      [HEADER_MAX, 0],
      Extrapolation.CLAMP,
    ),
    opacity: interpolate(
      scrollY.value,
      [0, HEADER_MAX * 0.6],
      [1, 0],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        scale: interpolate(
          scrollY.value,
          [-100, 0],
          [1.3, 1],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  useEffect(() => {
    if (!product) return;
    const entrada = Date.now();
    tracker.track('producto_visto', { producto_id: product.id, nombre: product.nombre, categoria: product.categoria }, 'product/[id]');
    return () => {
      const segundos = Math.round((Date.now() - entrada) / 1000);
      if (segundos > 2) tracker.track('tiempo_en_producto', { producto_id: product.id, segundos }, 'product/[id]');
    };
  }, [product?.id]);

  if (isLoading || !product) {
    return <ProductDetailSkeleton />;
  }

  const inStock = product.stock_total > 0;

  const handleAdd = () => {
    addItemWithQuantity({
      productoId: product.id,
      nombre: product.nombre,
      precioUnitario: product.precio_app,
      imagenUrl: product.imagen_url || undefined,
    }, quantity);
    Toast.show({
      type: "success",
      text1: "Agregado al carrito",
      text2: `${product.nombre} x${quantity}`,
      visibilityTime: 1500,
    });
    setQuantity(1);
  };

  const decrement = () => setQuantity((q) => Math.max(1, q - 1));
  const increment = () => setQuantity((q) => q + 1);

  return (
    <View className="flex-1 bg-white">
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", paddingTop: 56, paddingBottom: 12, paddingHorizontal: 16, backgroundColor: "#fff" }}>
        <Pressable onPress={() => router.back()} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <Path d="M15 18l-6-6 6-6" stroke="#1A1C1A" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          <Text style={{ fontSize: 15, fontWeight: "600", color: "#1A1C1A" }}>Volver</Text>
        </Pressable>
      </View>

      {/* ── Scrollable content ───────────────────────────── */}
      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* Hero image */}
        <Animated.View
          style={[headerStyle, { overflow: "hidden", backgroundColor: "#FFFFFF" }]}
        >
          <View style={{ width: SCREEN_WIDTH, height: HEADER_MAX, alignItems: "center", justifyContent: "center" }}>
            <View
              style={{
                width: SCREEN_WIDTH * 0.75,
                height: SCREEN_WIDTH * 0.75,
                elevation: 10,
                backgroundColor: "transparent",
              }}
            >
              <ShimmerImage
                imageUrl={product.imagen_url}
                fallbackCategory={product.categoria}
                style={{
                  width: SCREEN_WIDTH * 0.75,
                  height: SCREEN_WIDTH * 0.75,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 20 },
                  shadowOpacity: 0.3,
                  shadowRadius: 40,
                }}
                contentFit="contain"
              />
            </View>
          </View>
        </Animated.View>

        {/* Product details */}
        <View className="px-5 pt-6" style={{ gap: 12 }}>
          {/* Category + Availability row */}
          <View className="flex-row items-center justify-between">
            <Text className="text-sm font-extrabold uppercase tracking-widest text-magenta-500">
              {product.categoria}
            </Text>

            {inStock ? (
              <View className="flex-row items-center rounded-full bg-brand-500/10 px-3 py-1">
                <CheckIcon />
                <Text className="ml-1 text-xs font-semibold text-brand-500">
                  Disponible
                </Text>
              </View>
            ) : (
              <View className="rounded-full bg-red-500/10 px-3 py-1">
                <Text className="text-xs font-semibold text-red-500">
                  Agotado
                </Text>
              </View>
            )}
          </View>

          {/* Title */}
          <Text className="text-3xl font-bold text-on-surface">
            {product.nombre}
          </Text>

          {/* Price */}
          <View style={{ gap: 2 }}>
            {product.precio_lista1 ? (
              <Text style={{ fontSize: 14, color: "#9E9E9E", textDecorationLine: "line-through" }}>
                {formatCOP(product.precio_lista1)}
              </Text>
            ) : null}
            <Text className="text-2xl font-extrabold text-brand-500">
              {formatCOP(product.precio_app)}
            </Text>
          </View>

          {/* Description — muestra solo si existe. Shopify no tiene body_html a abr-2026;
              ingresar vía admin.estancocaqueta.com o directamente en Shopify admin.
              El sync-shopify-app.js la trae automáticamente en el próximo ciclo. */}
          {product.descripcion ? (
            <View style={{ gap: 6 }}>
              <Text className="text-base font-bold text-on-surface">
                Descripcion
              </Text>
              <Text className="text-base leading-6 text-gray-600">
                {product.descripcion}
              </Text>
            </View>
          ) : null}

          {/* ── Quantity selector ─────────────────────────── */}
          <View className="mt-4 flex-row items-center justify-between">
            <Text className="text-base font-bold text-on-surface">
              Cantidad
            </Text>

            <View
              className="flex-row items-center rounded-full px-4 py-2"
              style={{ backgroundColor: "#F5F7FA", gap: 16 }}
            >
              {/* Minus */}
              <Pressable
                onPress={decrement}
                className="items-center justify-center rounded-full bg-white"
                style={{
                  width: 40,
                  height: 40,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.08,
                  shadowRadius: 4,
                  elevation: 2,
                }}
              >
                <MinusIcon />
              </Pressable>

              {/* Number */}
              <Text
                className="text-xl font-extrabold text-on-surface"
                style={{ minWidth: 28, textAlign: "center" }}
              >
                {quantity}
              </Text>

              {/* Plus */}
              <Pressable
                onPress={increment}
                className="items-center justify-center rounded-full bg-white"
                style={{
                  width: 40,
                  height: 40,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.08,
                  shadowRadius: 4,
                  elevation: 2,
                }}
              >
                <PlusIcon />
              </Pressable>
            </View>
          </View>

          {/* ── Botón agregar al carrito ───────────── */}
          <View style={{ paddingTop: 16, paddingBottom: sugerencias.length > 0 ? 16 : 48 }}>
            <Pressable
              onPress={handleAdd}
              disabled={!inStock}
              className={`items-center rounded-xl py-4 ${
                inStock ? "bg-brand-500" : "bg-gray-300"
              }`}
            >
              <Text className="text-base font-bold text-white">
                Agregar al carrito
                {quantity > 1 ? ` (${quantity})` : ""}
              </Text>
            </Pressable>
          </View>
          {/* ── También te puede gustar ───────────── */}
          {sugerencias.length > 0 && (
            <View style={{ paddingBottom: 48 }}>
              <Text style={{ fontSize: 16, fontWeight: "800", color: "#1A1C1A", marginBottom: 12 }}>
                También te puede gustar
              </Text>
              <RNScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                {sugerencias.map((item) => (
                  <View key={item.id} style={{ width: 160 }}>
                    <ProductCard
                      product={item}
                      onPress={() => {
                        tracker.track('sugerencia_clickeada', { desde_producto: product.id, producto_clickeado: item.id, nombre: item.nombre }, 'product/[id]');
                        router.push(`/product/${item.id}`);
                      }}
                    />
                  </View>
                ))}
              </RNScrollView>
            </View>
          )}
        </View>
      </Animated.ScrollView>
    </View>
  );
}
