import { View, Text, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
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
      <LinearGradient
        colors={["#F3F4F6", "#FFFFFF"]}
        style={{ borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: "#F3F4F6" }}
      >
        <ShimmerImage
          imageUrl={product.imagen_url}
          fallbackCategory={product.categoria}
          style={{ width: "100%", height: 120 }}
          contentFit="contain"
        />
        <View style={{ padding: 12 }}>
          <Text className="text-xs text-gray-500 mb-1" numberOfLines={1}>
            {product.categoria}
          </Text>
          <Text className="text-sm font-medium text-gray-800 mb-2" numberOfLines={2}>
            {product.nombre}
          </Text>
          <View className="flex-row items-center justify-between">
            <Text className="text-base font-bold text-brand-800">
              {formatCOP(product.precio_app)}
            </Text>
            <Pressable
              onPress={(e) => {
                e.stopPropagation?.();
                handleAdd();
              }}
              className="bg-brand-700 rounded-lg px-3 py-1.5"
            >
              <Text className="text-white text-sm font-bold">+</Text>
            </Pressable>
          </View>
        </View>
      </LinearGradient>
    </AnimatedPressable>
  );
}
