import { View, Text, Pressable } from "react-native";
import Animated from "react-native-reanimated";
import Toast from "react-native-toast-message";
import { formatCOP } from "../lib/format";
import { useCartStore } from "../stores/cart";
import { useScalePress } from "../hooks/useScalePress";
import { ShimmerImage } from "./ShimmerImage";
import type { Producto } from "../lib/api";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface OfertaInfo {
  titulo?: string | null;
  precio_oferta?: number | null;
  precio_anterior?: number | null;
}

interface Props {
  product: Producto;
  onPress: () => void;
  badge?: string;
  // Si la card representa un producto en oferta, le pasamos la info para
  // pintar el badge custom y el precio tachado. Tiene prioridad sobre `badge`.
  oferta?: OfertaInfo;
  priority?: "low" | "normal" | "high";
}

export function ProductCard({ product, onPress, badge, oferta, priority = "normal" }: Props) {
  const addItem = useCartStore((s) => s.addItem);
  const { animatedStyle, onPressIn, onPressOut } = useScalePress();

  const agotado = (product.stock_total ?? 0) <= 0;

  // Precio efectivo: precio_oferta tiene prioridad sobre precio_app si está
  // definido. Para el carrito siempre usamos el efectivo (no doble cargo).
  const precioEfectivo = oferta?.precio_oferta ?? product.precio_app;
  const tienePrecioOferta = oferta?.precio_oferta != null && oferta?.precio_anterior != null;
  const precioTachado = oferta?.precio_anterior ?? product.precio_app;

  const handleAdd = () => {
    if (agotado) return;
    addItem({
      productoId: product.id,
      nombre: product.nombre,
      precioUnitario: precioEfectivo,
      imagenUrl: product.imagen_url || undefined,
      stockMaximo: product.stock_total,
    });
    Toast.show({
      type: "success",
      text1: "Agregado al carrito",
      text2: product.nombre,
      visibilityTime: 1500,
    });
  };

  // Badge: la oferta gana sobre badge legacy. Texto del badge: titulo de la
  // oferta si lo trae, "OFERTA" por defecto.
  const badgeText = oferta
    ? (oferta.titulo && oferta.titulo.trim().length > 0 ? oferta.titulo : "Oferta")
    : badge === "top_ventas"
      ? "Top Ventas"
      : badge
        ? "Oferta"
        : null;
  const badgeColor = oferta || badge === "top_ventas" ? "#D33587" : "#1FAF55";

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={[animatedStyle, { flex: 1, opacity: agotado ? 0.6 : 1 }]}
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
          style={{ borderRadius: 12, backgroundColor: "#FFFFFF" }}
        >
          {agotado ? (
            <View
              className="absolute top-2 left-2 z-10 px-2 py-1 rounded"
              style={{ backgroundColor: "#6B7280" }}
            >
              <Text className="text-white font-bold" style={{ fontSize: 8, letterSpacing: 0.5, textTransform: "uppercase" }}>
                Agotado
              </Text>
            </View>
          ) : badgeText ? (
            <View
              className="absolute top-2 left-2 z-10 px-2 py-1 rounded"
              style={{ backgroundColor: badgeColor }}
            >
              <Text className="text-white font-bold" style={{ fontSize: 8, letterSpacing: 0.5, textTransform: "uppercase" }}>
                {badgeText}
              </Text>
            </View>
          ) : null}
          <ShimmerImage
            imageUrl={product.imagen_url}
            fallbackCategory={product.categoria}
            style={{ width: "100%", aspectRatio: 1 }}
            contentFit="cover"
            priority={priority}
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
            <View style={{ gap: 1 }}>
              {tienePrecioOferta ? (
                <>
                  <Text style={{ fontSize: 11, color: "#9E9E9E", textDecorationLine: "line-through" }}>
                    {formatCOP(precioTachado)}
                  </Text>
                  <Text
                    className="font-bold text-lg"
                    style={{ color: agotado ? "#9CA3AF" : "#D33587" }}
                  >
                    {formatCOP(precioEfectivo)}
                  </Text>
                </>
              ) : (
                <Text
                  className="font-bold text-lg"
                  style={{ color: agotado ? "#9CA3AF" : "#D33587" }}
                >
                  {formatCOP(product.precio_app)}
                </Text>
              )}
            </View>

            <Pressable
              onPress={(e) => {
                e.stopPropagation?.();
                handleAdd();
              }}
              disabled={agotado}
              className="items-center justify-center"
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: agotado ? "#D1D5DB" : "#1FAF55",
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
