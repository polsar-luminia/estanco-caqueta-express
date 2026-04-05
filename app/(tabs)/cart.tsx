import { useState } from "react";
import { View, Text, FlatList, TextInput, Pressable } from "react-native";
import { useRouter } from "expo-router";
import Svg, { Path } from "react-native-svg";
import Toast from "react-native-toast-message";
import { useCartStore } from "../../src/stores/cart";
import { useAuthStore } from "../../src/stores/auth";
import { crearPedido } from "../../src/lib/api";
import { formatCOP } from "../../src/lib/format";
import { CartItem } from "../../src/components/CartItem";

function TruckIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M1 3h15v13H1zM16 8h4l3 3v5h-7V8z"
        stroke="#374151"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M5.5 21a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM18.5 21a2.5 2.5 0 100-5 2.5 2.5 0 000 5z"
        stroke="#374151"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function ChevronRightIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9 18l6-6-6-6"
        stroke="#fff"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

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
      Toast.show({
        type: "error",
        text1: "Falta direccion",
        text2: "Ingresa tu direccion de entrega",
      });
      return;
    }
    if (items.length === 0) {
      Toast.show({ type: "error", text1: "Carrito vacio" });
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
      Toast.show({
        type: "success",
        text1: "Pedido confirmado",
        text2: `Pedido #${pedido.id} - ${formatCOP(pedido.total)}`,
        visibilityTime: 3000,
      });
      router.push("/(tabs)/orders");
    } catch (err: any) {
      Toast.show({
        type: "error",
        text1: "Error",
        text2: err.message || "No se pudo crear el pedido",
      });
    } finally {
      setLoading(false);
    }
  };

  /* ── Estado vacío ── */
  if (items.length === 0) {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center px-6">
        <Text className="text-5xl mb-4">🛒</Text>
        <Text className="text-xl font-semibold text-gray-500 mb-2">
          Carrito vacio
        </Text>
        <Text className="text-gray-400 text-center">
          Agrega productos desde el catalogo para hacer tu pedido
        </Text>
      </View>
    );
  }

  /* ── Carrito con items ── */
  return (
    <View className="flex-1 bg-gray-50">
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.productoId)}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        renderItem={({ item }) => <CartItem item={item} />}
        ListFooterComponent={
          <View className="mt-4">
            {/* ── Datos de entrega ── */}
            <View className="p-5 rounded-2xl" style={{ backgroundColor: "#F5F7FA" }}>
              <View className="flex-row items-center mb-4">
                <TruckIcon />
                <Text className="text-base font-bold text-gray-800 ml-2">
                  Datos de entrega
                </Text>
              </View>

              {/* Direccion */}
              <Text className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                Direccion
              </Text>
              <TextInput
                className="bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-800 mb-4"
                placeholder="Calle 45 # 12 - 34"
                placeholderTextColor="#9CA3AF"
                value={direccion || cliente?.direccion || ""}
                onChangeText={setDireccion}
              />

              {/* Barrio */}
              <Text className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                Barrio
              </Text>
              <TextInput
                className="bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-800 mb-4"
                placeholder="El Recreo"
                placeholderTextColor="#9CA3AF"
                value={barrio || cliente?.barrio || ""}
                onChangeText={setBarrio}
              />

              {/* Notas */}
              <Text className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                Notas de entrega
              </Text>
              <TextInput
                className="bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-800"
                placeholder="Porton gris, dejar en porteria..."
                placeholderTextColor="#9CA3AF"
                value={notas}
                onChangeText={setNotas}
                multiline
              />
            </View>

            {/* ── Resumen ── */}
            <View className="mt-5 px-1 mb-4">
              <View className="flex-row justify-between mb-2">
                <Text className="text-sm text-gray-500">Subtotal</Text>
                <Text className="text-sm font-semibold text-gray-800">
                  {formatCOP(total)}
                </Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-sm text-gray-500">Domicilio</Text>
                <Text
                  className="text-sm font-bold"
                  style={{ color: "#D33587" }}
                >
                  ¡Gratis!
                </Text>
              </View>
            </View>
          </View>
        }
      />

      {/* ── Footer fijo ── */}
      <View
        className="bg-white border-t border-gray-200 px-5 py-4 flex-row items-center justify-between"
        style={{
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: 0.08,
          shadowRadius: 6,
          elevation: 8,
        }}
      >
        {/* Lado izquierdo: Total */}
        <View>
          <Text
            className="font-bold text-gray-400 uppercase"
            style={{ fontSize: 10, letterSpacing: 1.5 }}
          >
            Total a Pagar
          </Text>
          <Text className="text-xl font-extrabold text-gray-900">
            {formatCOP(total)}
          </Text>
        </View>

        {/* Lado derecho: Boton */}
        <Pressable
          onPress={handlePedir}
          disabled={loading}
          className={`flex-row items-center rounded-xl px-6 py-3.5 ${
            loading ? "bg-gray-400" : "bg-green-600"
          }`}
        >
          <Text className="text-white font-bold text-sm mr-1.5">
            {loading ? "Enviando..." : "Confirmar pedido"}
          </Text>
          {!loading && <ChevronRightIcon />}
        </Pressable>
      </View>
    </View>
  );
}
