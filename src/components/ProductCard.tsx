import { View, Text, Pressable } from "react-native";
import Animated from "react-native-reanimated";
import Toast from "react-native-toast-message";
import { formatCOP } from "../lib/format";
import { useCartStore } from "../stores/cart";
import { useScalePress } from "../hooks/useScalePress";
import { useLimitesCliente } from "../hooks/useLimitesCliente";
import { ShimmerImage } from "./ShimmerImage";
import { colors, radii, shadows, fuentes } from "../constants/theme";
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
  // Badge editable desde DB/admin (productos.badge_app / badge_app_color).
  // badgeTexto = texto libre; badgeColor = "verde" | "coral". Tienen prioridad
  // sobre `badge` (clave legacy), pero la `oferta` real gana sobre todo.
  badgeTexto?: string | null;
  badgeColor?: string | null;
  // Si la card representa un producto en oferta, le pasamos la info para
  // pintar el badge custom y el precio tachado. Tiene prioridad sobre `badge`.
  oferta?: OfertaInfo;
  priority?: "low" | "normal" | "high";
  // De que carril viene y en que lugar. Solo telemetria: responde cual seccion
  // de la portada VENDE, que no es lo mismo que cual se mira. Sin esto,
  // reordenar la portada es adivinar.
  origen?: string;
  posicion?: number;
}

export function ProductCard({ product, onPress, badge, badgeTexto, badgeColor, oferta, priority = "normal", origen, posicion }: Props) {
  const addItem = useCartStore((s) => s.addItem);
  const { animatedStyle, onPressIn, onPressOut } = useScalePress();
  const { cupoDe, ventanaDias } = useLimitesCliente();

  const agotado = (product.stock_total ?? 0) <= 0;
  // Cupo real del cliente en la ventana. Sin sesión llega undefined y caemos al tope
  // del producto: seguimos topando, solo que sin descontar lo que ya llevó.
  const cupo = cupoDe(product.id);
  const maxPorCliente = cupo ?? product.max_unidades_por_cliente ?? undefined;
  const sinCupo = cupo === 0;

  // Precio efectivo: precio_oferta tiene prioridad sobre precio_app si está
  // definido. Para el carrito siempre usamos el efectivo (no doble cargo).
  const precioEfectivo = oferta?.precio_oferta ?? product.precio_app;
  const tienePrecioOferta = oferta?.precio_oferta != null && oferta?.precio_anterior != null;
  const precioTachado = oferta?.precio_anterior ?? product.precio_app;

  const handleAdd = () => {
    if (agotado) return;
    // Cupo agotado: no agregar. Meter 1 unidad para que el checkout la rechace es
    // exactamente la experiencia que estamos quitando.
    if (sinCupo) {
      Toast.show({
        type: "info",
        text1: "Ya llevaste el máximo",
        text2: `Solo puedes llevar ${product.max_unidades_por_cliente} cada ${ventanaDias} días`,
        visibilityTime: 2500,
      });
      return;
    }
    addItem({
      productoId: product.id,
      nombre: product.nombre,
      precioUnitario: precioEfectivo,
      imagenUrl: product.imagen_url || undefined,
      stockMaximo: product.stock_total,
      maxPorCliente,
    }, origen ? { carril: origen, posicion: posicion ?? 0 } : undefined);
    Toast.show({
      type: "success",
      text1: "Agregado al carrito",
      text2: product.nombre,
      visibilityTime: 1500,
    });
  };

  // Badge — prioridad: oferta real > badge de DB (texto libre) > badge legacy.
  const badgeDbText = badgeTexto && badgeTexto.trim().length > 0 ? badgeTexto.trim() : null;
  const badgeText = oferta
    ? (oferta.titulo && oferta.titulo.trim().length > 0 ? oferta.titulo : "Oferta")
    : badgeDbText
      ? badgeDbText
      : badge === "top_ventas"
        ? "Top Ventas"
        : badge
          ? "Oferta"
          : null;
  // Color: oferta = coral; badge de DB respeta su color (verde/coral); legacy
  // conserva el comportamiento anterior (top_ventas coral, resto verde).
  const badgeBg = oferta
    ? colors.offer
    : badgeDbText
      ? (badgeColor === "verde" ? colors.green : colors.offer)
      : badge === "top_ventas"
        ? colors.offer
        : colors.green;

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      // El lector de pantalla no ve el badge ni el precio tachado: la etiqueta
      // los resume para que la tarjeta se entienda sin mirarla.
      accessibilityLabel={`${product.nombre}, ${formatCOP(precioEfectivo)}${agotado ? ", agotado" : ""}. Ver detalle`}
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
              <Text style={{ color: colors.white, fontFamily: fuentes.destacado, fontSize: 12.5, letterSpacing: 0.4, textTransform: "uppercase" }}>
                Agotado
              </Text>
            </View>
          ) : badgeText ? (
            <View style={{ position: "absolute", top: 8, left: 8, zIndex: 10, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, backgroundColor: badgeBg }}>
              <Text style={{ color: colors.white, fontFamily: fuentes.destacado, fontSize: 12.5, letterSpacing: 0.4, textTransform: "uppercase" }}>
                {badgeText}
              </Text>
            </View>
          ) : null}
          <ShimmerImage
            // Miniatura primero: la tarjeta mide 156 dp y la imagen original
            // pesa entre 3 y 4 veces mas para el mismo pixel en pantalla. El
            // respaldo a imagen_url cubre los productos que no tienen thumb.
            imageUrl={product.imagen_url_thumb || product.imagen_url}
            fallbackCategory={product.categoria}
            style={{ width: "100%", aspectRatio: 1 }}
            contentFit="contain"
            priority={priority}
          />
        </View>

        {/* Info */}
        <View style={{ marginTop: 10 }}>
          <Text
            style={{ fontSize: 12.5, fontFamily: fuentes.destacado, color: colors.ink, lineHeight: 15, minHeight: 30 }}
            numberOfLines={2}
          >
            {product.nombre}
          </Text>

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
            <View>
              {tienePrecioOferta ? (
                <>
                  <Text style={{ fontSize: 12, color: colors.strike, textDecorationLine: "line-through", fontFamily: fuentes.destacado }}>
                    {formatCOP(precioTachado)}
                  </Text>
                  <Text style={{ fontSize: 16, fontFamily: fuentes.destacado, color: agotado ? colors.faint : colors.ink }}>
                    {formatCOP(precioEfectivo)}
                  </Text>
                </>
              ) : (
                <Text style={{ fontSize: 16, fontFamily: fuentes.destacado, color: agotado ? colors.faint : colors.ink }}>
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
              accessibilityState={{ disabled: agotado }}
              // El botón mide 34 pt; el hitSlop lo lleva a 44 sin tocar el diseño.
              hitSlop={5}
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
              <Text style={{ color: colors.white, fontSize: 19, fontFamily: fuentes.destacado, marginTop: -2 }}>
                +
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </AnimatedPressable>
  );
}
