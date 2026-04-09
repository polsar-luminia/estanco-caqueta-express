import { useEffect, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  RefreshControl,
  Linking,
  Animated,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import { getPedidos, getPedido } from "../../../src/lib/api";
import { tracker } from "../../../src/lib/tracker";
import type { Pedido } from "../../../src/lib/api";
import { useCartStore } from "../../../src/stores/cart";
import { formatCOP, formatDate, formatTime } from "../../../src/lib/format";
import { OrderCardSkeleton } from "../../../src/components/skeletons/OrderCardSkeleton";

/* ── Estado visual config ────────────────────────────────── */

const ESTADO_LABEL: Record<string, string> = {
  recibido: "Recibido",
  en_preparacion: "En preparacion",
  en_camino: "En camino",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

const ESTADO_BADGE: Record<string, string> = {
  recibido: "bg-blue-100",
  en_preparacion: "bg-yellow-100",
  en_camino: "bg-orange-100",
  entregado: "bg-brand-500/10",
  cancelado: "bg-red-100",
};

const ESTADO_TEXT: Record<string, string> = {
  recibido: "text-blue-700",
  en_preparacion: "text-yellow-800",
  en_camino: "text-orange-700",
  entregado: "text-brand-500",
  cancelado: "text-red-700",
};

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
  return (
    <View
      className={`flex-row items-center px-3 py-1.5 rounded-full ${ESTADO_BADGE[estado]}`}
    >
      {estado === "en_camino" && <PulsingDot />}
      <Text className={`text-xs font-semibold ${ESTADO_TEXT[estado]}`}>
        {ESTADO_LABEL[estado]}
      </Text>
    </View>
  );
}

/* ── Tarjeta de pedido ───────────────────────────────────── */

function OrderCard({ item }: { item: Pedido }) {
  const router = useRouter();
  const addItemWithQuantity = useCartStore((s) => s.addItemWithQuantity);
  const isActive = item.estado === "en_camino" || item.estado === "en_preparacion";
  const isDelivered = item.estado === "entregado";
  const isEnCamino = item.estado === "en_camino";

  const handleReordenar = async () => {
    try {
      const pedido = await getPedido(item.id);
      if (!pedido.lineas?.length) {
        Toast.show({ type: "error", text1: "No se pudo reordenar" });
        return;
      }
      for (const linea of pedido.lineas) {
        addItemWithQuantity({
          productoId: (linea as any).producto_id || 0,
          nombre: linea.nombre_producto,
          precioUnitario: linea.precio_unitario,
        }, linea.cantidad);
      }
      tracker.track('pedido_reordenado', { pedido_id: item.id }, 'orders');
      Toast.show({ type: "success", text1: "Productos agregados al carrito", text2: `${pedido.lineas.length} productos de pedido #${item.id}` });
      router.push("/(tabs)/cart");
    } catch {
      Toast.show({ type: "error", text1: "Error al reordenar" });
    }
  };

  return (
    <Pressable
      onPress={() => router.push(`/(tabs)/orders/${item.id}`)}
      className="bg-white rounded-2xl p-6"
      style={CARD_SHADOW}
    >
      {/* Etiqueta "Pedido Activo" */}
      {isActive && (
        <Text className="text-xs font-bold uppercase tracking-widest text-brand-600 mb-3">
          Pedido Activo
        </Text>
      )}

      {/* Fila superior: info + badge */}
      <View className="flex-row justify-between items-start">
        <View className="flex-1 mr-3">
          <Text className="text-xl font-bold text-on-surface">
            Pedido #{item.id}
          </Text>
          <Text className="text-sm text-gray-500 mt-1">
            {formatDate(item.created_at)} - {formatTime(item.created_at)}
          </Text>
        </View>
        <StatusBadge estado={item.estado} />
      </View>

      {/* Separador */}
      <View className="border-t border-gray-100 mt-4 pt-4">
        {/* Total */}
        <View className="flex-row justify-between items-center">
          <Text className="text-xs text-gray-500 uppercase tracking-wide">
            Total Pagado
          </Text>
          <Text
            className={`text-xl font-extrabold ${
              isActive ? "text-brand-500" : "text-on-surface"
            }`}
          >
            {formatCOP(item.total)}
          </Text>
        </View>

        {/* Botones de accion */}
        <View className="flex-row mt-4" style={{ gap: 10 }}>
          <Pressable
            onPress={() => router.push(`/(tabs)/orders/${item.id}`)}
            className={`flex-1 py-3 rounded-xl items-center ${
              isEnCamino ? "bg-brand-600" : "bg-surface-low"
            }`}
          >
            <Text
              className={`text-sm font-semibold ${
                isEnCamino ? "text-white" : "text-on-surface"
              }`}
            >
              {isEnCamino ? "Rastrear" : "Ver detalles"}
            </Text>
          </Pressable>

          {isDelivered && (
            <Pressable
              onPress={handleReordenar}
              className="flex-1 py-3 rounded-xl items-center bg-magenta-50"
            >
              <Text className="text-sm font-semibold text-magenta-600">
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
  return (
    <Pressable
      onPress={() => Linking.openURL("https://wa.me/573155519216")}
      className="bg-brand-900/5 p-6 rounded-2xl flex-row items-center"
    >
      <View className="w-12 h-12 rounded-full bg-brand-600 items-center justify-center mr-4">
        <Text className="text-white text-lg">?</Text>
      </View>
      <View className="flex-1">
        <Text className="text-base font-bold text-on-surface">
          Problemas con un pedido?
        </Text>
        <Text className="text-sm text-gray-500 mt-0.5">
          Estamos aqui para ayudarte 24/7
        </Text>
      </View>
    </Pressable>
  );
}

/* ── Pantalla principal ──────────────────────────────────── */

export default function OrdersScreen() {
  const {
    data: pedidos = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["pedidos"],
    queryFn: getPedidos,
  });

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

  if (pedidos.length === 0) {
    return (
      <View className="flex-1 bg-surface-low items-center justify-center px-6">
        <Text className="text-xl text-gray-400 mb-2">Sin pedidos</Text>
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
      contentContainerStyle={{ padding: 16, gap: 16 }}
      refreshControl={
        <RefreshControl
          refreshing={false}
          onRefresh={refetch}
          colors={["#1FAF55"]}
          tintColor="#1FAF55"
        />
      }
      ListHeaderComponent={
        <View className="mb-2">
          <Text className="text-3xl font-extrabold text-on-surface">
            Mis Pedidos
          </Text>
          <Text className="text-gray-500 mt-1">
            Historial reciente y seguimiento en vivo
          </Text>
        </View>
      }
      renderItem={({ item }) => <OrderCard item={item} />}
      ListFooterComponent={
        <View className="mt-2 mb-8">
          <HelpSection />
        </View>
      }
    />
  );
}
