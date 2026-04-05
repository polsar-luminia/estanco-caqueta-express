import { useState } from "react";
import { View, Text, Pressable, Dimensions } from "react-native";
import { useLocalSearchParams } from "expo-router";
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
import { getProducto } from "../../src/lib/api";
import { useCartStore } from "../../src/stores/cart";
import { formatCOP } from "../../src/lib/format";
import { ShimmerImage } from "../../src/components/ShimmerImage";
import { SkeletonBox } from "../../src/components/skeletons/SkeletonBox";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
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
  const addItem = useCartStore((s) => s.addItem);
  const scrollY = useSharedValue(0);
  const [quantity, setQuantity] = useState(1);

  const { data: product, isLoading } = useQuery({
    queryKey: ["producto", id],
    queryFn: () => getProducto(Number(id)),
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

  if (isLoading || !product) {
    return <ProductDetailSkeleton />;
  }

  const inStock = product.stock_total > 0;

  const handleAdd = () => {
    for (let i = 0; i < quantity; i++) {
      addItem({
        productoId: product.id,
        nombre: product.nombre,
        precioUnitario: product.precio_app,
        imagenUrl: product.imagen_url || undefined,
      });
    }
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
      {/* ── Scrollable content ───────────────────────────── */}
      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* Hero image */}
        <Animated.View
          className="bg-surface-low items-center justify-center"
          style={[headerStyle, { minHeight: 400, overflow: "hidden" }]}
        >
          <ShimmerImage
            imageUrl={product.imagen_url}
            fallbackCategory={product.categoria}
            style={{
              width: "80%",
              height: 320,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 20 },
              shadowOpacity: 0.3,
              shadowRadius: 40,
              elevation: 10,
            }}
            contentFit="contain"
          />
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
          <Text className="text-2xl font-extrabold text-brand-500">
            {formatCOP(product.precio_app)}
          </Text>

          {/* Description */}
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
        </View>
      </Animated.ScrollView>

      {/* ── Bottom CTA (fixed) ───────────────────────────── */}
      <View
        className="absolute bottom-0 left-0 right-0 px-5 pb-8 pt-4"
        style={{
          backgroundColor: "rgba(255,255,255,0.95)",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.08,
          shadowRadius: 12,
          elevation: 8,
        }}
      >
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
    </View>
  );
}
