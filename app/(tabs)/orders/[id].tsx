import { View, Text, ScrollView, Pressable, Alert } from "react-native";
import { useLocalSearchParams } from "expo-router";
import Toast from "react-native-toast-message";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getPedido, cancelarPedido } from "../../../src/lib/api";
import { tracker } from "../../../src/lib/tracker";
import { formatCOP, formatDate, formatTime } from "../../../src/lib/format";
import { OrderStatusTimeline } from "../../../src/components/OrderStatusTimeline";
import { SkeletonBox } from "../../../src/components/skeletons/SkeletonBox";
import { ErrorState } from "../../../src/components/ErrorState";

import * as Sentry from "@sentry/react-native";
import { CARD_SHADOW } from "../../../src/constants/styles";

/* ── Skeleton de carga ───────────────────────────────────── */

function OrderDetailSkeleton() {
  return (
    <View className="flex-1 bg-surface-low p-4" style={{ gap: 16 }}>
      <View className="bg-white rounded-2xl p-6" style={CARD_SHADOW}>
        <SkeletonBox style={{ width: "50%", height: 20 }} className="rounded mb-2" />
        <SkeletonBox style={{ width: "35%", height: 12 }} className="rounded mb-4" />
        <SkeletonBox style={{ width: "100%", height: 80 }} className="rounded" />
      </View>
      <View className="bg-white rounded-2xl p-6" style={CARD_SHADOW}>
        <SkeletonBox style={{ width: "30%", height: 14 }} className="rounded mb-3" />
        {[1, 2, 3].map((i) => (
          <View key={i} className="flex-row justify-between py-2">
            <SkeletonBox style={{ width: "60%", height: 12 }} className="rounded" />
            <SkeletonBox style={{ width: "20%", height: 12 }} className="rounded" />
          </View>
        ))}
      </View>
    </View>
  );
}

/* ── Pantalla de detalle ─────────────────────────────────── */

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const pedidoId = id && id.trim() ? Number(id) : NaN;
  const queryClient = useQueryClient();

  const { data: pedido, isLoading, isError, refetch } = useQuery({
    queryKey: ["pedido", pedidoId],
    queryFn: () => getPedido(pedidoId),
    // M-ORD-11: no seguir haciendo polling si el pedido ya está en estado final.
    refetchInterval: (query) =>
      ["entregado", "cancelado"].includes(query.state.data?.estado ?? "") ? false : 15000,
    enabled: Number.isFinite(pedidoId) && pedidoId > 0,
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelarPedido(pedidoId),
    onSuccess: () => {
      tracker.track('pedido_cancelado', { pedido_id: pedidoId }, 'orders/[id]');
      queryClient.invalidateQueries({ queryKey: ["pedido", pedidoId] });
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
      Toast.show({ type: "success", text1: "Pedido cancelado" });
    },
    onError: (err: Error) => {
      Sentry.captureException(err, {
        tags: { flow: "orders", action: "cancelar", screen: "orders/[id]" },
        extra: { pedido_id: pedidoId },
      });
      Toast.show({ type: "error", text1: "No se pudo cancelar", text2: err.message });
    },
  });

  const handleCancelar = () => {
    Alert.alert("Cancelar pedido", "Estas seguro?", [
      { text: "No" },
      {
        text: "Si, cancelar",
        style: "destructive",
        onPress: () => cancelMutation.mutate(),
      },
    ]);
  };

  if (!Number.isFinite(pedidoId) || pedidoId <= 0) {
    return (
      <View className="flex-1 items-center justify-center bg-surface-low">
        <ErrorState mensaje="Pedido no encontrado" />
      </View>
    );
  }

  if (isError) {
    return (
      <View className="flex-1 items-center justify-center bg-surface-low">
        <ErrorState mensaje="No se pudo cargar el pedido" onRetry={refetch} />
      </View>
    );
  }

  if (isLoading || !pedido) {
    return <OrderDetailSkeleton />;
  }

  return (
    <ScrollView
      className="flex-1 bg-surface-low"
      // paddingBottom 112 = tab bar flotante (64) + offset (12) + margen (36) para que el botón
      // "Cancelar pedido" no quede tapado por la barra de tabs flotante.
      contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 112 }}
    >
      {/* Estado y timeline */}
      <View className="bg-white rounded-2xl p-6" style={CARD_SHADOW}>
        <Text className="text-xl font-bold text-on-surface mb-1">
          Pedido #{pedido.numero_orden_cliente ?? pedido.id}
        </Text>
        <Text className="text-sm text-gray-500">
          {formatDate(pedido.created_at)} - {formatTime(pedido.created_at)}
        </Text>
        <Text className="text-xs text-gray-400 mb-4 mt-1">
          Ref. soporte: #{pedido.id}
        </Text>
        <OrderStatusTimeline estado={pedido.estado} pedido={pedido} />
      </View>

      {/* Productos */}
      <View className="bg-white rounded-2xl p-6" style={CARD_SHADOW}>
        <Text className="text-base font-bold text-on-surface mb-4">
          Productos
        </Text>
        {pedido.lineas?.map((linea, index) => (
          <View
            key={linea.id}
            className={`flex-row justify-between py-3 ${
              index < (pedido.lineas?.length ?? 0) - 1
                ? "border-b border-gray-100"
                : ""
            }`}
          >
            <View className="flex-1 mr-3">
              <Text className="text-sm font-medium text-on-surface">
                {linea.nombre_producto}
              </Text>
              <Text className="text-xs text-gray-500 mt-0.5">
                x{linea.cantidad} - {formatCOP(linea.precio_unitario)} c/u
              </Text>
            </View>
            <Text className="text-sm font-semibold text-on-surface">
              {formatCOP(linea.subtotal)}
            </Text>
          </View>
        ))}

        {/* Total */}
        <View className="border-t border-gray-200 mt-2 pt-4 flex-row justify-between items-center">
          <Text className="text-base font-bold text-on-surface">Total</Text>
          <Text className="text-xl font-extrabold text-brand-600">
            {formatCOP(pedido.total)}
          </Text>
        </View>
      </View>

      {/* Direccion de entrega */}
      <View className="bg-white rounded-2xl p-6" style={CARD_SHADOW}>
        <Text className="text-base font-bold text-on-surface mb-3">
          Entrega
        </Text>
        <Text className="text-sm text-on-surface-variant">
          {pedido.direccion}
        </Text>
        {pedido.barrio && (
          <Text className="text-sm text-gray-500 mt-1">{pedido.barrio}</Text>
        )}
        {pedido.notas_cliente && (
          <Text className="text-sm text-gray-400 mt-2 italic">
            {pedido.notas_cliente}
          </Text>
        )}
      </View>

      {/* Boton cancelar */}
      {pedido.estado === "recibido" && (
        <Pressable
          onPress={handleCancelar}
          disabled={cancelMutation.isPending}
          className="bg-red-50 rounded-2xl py-4 items-center"
          style={CARD_SHADOW}
        >
          <Text className="text-red-600 font-semibold">Cancelar pedido</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}
