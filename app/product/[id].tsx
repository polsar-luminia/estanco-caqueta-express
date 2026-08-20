import { useState, useEffect } from "react";
import { View, Text, Pressable, Dimensions, ScrollView as RNScrollView } from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
import { esCategoriaProhibidaIOS, filtrarProductosIOS } from "../../src/lib/iosFilters";
import { ProductCard } from "../../src/components/ProductCard";
import { tracker } from "../../src/lib/tracker";
import { metaLogViewContent } from "../../src/lib/metaEvents";
import { useCartStore } from "../../src/stores/cart";
import { formatCOP } from "../../src/lib/format";
import { ShimmerImage } from "../../src/components/ShimmerImage";
import { SkeletonBox } from "../../src/components/skeletons/SkeletonBox";
import { CartFloatingBar } from "../../src/components/CartFloatingBar";
import { colors, shadows, fuentes } from "../../src/constants/theme";

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
  const { id, ofertaPrecio, precioAnterior } = useLocalSearchParams<{ id: string; ofertaPrecio?: string; precioAnterior?: string }>();
  const productoId = id && id.trim() ? Number(id) : NaN;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const addItemWithQuantity = useCartStore((s) => s.addItemWithQuantity);
  const scrollY = useSharedValue(0);
  const [quantity, setQuantity] = useState(1);

  const { data: product, isLoading, isError, refetch } = useQuery({
    queryKey: ["producto", productoId],
    queryFn: () => getProducto(productoId),
    enabled: Number.isFinite(productoId) && productoId > 0,
  });

  const { data: sugerenciasRaw = [] } = useQuery({
    queryKey: ["sugerencias", productoId],
    queryFn: () => getSugerencias(productoId),
    enabled: Number.isFinite(productoId) && productoId > 0,
  });

  // Apple §1.4.3 — sugerencias también pueden venir contaminadas en iOS.
  const sugerencias = filtrarProductosIOS(sugerenciasRaw);
  // Producto entero bloqueado en iOS si su categoría es tabaco/vape.
  const productoBloqueadoIOS = product
    ? esCategoriaProhibidaIOS(product.categoria) || esCategoriaProhibidaIOS(product.nombre)
    : false;

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
    // A.2 — demanda insatisfecha: alguien quiso ver algo que no se puede vender.
    // Es la lista de qué reponer, ordenada por interés real y no por intuición.
    if (product.stock_total <= 0) {
      tracker.track('producto_agotado_visto', { producto_id: product.id, nombre: product.nombre }, 'product/[id]');
    }
    // Meta ViewContent — una sola vez por producto (deps [product?.id]). Se omite
    // en productos bloqueados por tabaco en iOS (cumplimiento §1.4.3): no enviamos
    // eventos de producto para categorías que la app no puede mostrar en esa
    // tienda. Usamos precio_app (no la oferta por params) por estabilidad — es la
    // señal de interés que Meta necesita en la parte alta del embudo.
    if (!productoBloqueadoIOS) {
      metaLogViewContent(product.id, product.precio_app);
    }
    return () => {
      const segundos = Math.round((Date.now() - entrada) / 1000);
      if (segundos > 2) tracker.track('tiempo_en_producto', { producto_id: product.id, segundos }, 'product/[id]');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- product completo causaría refetch spam; solo re-track cuando cambia el id
  }, [product?.id]);

  if (!Number.isFinite(productoId) || productoId <= 0) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
        <Text style={{ fontSize: 48, marginBottom: 12 }}>😕</Text>
        <Text style={{ fontSize: 18, fontFamily: fuentes.destacado, color: "#1F1F1F", textAlign: "center" }}>
          Producto no encontrado
        </Text>
      </View>
    );
  }

  if (isLoading) {
    return <ProductDetailSkeleton />;
  }

  if (productoBloqueadoIOS) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
        <Text style={{ fontSize: 48, marginBottom: 12 }}>😕</Text>
        <Text style={{ fontSize: 18, fontFamily: fuentes.destacado, color: "#1F1F1F", textAlign: "center" }}>
          Producto no disponible
        </Text>
      </View>
    );
  }

  if (isError || !product) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
        <Text style={{ fontSize: 48, marginBottom: 12 }}>😕</Text>
        <Text style={{ fontSize: 18, fontFamily: fuentes.destacado, color: "#1F1F1F", marginBottom: 8 }}>
          No pudimos cargar este producto
        </Text>
        <Text style={{ fontSize: 14, color: "#6B6B6B", textAlign: "center", marginBottom: 24 }}>
          Verifica tu conexión e intenta de nuevo
        </Text>
        <Pressable
          onPress={() => refetch()}
          accessibilityRole="button"
          accessibilityLabel="Reintentar cargar el producto"
          hitSlop={4}
          style={{ backgroundColor: "#1FAF55", paddingHorizontal: 32, paddingVertical: 12, borderRadius: 999 }}
        >
          <Text style={{ color: "white", fontFamily: fuentes.destacado }}>Reintentar</Text>
        </Pressable>
      </View>
    );
  }

  const inStock = product.stock_total > 0;
  const stockMax = product.stock_total;
  // Máximo por cliente: aplica siempre que el producto lo tenga configurado, haya o
  // no oferta activa. Se acumula sobre una ventana móvil de `ventanaDias`.
  const maxCliente = product.max_unidades_por_cliente ?? undefined;
  const ventanaDias = product.limite_ventana_dias ?? undefined;
  // Con sesión el backend dice cuánto le queda al cliente en la ventana; sin sesión
  // solo conocemos el tope y asumimos el cupo completo.
  const cupoRestante = product.limite_disponible ?? maxCliente;
  const yaComprado = product.limite_ya_comprado ?? 0;
  // El selector topa en lo que el cliente REALMENTE puede llevar hoy, no en el máximo
  // teórico: si ya lleva 1 de 2, el tope es 1 (antes dejaba pedir 2 y rebotaba al pagar).
  const topeEfectivo = Math.min(stockMax, cupoRestante ?? Infinity);
  const sinCupo = maxCliente != null && cupoRestante === 0;
  // Sin cupo el botón se bloquea igual que con stock agotado: agregar 1 unidad solo
  // para que el checkout la rechace es la experiencia que estamos quitando.
  const puedeAgregar = inStock && !sinCupo;

  // "puedes volver a pedir el 29 de julio" — solo llega cuando ya agotó el cupo.
  const liberaTexto = product.limite_disponible_desde
    ? new Date(product.limite_disponible_desde).toLocaleDateString("es-CO", {
        day: "numeric",
        month: "long",
      })
    : null;

  const ofertaParseada = ofertaPrecio ? Number(ofertaPrecio) : NaN;
  const ofertaValida = Number.isFinite(ofertaParseada) && ofertaParseada > 0 && ofertaParseada < product.precio_app;
  const precioActivo = ofertaValida ? ofertaParseada : product.precio_app;
  const precioAnteriorParsed = precioAnterior ? Number(precioAnterior) : NaN;
  const precioAnteriorValido = Number.isFinite(precioAnteriorParsed) && precioAnteriorParsed > 0;

  const handleAdd = () => {
    addItemWithQuantity({
      productoId: product.id,
      nombre: product.nombre,
      precioUnitario: precioActivo,
      imagenUrl: product.imagen_url || undefined,
      stockMaximo: product.stock_total,
      // El cupo REAL (lo que le queda hoy), no el tope teórico: si ya llevó 1 de 2, el
      // carrito debe topar en 1. Con el tope teórico el selector de la ficha topaba bien
      // pero el "+" del carrito volvía a dejar subir a 2 y rebotaba al pagar.
      maxPorCliente: cupoRestante,
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
  const increment = () => {
    setQuantity((q) => {
      if (q >= topeEfectivo) {
        // Distinguir si el tope lo impone el máximo por cliente o el stock.
        if (maxCliente != null && topeEfectivo === cupoRestante) {
          Toast.show({
            type: "info",
            text1: yaComprado > 0
              ? `Ya llevaste ${yaComprado} de ${maxCliente} en los últimos ${ventanaDias} días`
              : `Máximo ${maxCliente} por cliente cada ${ventanaDias} días`,
          });
        } else {
          Toast.show({ type: "info", text1: `Solo quedan ${Math.floor(stockMax)} unidades` });
        }
        return q;
      }
      return q + 1;
    });
  };

  return (
    <View className="flex-1 bg-white">
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header (Vibrante): botón back redondeado */}
      <View style={{ flexDirection: "row", alignItems: "center", paddingTop: insets.top + 10, paddingBottom: 10, paddingHorizontal: 14, backgroundColor: "#fff" }}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Volver a la pantalla anterior"
          hitSlop={3}
          style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", ...shadows.soft }}
        >
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <Path d="M15 18l-6-6 6-6" stroke={colors.ink} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
      </View>

      {/* ── Scrollable content ───────────────────────────── */}
      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 120 }}
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
                  backgroundColor: "#FFFFFF",
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
            <Text className="text-sm font-extrabold uppercase tracking-widest" style={{ color: colors.offer }}>
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
            {ofertaValida && precioAnteriorValido ? (
              <Text style={{ fontSize: 14, color: "#9E9E9E", textDecorationLine: "line-through" }}>
                {formatCOP(precioAnteriorParsed)}
              </Text>
            ) : null}
            <Text className="text-2xl font-extrabold" style={{ color: colors.ink }}>
              {formatCOP(precioActivo)}
            </Text>
          </View>

          {/* Aviso de máximo por cliente. Aplica haya o no oferta activa. Con sesión
              iniciada dice además cuánto le queda y, si ya lo agotó, desde cuándo
              puede volver a pedir — para que no se entere apenas al pagar. */}
          {maxCliente != null ? (
            <View className="flex-row items-center self-start rounded-full px-3 py-1" style={{ backgroundColor: "#FDECEF" }}>
              <Text className="text-xs font-semibold" style={{ color: colors.offer }}>
                {sinCupo && liberaTexto
                  ? `Ya llevaste ${maxCliente} ${maxCliente === 1 ? "unidad" : "unidades"} — puedes volver a pedir el ${liberaTexto}`
                  : `Máximo ${maxCliente} ${maxCliente === 1 ? "unidad" : "unidades"} por cliente cada ${ventanaDias} días`}
              </Text>
            </View>
          ) : null}

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
                accessibilityRole="button"
                accessibilityLabel="Disminuir cantidad"
                hitSlop={2}
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
                  // topeEfectivo (no stockMax): con límite 2 y stock 42 el botón debe
                  // verse apagado en 2, coherente con lo que el toast ya explicaba.
                  opacity: quantity >= topeEfectivo ? 0.4 : 1,
                }}
                accessibilityRole="button"
                accessibilityLabel="Aumentar cantidad"
                hitSlop={2}
              >
                <PlusIcon />
              </Pressable>
            </View>
          </View>

          {/* El botón "Agregar al carrito" ahora es una barra fija abajo (ver más abajo). */}
          {/* ── También te puede gustar ───────────── */}
          {sugerencias.length > 0 && (
            <View style={{ paddingBottom: 48 }}>
              <Text style={{ fontSize: 16, fontFamily: fuentes.destacado, color: "#1A1C1A", marginBottom: 12 }}>
                También te puede gustar
              </Text>
              <RNScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                {sugerencias.map((item) => (
                  <View key={item.id} style={{ width: 160 }}>
                    <ProductCard
                      product={item}
                      onPress={() => {
                        tracker.track('sugerencia_clickeada', { desde_producto: product.id, producto_clickeado: item.id, nombre: item.nombre }, 'product/[id]');
                        router.replace(`/product/${item.id}`);
                      }}
                    />
                  </View>
                ))}
              </RNScrollView>
            </View>
          )}
        </View>
      </Animated.ScrollView>

      {/* Barra flotante del carrito: emerge al agregar items. Se posiciona por
          encima del CTA fijo "Agregar" (bottomOffset) para no solaparse. */}
      <CartFloatingBar bottomOffset={96 + insets.bottom} />

      {/* CTA fijo "Agregar al carrito · $total" (Vibrante) */}
      <View
        style={{
          position: "absolute", left: 0, right: 0, bottom: 0,
          backgroundColor: "#fff",
          borderTopWidth: 1, borderTopColor: colors.line,
          paddingHorizontal: 16, paddingTop: 12, paddingBottom: insets.bottom + 12,
        }}
      >
        <Pressable
          onPress={handleAdd}
          disabled={!puedeAgregar}
          accessibilityRole="button"
          // El boton bloqueado no dice por que si solo se lee "Agregar al carrito":
          // la etiqueta distingue agotado de limite por cliente.
          accessibilityLabel={
            !inStock
              ? "Producto agotado, no se puede agregar"
              : sinCupo
                ? "Límite por cliente alcanzado, no se puede agregar"
                : `Agregar ${quantity} al carrito, ${formatCOP(precioActivo * quantity)}`
          }
          accessibilityState={{ disabled: !puedeAgregar }}
          style={{
            backgroundColor: puedeAgregar ? colors.green : "#D1D5DB",
            borderRadius: 14,
            paddingVertical: 15, paddingHorizontal: 18,
            flexDirection: "row", alignItems: "center", justifyContent: "space-between",
            ...(puedeAgregar ? shadows.greenBtn : {}),
          }}
        >
          <Text style={{ color: "#fff", fontFamily: fuentes.destacado, fontSize: 15 }}>
            {!inStock ? "Agotado" : sinCupo ? "Límite alcanzado" : "Agregar al carrito"}
            {puedeAgregar && quantity > 1 ? ` · ${quantity}` : ""}
          </Text>
          {puedeAgregar && (
            <Text style={{ color: "#fff", fontFamily: fuentes.destacado, fontSize: 15 }}>
              {formatCOP(precioActivo * quantity)}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}
