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
}

export function ProductCard({ product, onPress }: Props) {
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
        className="bg-white rounded-2xl overflow-hidden"
        style={{
          padding: 12,
          borderRadius: 16,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.04,
          shadowRadius: 12,
          elevation: 2,
        }}
      >
        {/* Imagen del producto */}
        <View
          className="w-full overflow-hidden"
          style={{ borderRadius: 12, backgroundColor: "#FAFAF6" }}
        >
          <ShimmerImage
            imageUrl={product.imagen_url}
            fallbackCategory={product.categoria}
            style={{ width: "100%", aspectRatio: 1 }}
            contentFit="contain"
          />
        </View>

        {/* Info del producto */}
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
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: "#1FAF55",
              }}
            >
              <Text className="text-white text-xl font-bold" style={{ marginTop: -1 }}>
                +
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </AnimatedPressable>
  );
}
