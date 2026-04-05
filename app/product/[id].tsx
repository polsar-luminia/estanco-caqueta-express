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
import Toast from "react-native-toast-message";
import { getProducto } from "../../src/lib/api";
import { useCartStore } from "../../src/stores/cart";
import { formatCOP } from "../../src/lib/format";
import { ShimmerImage } from "../../src/components/ShimmerImage";
import { SkeletonBox } from "../../src/components/skeletons/SkeletonBox";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const HEADER_MAX = SCREEN_HEIGHT * 0.45;

function ProductDetailSkeleton() {
  return (
    <View className="flex-1 bg-white">
      <SkeletonBox style={{ width: "100%", height: HEADER_MAX }} className="rounded-none" />
      <View className="p-4" style={{ gap: 8 }}>
        <SkeletonBox style={{ width: "25%", height: 10 }} className="rounded" />
        <SkeletonBox style={{ width: "70%", height: 18 }} className="rounded" />
        <SkeletonBox style={{ width: "35%", height: 22 }} className="rounded" />
        <SkeletonBox style={{ width: "100%", height: 60 }} className="rounded mt-2" />
      </View>
    </View>
  );
}

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const addItem = useCartStore((s) => s.addItem);
  const scrollY = useSharedValue(0);

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
      Extrapolation.CLAMP
    ),
    opacity: interpolate(
      scrollY.value,
      [0, HEADER_MAX * 0.6],
      [1, 0],
      Extrapolation.CLAMP
    ),
    transform: [
      {
        scale: interpolate(
          scrollY.value,
          [-100, 0],
          [1.3, 1],
          Extrapolation.CLAMP
        ),
      },
    ],
  }));

  if (isLoading || !product) {
    return <ProductDetailSkeleton />;
  }

  const handleAdd = () => {
    addItem({
      productoId: product.id,
      nombre: product.nombre,
      precioUnitario: product.precio_app,
      imagenUrl: product.imagen_url || undefined,
    });
    Toast.show({
      type: "success",
      text1: "Agregado al carrito",
      text2: product.nombre,
      visibilityTime: 1500,
    });
  };

  return (
    <View className="flex-1 bg-white">
      <Animated.ScrollView onScroll={scrollHandler} scrollEventThrottle={16}>
        <Animated.View style={[headerStyle, { overflow: "hidden" }]}>
          <ShimmerImage
            imageUrl={product.imagen_url}
            fallbackCategory={product.categoria}
            style={{ width: "100%", height: HEADER_MAX }}
            contentFit="contain"
          />
        </Animated.View>

        <View className="p-4">
          <Text className="text-xs text-gray-500 uppercase mb-1">
            {product.categoria}
          </Text>
          <Text className="text-xl font-bold text-gray-800 mb-2">
            {product.nombre}
          </Text>
          <Text className="text-2xl font-bold text-brand-800 mb-4">
            {formatCOP(product.precio_app)}
          </Text>
          {product.descripcion && (
            <Text className="text-base text-gray-600 leading-6 mb-4">
              {product.descripcion}
            </Text>
          )}
          {product.stock_total > 0 ? (
            <Text className="text-sm text-green-600">Disponible</Text>
          ) : (
            <Text className="text-sm text-red-600">Agotado</Text>
          )}
        </View>
      </Animated.ScrollView>

      <View className="border-t border-gray-200 px-4 py-4">
        <Pressable
          onPress={handleAdd}
          disabled={product.stock_total <= 0}
          className={`rounded-xl py-4 items-center ${
            product.stock_total <= 0 ? "bg-gray-300" : "bg-brand-700"
          }`}
        >
          <Text className="text-white font-bold text-base">
            Agregar al carrito
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
