import { View, Text, FlatList, Pressable, RefreshControl } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { getPedidos } from "../../../src/lib/api";
import { formatCOP, formatDate, formatTime } from "../../../src/lib/format";
import { OrderCardSkeleton } from "../../../src/components/skeletons/OrderCardSkeleton";

const ESTADO_LABEL: Record<string, string> = {
  recibido: "Recibido",
  en_preparacion: "En preparacion",
  en_camino: "En camino",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

const ESTADO_COLOR: Record<string, string> = {
  recibido: "bg-blue-100 text-blue-800",
  en_preparacion: "bg-yellow-100 text-yellow-800",
  en_camino: "bg-orange-100 text-orange-800",
  entregado: "bg-green-100 text-green-800",
  cancelado: "bg-red-100 text-red-800",
};

export default function OrdersScreen() {
  const router = useRouter();

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
      <View className="flex-1 bg-gray-50 p-4" style={{ gap: 12 }}>
        <OrderCardSkeleton />
        <OrderCardSkeleton />
        <OrderCardSkeleton />
      </View>
    );
  }

  if (pedidos.length === 0) {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center px-6">
        <Text className="text-xl text-gray-400 mb-2">Sin pedidos</Text>
        <Text className="text-gray-400 text-center">
          Tus pedidos apareceran aqui cuando hagas tu primera compra
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      className="flex-1 bg-gray-50"
      data={pedidos}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={{ padding: 16, gap: 12 }}
      refreshControl={
        <RefreshControl refreshing={false} onRefresh={refetch} colors={["#17994A"]} />
      }
      renderItem={({ item }) => (
        <Pressable
          onPress={() => router.push(`/(tabs)/orders/${item.id}`)}
          className="bg-white rounded-xl p-4 border border-gray-100"
        >
          <View className="flex-row justify-between items-center mb-2">
            <Text className="font-bold text-gray-800">Pedido #{item.id}</Text>
            <View className={`px-2 py-1 rounded-lg ${ESTADO_COLOR[item.estado]}`}>
              <Text className="text-xs font-medium">
                {ESTADO_LABEL[item.estado]}
              </Text>
            </View>
          </View>
          <Text className="text-sm text-gray-500 mb-1">
            {formatDate(item.created_at)} - {formatTime(item.created_at)}
          </Text>
          <Text className="text-base font-semibold text-brand-800">
            {formatCOP(item.total)}
          </Text>
        </Pressable>
      )}
    />
  );
}
