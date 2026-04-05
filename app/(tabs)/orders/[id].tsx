import { View, Text, ScrollView, Pressable, Alert } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getPedido, cancelarPedido } from "../../../src/lib/api";
import { formatCOP, formatDate, formatTime } from "../../../src/lib/format";
import { OrderStatusTimeline } from "../../../src/components/OrderStatusTimeline";

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: pedido, isLoading } = useQuery({
    queryKey: ["pedido", id],
    queryFn: () => getPedido(Number(id)),
    refetchInterval: 15000, // Refrescar cada 15s para ver cambios de estado
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelarPedido(Number(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pedido", id] });
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
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

  if (isLoading || !pedido) {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center">
        <Text className="text-gray-400">Cargando...</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-gray-50 p-4">
      <View className="bg-white rounded-xl p-4 mb-4">
        <Text className="text-xl font-bold text-gray-800 mb-1">
          Pedido #{pedido.id}
        </Text>
        <Text className="text-sm text-gray-500 mb-4">
          {formatDate(pedido.created_at)} - {formatTime(pedido.created_at)}
        </Text>
        <OrderStatusTimeline estado={pedido.estado} pedido={pedido} />
      </View>

      <View className="bg-white rounded-xl p-4 mb-4">
        <Text className="font-semibold text-gray-800 mb-3">Productos</Text>
        {pedido.lineas?.map((linea) => (
          <View
            key={linea.id}
            className="flex-row justify-between py-2 border-b border-gray-100"
          >
            <View className="flex-1 mr-2">
              <Text className="text-sm text-gray-800">
                {linea.nombre_producto}
              </Text>
              <Text className="text-xs text-gray-500">
                x{linea.cantidad} - {formatCOP(linea.precio_unitario)} c/u
              </Text>
            </View>
            <Text className="text-sm font-semibold text-gray-800">
              {formatCOP(linea.subtotal)}
            </Text>
          </View>
        ))}
        <View className="flex-row justify-between pt-3">
          <Text className="text-base font-bold text-gray-800">Total</Text>
          <Text className="text-base font-bold text-brand-800">
            {formatCOP(pedido.total)}
          </Text>
        </View>
      </View>

      <View className="bg-white rounded-xl p-4 mb-4">
        <Text className="font-semibold text-gray-800 mb-2">Entrega</Text>
        <Text className="text-sm text-gray-600">{pedido.direccion}</Text>
        {pedido.barrio && (
          <Text className="text-sm text-gray-500">{pedido.barrio}</Text>
        )}
        {pedido.notas_cliente && (
          <Text className="text-sm text-gray-400 mt-1">
            {pedido.notas_cliente}
          </Text>
        )}
      </View>

      {pedido.estado === "recibido" && (
        <Pressable
          onPress={handleCancelar}
          disabled={cancelMutation.isPending}
          className="bg-red-50 border border-red-200 rounded-xl py-3 items-center mb-8"
        >
          <Text className="text-red-600 font-medium">Cancelar pedido</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}
