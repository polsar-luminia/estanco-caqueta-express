import { View, Text, Pressable } from "react-native";
import Animated from "react-native-reanimated";
import Toast from "react-native-toast-message";
import { formatCOP } from "../lib/format";
import { useCartStore } from "../stores/cart";
import { useScalePress } from "../hooks/useScalePress";
import { ShimmerImage } from "./ShimmerImage";
import { colors, radii, shadows } from "../constants/theme";
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
  // Coral para ofertas/descuentos, verde para etiquetas de destaque.
  const badgeColor = oferta || badge === "top_ventas" ? colors.offer : colors.green;

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={[animatedStyle, { flex: 1, opacity: agotado ? 0.6 : 1 }]}
    >
      <View
        style={{
          backgroundColor: colors.surface,
          padding: 10,
          borderRadius: radii.card,
          ...shadows.card,
        }}
      >
        {/* Imagen con badge */}
        <View style={{ borderRadius: 12, backgroundColor: colors.white, overflow: "hidden", position: "relative" }}>
          {agotado ? (
            <View style={{ position: "absolute", top: 8, left: 8, zIndex: 10, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, backgroundColor: "#6B7280" }}>
              <Text style={{ color: colors.white, fontWeight: "800", fontSize: 8.5, letterSpacing: 0.4, textTransform: "uppercase" }}>
                Agotado
              </Text>
            </View>
          ) : badgeText ? (
            <View style={{ position: "absolute", top: 8, left: 8, zIndex: 10, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, backgroundColor: badgeColor }}>
              <Text style={{ color: colors.white, fontWeight: "800", fontSize: 8.5, letterSpacing: 0.4, textTransform: "uppercase" }}>
                {badgeText}
              </Text>
            </View>
          ) : null}
          <ShimmerImage
            imageUrl={product.imagen_url}
            fallbackCategory={product.categoria}
            style={{ width: "100%", aspectRatio: 1 }}
            contentFit="contain"
            priority={priority}
          />
        </View>

        {/* Info */}
        <View style={{ marginTop: 10 }}>
          <Text
            style={{ fontSize: 12, fontWeight: "700", color: colors.ink, lineHeight: 15, minHeight: 30 }}
            numberOfLines={2}
          >
            {product.nombre}
          </Text>

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
            <View>
              {tienePrecioOferta ? (
                <>
                  <Text style={{ fontSize: 10, color: colors.strike, textDecorationLine: "line-through", fontWeight: "600" }}>
                    {formatCOP(precioTachado)}
                  </Text>
                  <Text style={{ fontSize: 15, fontWeight: "800", color: agotado ? colors.faint : colors.ink }}>
                    {formatCOP(precioEfectivo)}
                  </Text>
                </>
              ) : (
                <Text style={{ fontSize: 15, fontWeight: "800", color: agotado ? colors.faint : colors.ink }}>
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
              accessibilityRole="button"
              accessibilityLabel={`Agregar ${product.nombre} al carrito`}
              style={{
                width: 34,
                height: 34,
                borderRadius: radii.pill,
                backgroundColor: agotado ? "#D1D5DB" : colors.green,
                alignItems: "center",
                justifyContent: "center",
                ...(agotado ? {} : shadows.greenBtn),
              }}
            >
              <Text style={{ color: colors.white, fontSize: 19, fontWeight: "700", marginTop: -2 }}>
                +
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </AnimatedPressable>
  );
}
