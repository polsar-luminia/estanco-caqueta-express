import { View, Text, Pressable } from "react-native";
import Animated from "react-native-reanimated";
import Toast from "react-native-toast-message";
import { formatCOP } from "../lib/format";
import { useCartStore } from "../stores/cart";
import { useScalePress } from "../hooks/useScalePress";
import { ShimmerImage } from "./ShimmerImage";
import type { Producto } from "../lib/api";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface Props {
  product: Producto;
  onPress: () => void;
  badge?: string;
}

export function ProductCard({ product, onPress, badge }: Props) {
  const addItem = useCartStore((s) => s.addItem);
  const { animatedStyle, onPressIn, onPressOut } = useScalePress();

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
    <AnimatedPressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={[animatedStyle, { flex: 1 }]}
    >
      <View
        className="bg-white overflow-hidden"
        style={{
          padding: 12,
          borderRadius: 16,
          shadowColor: "#1A1C1A",
          shadowOffset: { width: 0, height: 12 },
          shadowOpacity: 0.04,
          shadowRadius: 32,
          elevation: 2,
        }}
      >
        {/* Imagen con badge */}
        <View
          className="w-full overflow-hidden"
          style={{ borderRadius: 12, backgroundColor: "#FAFAF6" }}
        >
          {badge && (
            <View
              className="absolute top-2 left-2 z-10 px-2 py-1 rounded"
              style={{ backgroundColor: "#D33587" }}
            >
              <Text className="text-white font-bold" style={{ fontSize: 8, letterSpacing: 0.5, textTransform: "uppercase" }}>
                {badge}
              </Text>
            </View>
          )}
          <ShimmerImage
            imageUrl={product.imagen_url}
            fallbackCategory={product.categoria}
            style={{ width: "100%", aspectRatio: 1 }}
            contentFit="cover"
          />
        </View>

        {/* Info */}
        <View className="mt-3">
          <Text
            className="text-sm font-bold text-gray-900"
            numberOfLines={2}
          >
            {product.nombre}
          </Text>

          <View className="flex-row items-center justify-between mt-2">
            <Text
              className="font-bold text-lg"
              style={{ color: "#D33587" }}
            >
              {formatCOP(product.precio_app)}
            </Text>

            <Pressable
              onPress={(e) => {
                e.stopPropagation?.();
                handleAdd();
              }}
              className="items-center justify-center"
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: "#1FAF55",
              }}
            >
              <Text className="text-white text-lg font-bold" style={{ marginTop: -1 }}>
                +
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </AnimatedPressable>
  );
}
