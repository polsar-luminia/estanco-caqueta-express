import { useState } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  Pressable,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useCartStore } from "../../src/stores/cart";
import { useAuthStore } from "../../src/stores/auth";
import { crearPedido } from "../../src/lib/api";
import { formatCOP } from "../../src/lib/format";
import { CartItem } from "../../src/components/CartItem";

export default function CartScreen() {
  const router = useRouter();
  const items = useCartStore((s) => s.items);
  const direccion = useCartStore((s) => s.direccion);
  const barrio = useCartStore((s) => s.barrio);
  const notas = useCartStore((s) => s.notas);
  const setDireccion = useCartStore((s) => s.setDireccion);
  const setBarrio = useCartStore((s) => s.setBarrio);
  const setNotas = useCartStore((s) => s.setNotas);
  const getTotal = useCartStore((s) => s.getTotal);
  const clear = useCartStore((s) => s.clear);
  const cliente = useAuthStore((s) => s.cliente);
  const [loading, setLoading] = useState(false);

  const total = getTotal();

  const handlePedir = async () => {
    if (!direccion.trim()) {
      Alert.alert("Error", "Ingresa tu direccion de entrega");
      return;
    }
    if (items.length === 0) {
      Alert.alert("Error", "Tu carrito esta vacio");
      return;
    }

    setLoading(true);
    try {
      const { pedido } = await crearPedido({
        direccion: direccion.trim(),
        barrio: barrio.trim() || undefined,
        notas_cliente: notas.trim() || undefined,
        lineas: items.map((i) => ({
          producto_id: i.productoId,
          cantidad: i.cantidad,
        })),
      });
      clear();
      Alert.alert(
        "Pedido confirmado",
        `Tu pedido #${pedido.id} fue recibido. Total: ${formatCOP(pedido.total)}`,
        [{ text: "Ver pedidos", onPress: () => router.push("/(tabs)/orders") }]
      );
    } catch (err: any) {
      Alert.alert("Error", err.message || "No se pudo crear el pedido");
    } finally {
      setLoading(false);
    }
  };

  if (items.length === 0) {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center px-6">
        <Text className="text-xl text-gray-400 mb-2">Carrito vacio</Text>
        <Text className="text-gray-400 text-center">
          Agrega productos desde el catalogo para hacer tu pedido
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.productoId)}
        contentContainerStyle={{ padding: 16, gap: 8 }}
        renderItem={({ item }) => <CartItem item={item} />}
        ListFooterComponent={
          <View className="mt-4 gap-3">
            <Text className="text-base font-semibold text-gray-800">
              Datos de entrega
            </Text>

            <TextInput
              className="bg-white border border-gray-300 rounded-xl px-4 py-3 text-base"
              placeholder="Direccion de entrega *"
              value={direccion || cliente?.direccion || ""}
              onChangeText={setDireccion}
            />

            <TextInput
              className="bg-white border border-gray-300 rounded-xl px-4 py-3 text-base"
              placeholder="Barrio"
              value={barrio || cliente?.barrio || ""}
              onChangeText={setBarrio}
            />

            <TextInput
              className="bg-white border border-gray-300 rounded-xl px-4 py-3 text-base"
              placeholder="Notas (ej: tocar timbre, dejar en porteria)"
              value={notas}
              onChangeText={setNotas}
              multiline
            />
          </View>
        }
      />

      <View className="border-t border-gray-200 bg-white px-4 py-4">
        <View className="flex-row justify-between mb-3">
          <Text className="text-lg font-bold text-gray-800">Total</Text>
          <Text className="text-lg font-bold text-brand-800">
            {formatCOP(total)}
          </Text>
        </View>
        <Text className="text-xs text-gray-500 mb-3">
          Pago contra entrega
        </Text>
        <Pressable
          onPress={handlePedir}
          disabled={loading}
          className={`rounded-xl py-4 items-center ${
            loading ? "bg-gray-400" : "bg-brand-700"
          }`}
        >
          <Text className="text-white font-bold text-base">
            {loading ? "Enviando pedido..." : "Confirmar pedido"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
