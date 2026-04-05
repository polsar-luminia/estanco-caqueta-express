import { useState } from "react";
import { View, Text, FlatList, TextInput, Pressable, Switch } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
import Toast from "react-native-toast-message";
import { useCartStore } from "../../src/stores/cart";
import { useAuthStore } from "../../src/stores/auth";
import { crearPedido } from "../../src/lib/api";
import { formatCOP } from "../../src/lib/format";
import { CartItem } from "../../src/components/CartItem";

function ChevronRightIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M9 18l6-6-6-6" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
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
  const [usarPuntos, setUsarPuntos] = useState(false);

  const subtotal = getTotal();
  const puntos = cliente?.puntos || 0;
  const puedeUsarPuntos = puntos >= 100;
  const envio = usarPuntos && puedeUsarPuntos ? 0 : 5000;
  const total = subtotal + envio;

  const handlePedir = async () => {
    if (!direccion.trim()) {
      Toast.show({ type: "error", text1: "Falta direccion", text2: "Ingresa tu direccion de entrega" });
      return;
    }
    if (items.length === 0) return;

    setLoading(true);
    try {
      const { pedido } = await crearPedido({
        direccion: direccion.trim(),
        barrio: barrio.trim() || undefined,
        notas_cliente: notas.trim() || undefined,
        usar_puntos: usarPuntos && puedeUsarPuntos,
        lineas: items.map((i) => ({ producto_id: i.productoId, cantidad: i.cantidad })),
      });
      clear();
      // Refrescar perfil para actualizar puntos
      const { getPerfil } = await import("../../src/lib/api");
      const clienteActualizado = await getPerfil();
      useAuthStore.getState().setCliente(clienteActualizado);

      const ptsMsg = (pedido as any).puntos_ganados ? ` (+${(pedido as any).puntos_ganados} pts)` : "";
      Toast.show({
        type: "success",
        text1: "Pedido confirmado" + ptsMsg,
        text2: `Pedido #${pedido.id} - ${formatCOP(pedido.total)}`,
        visibilityTime: 3000,
      });
      router.push("/(tabs)/orders");
    } catch (err: any) {
      Toast.show({ type: "error", text1: "Error", text2: err.message || "No se pudo crear el pedido" });
    } finally {
      setLoading(false);
    }
  };

  if (items.length === 0) {
    return (
      <View className="flex-1 items-center justify-center px-6" style={{ backgroundColor: "#FAFAF6" }}>
        <Text style={{ fontSize: 48, marginBottom: 16 }}>🛒</Text>
        <Text style={{ fontSize: 20, fontWeight: "700", color: "#6D7B6C", marginBottom: 6 }}>Carrito vacío</Text>
        <Text style={{ color: "#BCCABA", textAlign: "center", fontSize: 14 }}>
          Agrega productos desde el catálogo para hacer tu pedido
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: "#FAFAF6" }}>
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.productoId)}
        contentContainerStyle={{ padding: 16, paddingBottom: 200 }}
        ListHeaderComponent={
          <Text style={{ fontSize: 22, fontWeight: "800", color: "#1A1C1A", marginBottom: 16, letterSpacing: -0.5 }}>
            Tu Carrito
          </Text>
        }
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        renderItem={({ item }) => <CartItem item={item} />}
        ListFooterComponent={
          <View style={{ gap: 24, marginTop: 24 }}>
            {/* Delivery Form */}
            <View className="p-5 rounded-2xl" style={{ backgroundColor: "#F4F4F0" }}>
              <View className="flex-row items-center mb-5">
                <Text style={{ fontSize: 20, marginRight: 8 }}>🚚</Text>
                <Text style={{ fontSize: 18, fontWeight: "700", color: "#1A1C1A" }}>Detalles de Entrega</Text>
              </View>

              <Text style={{ fontSize: 10, fontWeight: "700", color: "#6D7B6C", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 6, marginLeft: 4 }}>
                Dirección Exacta
              </Text>
              <TextInput
                style={{ backgroundColor: "#fff", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 14, color: "#1A1C1A", marginBottom: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 }}
                placeholder="Carrera 15 # 12-34"
                placeholderTextColor="#BCCABA"
                value={direccion || cliente?.direccion || ""}
                onChangeText={setDireccion}
              />

              <Text style={{ fontSize: 10, fontWeight: "700", color: "#6D7B6C", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 6, marginLeft: 4 }}>
                Barrio
              </Text>
              <TextInput
                style={{ backgroundColor: "#fff", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 14, color: "#1A1C1A", marginBottom: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 }}
                placeholder="El Prado"
                placeholderTextColor="#BCCABA"
                value={barrio || cliente?.barrio || ""}
                onChangeText={setBarrio}
              />

              <Text style={{ fontSize: 10, fontWeight: "700", color: "#6D7B6C", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 6, marginLeft: 4 }}>
                Notas (Opcional)
              </Text>
              <TextInput
                style={{ backgroundColor: "#fff", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 14, color: "#1A1C1A", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 }}
                placeholder="Ej: Portería, dejar con el vigilante..."
                placeholderTextColor="#BCCABA"
                value={notas}
                onChangeText={setNotas}
                multiline
              />
            </View>

            {/* Puntos + Envío */}
            <View className="rounded-2xl p-4 bg-white" style={{ borderWidth: 1, borderColor: "#F4F4F0", gap: 12 }}>
              <View className="flex-row justify-between">
                <Text style={{ fontSize: 14, color: "#6D7B6C" }}>Subtotal</Text>
                <Text style={{ fontSize: 14, fontWeight: "600", color: "#1A1C1A" }}>{formatCOP(subtotal)}</Text>
              </View>
              <View className="flex-row justify-between items-center">
                <Text style={{ fontSize: 14, color: "#6D7B6C" }}>Envío</Text>
                <Text style={{ fontSize: 14, fontWeight: "600", color: envio === 0 ? "#1FAF55" : "#1A1C1A" }}>
                  {envio === 0 ? "¡Gratis!" : formatCOP(envio)}
                </Text>
              </View>
              {puedeUsarPuntos && (
                <View className="flex-row justify-between items-center rounded-xl p-3" style={{ backgroundColor: "#F4F4F0" }}>
                  <View className="flex-1">
                    <Text style={{ fontSize: 13, fontWeight: "600", color: "#1A1C1A" }}>Usar 100 puntos</Text>
                    <Text style={{ fontSize: 11, color: "#6D7B6C" }}>Envío gratis (tienes {puntos} pts)</Text>
                  </View>
                  <Switch
                    value={usarPuntos}
                    onValueChange={setUsarPuntos}
                    trackColor={{ false: "#E2E3DF", true: "#1FAF55" }}
                    thumbColor="#fff"
                  />
                </View>
              )}
              {!puedeUsarPuntos && puntos > 0 && (
                <Text style={{ fontSize: 11, color: "#6D7B6C", fontStyle: "italic" }}>
                  Tienes {puntos} pts. Necesitas 100 para envío gratis.
                </Text>
              )}
            </View>

            {/* Express Banner */}
            <LinearGradient
              colors={["#1FAF55", "#006D30"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ borderRadius: 16, padding: 20, overflow: "hidden" }}
            >
              <View className="flex-row items-center">
                <View className="flex-1">
                  <Text style={{ fontSize: 9, fontWeight: "700", color: "rgba(255,255,255,0.7)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>
                    Express Delivery
                  </Text>
                  <Text style={{ fontSize: 17, fontWeight: "700", color: "#fff", lineHeight: 22 }}>
                    Domicilio en Florencia
                  </Text>
                  <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.85)", marginTop: 4 }}>
                    Efectivo, QR o datáfono contra entrega.
                  </Text>
                </View>
                <Text style={{ fontSize: 40, opacity: 0.2 }}>⚡</Text>
              </View>
            </LinearGradient>
          </View>
        }
      />

      {/* Sticky Bottom */}
      <View
        className="bg-white px-6 pt-4"
        style={{
          paddingBottom: 80,
          borderTopWidth: 1,
          borderTopColor: "#E8E8E5",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.06,
          shadowRadius: 12,
          elevation: 10,
        }}
      >
        <View className="flex-row justify-between items-end mb-4">
          <View>
            <Text style={{ fontSize: 10, fontWeight: "600", color: "#6D7B6C", textTransform: "uppercase", letterSpacing: 1.5 }}>
              Total a pagar
            </Text>
            <Text style={{ fontSize: 28, fontWeight: "800", color: "#D33587", letterSpacing: -1 }}>
              {formatCOP(total)}
            </Text>
          </View>
          <Text style={{ fontSize: 11, color: "#6D7B6C", fontStyle: "italic" }}>
            {envio === 0 ? "Envío gratis con puntos 🎉" : `Incluye domicilio (${formatCOP(envio)})`}
          </Text>
        </View>

        <Pressable
          onPress={handlePedir}
          disabled={loading}
        >
          <LinearGradient
            colors={loading ? ["#9E9E9E", "#757575"] : ["#1FAF55", "#006D30"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{
              borderRadius: 14,
              paddingVertical: 16,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              shadowColor: "#1FAF55",
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.3,
              shadowRadius: 16,
              elevation: 6,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 17, marginRight: 8 }}>
              {loading ? "Enviando..." : "Confirmar pedido"}
            </Text>
            {!loading && <ChevronRightIcon />}
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}
