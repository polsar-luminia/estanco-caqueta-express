import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  RefreshControl,
  Linking,
  Animated,
  Alert,
} from "react-native";
import * as Sentry from "@sentry/react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter, Redirect } from "expo-router";
import { useAuthStore } from "../../../src/stores/auth";
import Toast from "react-native-toast-message";
import { getPedidos, getPedido, getProducto } from "../../../src/lib/api";
import { tracker } from "../../../src/lib/tracker";
import { useSoporte } from "../../../src/lib/soporte";
import type { Pedido } from "../../../src/lib/api";
import { useCartStore } from "../../../src/stores/cart";
import { queryClient } from "../../../src/lib/query-client";
import { formatCOP, formatDate, formatTime } from "../../../src/lib/format";
import { OrderCardSkeleton } from "../../../src/components/skeletons/OrderCardSkeleton";
import { ErrorState } from "../../../src/components/ErrorState";

/* ── Estado visual config ────────────────────────────────── */

const ESTADO_LABEL: Record<string, string> = {
  recibido: "Recibido",
  en_preparacion: "En preparacion",
  preparado: "Preparado",
  en_camino: "Despachado",
  domiciliario_llego: "Tu domiciliario llegó",
  entregado: "Entregado",
  cancelado: "Cancelado",
  // El texto NO dice por qué falló. El motivo real puede ser "el cliente no
  // estaba" o "no tenía con qué pagar", y devolvérselo aquí convierte la lista
  // de pedidos en un reproche. Lo que el cliente necesita saber es dónde está su
  // pedido y que alguien lo va a contactar.
  no_entregado: "Volvió al estanco",
};

const ESTADO_BADGE: Record<string, string> = {
  recibido: "bg-blue-100",
  en_preparacion: "bg-yellow-100",
  preparado: "bg-teal-100",
  en_camino: "bg-orange-100",
  domiciliario_llego: "bg-pink-100",
  entregado: "bg-brand-500/10",
  cancelado: "bg-red-100",
  // Ámbar y no rojo: el pedido no se perdió, se reprograma. El rojo lo haría
  // leer como cancelado y el cliente dejaría de esperarlo.
  no_entregado: "bg-amber-100",
};

const ESTADO_TEXT: Record<string, string> = {
  recibido: "text-blue-700",
  en_preparacion: "text-yellow-800",
  preparado: "text-teal-700",
  en_camino: "text-orange-700",
  domiciliario_llego: "text-pink-700",
  entregado: "text-brand-500",
  cancelado: "text-red-700",
  no_entregado: "text-amber-800",
};

// Estados en los que el pedido esta vivo / el domiciliario esta en la calle.
// Listas y no comparaciones sueltas: cuando el backend agregue otro estado,
// hay UN sitio que actualizar y un fallback que ya no deja el badge vacio.
//
// `no_entregado` cuenta como ACTIVO: el pedido sigue vivo esperando que lo
// reprogramen. Dejarlo fuera lo sacaría de la sección de pedidos en curso y el
// cliente creería que ya no existe.
const ESTADOS_ACTIVOS = ["recibido", "en_preparacion", "preparado", "en_camino", "domiciliario_llego", "no_entregado"];
const ESTADOS_EN_CALLE = ["en_camino", "domiciliario_llego"];

import { CARD_SHADOW } from "../../../src/constants/styles";

/* ── Punto pulsante para "En camino" ─────────────────────── */

function PulsingDot() {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={{ opacity }}
      className="w-2 h-2 rounded-full bg-orange-500 mr-1.5"
    />
  );
}

/* ── Badge de estado ─────────────────────────────────────── */

function StatusBadge({ estado }: { estado: string }) {
  // Un estado que este binario no conoce se muestra CRUDO en gris, nunca un
  // badge vacio: es la regla de resiliencia para que un estado nuevo del
  // backend no deje un hueco donde iba el estado.
  return (
    <View
      className={`flex-row items-center px-3 py-1.5 rounded-full ${ESTADO_BADGE[estado] ?? "bg-gray-100"}`}
    >
      {ESTADOS_EN_CALLE.includes(estado) && <PulsingDot />}
      <Text className={`text-xs ${ESTADO_TEXT[estado] ?? "text-gray-600"} font-destacado`}>
        {ESTADO_LABEL[estado] ?? estado}
      </Text>
    </View>
  );
}

/* ── Tarjeta de pedido ───────────────────────────────────── */

function OrderCard({ item }: { item: Pedido }) {
  const router = useRouter();
  const addItemWithQuantity = useCartStore((s) => s.addItemWithQuantity);
  const isActive = ESTADOS_ACTIVOS.includes(item.estado) && item.estado !== "recibido";
  const isDelivered = item.estado === "entregado";
  const isEnCamino = ESTADOS_EN_CALLE.includes(item.estado);
  const reordenandoRef = useRef(false);
  const [reordenando, setReordenando] = useState(false);

  const handleReordenar = async () => {
    if (reordenandoRef.current) return;
    const itemsActuales = useCartStore.getState().items.length;
    if (itemsActuales > 0) {
      const confirmar = await new Promise<boolean>((resolve) => {
        Alert.alert(
          "Tu carrito ya tiene productos",
          `Reordenar agregará los productos del pedido #${item.numero_orden_cliente ?? item.id} a tu carrito actual (${itemsActuales} producto${itemsActuales === 1 ? "" : "s"}). ¿Continuar?`,
          [
            { text: "Cancelar", style: "cancel", onPress: () => resolve(false) },
            { text: "Sí, agregar", onPress: () => resolve(true) },
          ],
          { cancelable: true, onDismiss: () => resolve(false) }
        );
      });
      if (!confirmar) return;
    }
    reordenandoRef.current = true;
    setReordenando(true);
    try {
      const pedido = await getPedido(item.id);
      if (!pedido.lineas?.length) {
        Toast.show({ type: "error", text1: "No se pudo reordenar" });
        return;
      }

      // Refrescar precio actual de cada producto antes de agregar al carrito.
      // Popula la cache de React Query que cart.tsx ya usa, evitando flash visual.
      // Promise.allSettled filtra productos eliminados del catálogo sin abortar toda la operación.
      const lineasConProductoId = pedido.lineas.filter((l) => l.producto_id);
      const resultados = await Promise.allSettled(
        lineasConProductoId.map((l) =>
          queryClient.fetchQuery({
            queryKey: ["producto", l.producto_id] as const,
            queryFn: () => getProducto(l.producto_id),
            staleTime: 0,
          }).then((producto) => ({ linea: l, producto }))
        )
      );

      const disponibles = resultados.flatMap((r) =>
        r.status === "fulfilled" ? [r.value] : []
      );
      const omitidosCatalogo = pedido.lineas.length - disponibles.length;
      // M-CART-16: filtrar productos con stock_total<=0 para no meterlos al carrito.
      // Sin este guard, items con stock=0 entran y bloquean checkout con "Stock insuficiente".
      const conStock = disponibles.filter((d) => (d.producto.stock_total ?? 0) > 0);
      const omitidosStock = disponibles.length - conStock.length;
      const omitidosTotal = omitidosCatalogo + omitidosStock;

      if (conStock.length === 0) {
        Toast.show({
          type: "error",
          text1: "Productos no disponibles",
          text2: omitidosStock > 0 && omitidosCatalogo === 0
            ? "Los productos del pedido están sin stock"
            : "Ninguno de los productos del pedido sigue disponible",
        });
        return;
      }

      for (const { linea, producto } of conStock) {
        addItemWithQuantity({
          productoId: producto.id,
          nombre: producto.nombre,
          precioUnitario: producto.precio_app,
          imagenUrl: producto.imagen_url,
          stockMaximo: producto.stock_total,
          // getProducto corre con sesión, así que trae limite_disponible: reordenar un
          // pedido viejo debe topar en el cupo que le queda hoy, no en el tope teórico.
          maxPorCliente: producto.limite_disponible ?? producto.max_unidades_por_cliente ?? undefined,
        }, linea.cantidad);
      }

      tracker.track('pedido_reordenado', { pedido_id: item.id, omitidos: omitidosTotal, omitidos_catalogo: omitidosCatalogo, omitidos_stock: omitidosStock }, 'orders');

      let text2: string;
      if (omitidosCatalogo > 0 && omitidosStock > 0) {
        text2 = `${omitidosCatalogo} ya no en catalogo y ${omitidosStock} sin stock`;
      } else if (omitidosCatalogo > 0) {
        text2 = `${omitidosCatalogo} producto${omitidosCatalogo > 1 ? 's' : ''} ya no en catalogo`;
      } else if (omitidosStock > 0) {
        text2 = `${omitidosStock} producto${omitidosStock > 1 ? 's' : ''} sin stock`;
      } else {
        text2 = `${conStock.length} productos de pedido #${item.numero_orden_cliente ?? item.id}`;
      }
      Toast.show({
        type: omitidosTotal > 0 ? "info" : "success",
        text1: omitidosTotal > 0 ? "Algunos productos cambiaron" : "Productos agregados al carrito",
        text2,
      });
      router.push("/(tabs)/cart");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al reordenar";
      Sentry.captureException(err instanceof Error ? err : new Error(msg), {
        tags: { flow: "checkout", action: "reordenar" },
        extra: { pedido_id: item.id },
      });
      Toast.show({ type: "error", text1: "Error al reordenar", text2: msg });
    } finally {
      reordenandoRef.current = false;
      setReordenando(false);
    }
  };

  const numeroVisible = item.numero_orden_cliente ?? item.id;
  const estadoTexto = ESTADO_LABEL[item.estado] ?? item.estado;

  return (
    <Pressable
      onPress={() => router.push(`/(tabs)/orders/${item.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`Ver pedido número ${numeroVisible}, ${estadoTexto}, total ${formatCOP(item.total)}`}
      className="bg-white rounded-2xl p-6"
      style={CARD_SHADOW}
    >
      {/* Etiqueta "Pedido Activo" */}
      {isActive && (
        <Text className="text-xs uppercase tracking-widest text-brand-600 mb-3 font-destacado">
          Pedido Activo
        </Text>
      )}

      {/* Fila superior: info + badge */}
      <View className="flex-row justify-between items-start">
        <View className="flex-1 mr-3">
          <Text className="text-xl text-on-surface font-titulo">
            Pedido #{item.numero_orden_cliente ?? item.id}
          </Text>
          <Text className="text-sm text-gray-500 mt-1 font-destacado">
            {formatDate(item.created_at)} - {formatTime(item.created_at)}
          </Text>
        </View>
        <StatusBadge estado={item.estado} />
      </View>

      {/* Separador */}
      <View className="border-t border-gray-100 mt-4 pt-4">
        {/* Total */}
        <View className="flex-row justify-between items-center">
          <Text className="text-xs text-gray-500 uppercase tracking-wide font-destacado">
            Total Pagado
          </Text>
          <Text
            className={`text-xl ${ isActive ? "text-brand-500" : "text-on-surface" } font-titulo`}
          >
            {formatCOP(item.total)}
          </Text>
        </View>

        {/* Botones de accion */}
        <View className="flex-row mt-4" style={{ gap: 10 }}>
          <Pressable
            onPress={() => router.push(`/(tabs)/orders/${item.id}`)}
            accessibilityRole="button"
            accessibilityLabel={
              isEnCamino
                ? `Rastrear el pedido número ${numeroVisible}`
                : `Ver detalles del pedido número ${numeroVisible}`
            }
            className={`flex-1 py-3 rounded-xl items-center ${
              isEnCamino ? "bg-brand-600" : "bg-surface-low"
            }`}
          >
            <Text
              className={`text-sm ${ isEnCamino ? "text-white" : "text-on-surface" } font-destacado`}
            >
              {isEnCamino ? "Rastrear" : "Ver detalles"}
            </Text>
          </Pressable>

          {isDelivered && (
            <Pressable
              onPress={handleReordenar}
              disabled={reordenando}
              accessibilityRole="button"
              accessibilityLabel={`Volver a pedir los productos del pedido número ${numeroVisible}`}
              accessibilityState={{ disabled: reordenando }}
              className="flex-1 py-3 rounded-xl items-center bg-magenta-50"
            >
              <Text className="text-sm text-magenta-600 font-destacado">
                Reordenar
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </Pressable>
  );
}

/* ── Seccion de ayuda (WhatsApp) ─────────────────────────── */

function HelpSection() {
  const { abrirWhatsApp: handleWhatsApp } = useSoporte();

  return (
    <Pressable
      onPress={handleWhatsApp}
      accessibilityRole="button"
      accessibilityLabel="Escribirle a soporte por WhatsApp por un problema con un pedido"
      className="bg-brand-900/5 p-6 rounded-2xl flex-row items-center"
    >
      <View className="w-12 h-12 rounded-full bg-brand-600 items-center justify-center mr-4">
        <Text className="text-white text-lg font-destacado">?</Text>
      </View>
      <View className="flex-1">
        <Text className="text-base text-on-surface font-destacado">
          Problemas con un pedido?
        </Text>
        <Text className="text-sm text-gray-500 mt-0.5 font-destacado">
          Estamos aqui para ayudarte 24/7
        </Text>
      </View>
    </Pressable>
  );
}

/* ── Pantalla principal ──────────────────────────────────── */

export default function OrdersScreen() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const {
    data: pedidos = [],
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["pedidos"],
    queryFn: getPedidos,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    enabled: isAuthenticated,
  });

  // A REGISTRO y no a login (ver profile.tsx). Discutible aqui —quien toca
  // "Pedidos" suele creer que tiene historial— pero se unifica el criterio:
  // el pie del registro ofrece iniciar sesion para ese caso.
  if (!isAuthenticated) return <Redirect href="/(auth)/register" />;

  if (isLoading) {
    return (
      <View className="flex-1 bg-surface-low px-4 pt-6" style={{ gap: 16 }}>
        <View className="mb-2">
          <View className="bg-gray-200 rounded-lg" style={{ width: "55%", height: 28 }} />
          <View className="bg-gray-100 rounded mt-2" style={{ width: "75%", height: 14 }} />
        </View>
        <OrderCardSkeleton />
        <OrderCardSkeleton />
        <OrderCardSkeleton />
      </View>
    );
  }

  if (isError) {
    return (
      <View className="flex-1 bg-surface-low items-center justify-center">
        <ErrorState mensaje="No pudimos cargar tus pedidos" onRetry={refetch} />
      </View>
    );
  }

  if (pedidos.length === 0) {
    return (
      <View className="flex-1 bg-surface-low items-center justify-center px-6">
        <Text className="text-xl text-gray-400 mb-2 font-titulo">Sin pedidos</Text>
        <Text className="text-gray-400 text-center">
          Tus pedidos apareceran aqui cuando hagas tu primera compra
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      className="flex-1 bg-surface-low"
      data={pedidos}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 102 }}
      refreshControl={
        <RefreshControl
          refreshing={!isLoading && isFetching}
          onRefresh={refetch}
          colors={["#1FAF55"]}
          tintColor="#1FAF55"
        />
      }
      ListHeaderComponent={
        <View className="mb-2">
          <Text className="text-3xl text-on-surface font-titulo">
            Mis Pedidos
          </Text>
          <Text className="text-gray-500 mt-1">
            Historial reciente y seguimiento en vivo
          </Text>
        </View>
      }
      renderItem={({ item }) => <OrderCard item={item} />}
      ListFooterComponent={
        <View className="mt-2 mb-24">
          <HelpSection />
        </View>
      }
    />
  );
}
