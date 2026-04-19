import { useState, useRef } from "react";
import { View, Text, FlatList, TextInput, Pressable, Switch, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
import { Feather } from "@expo/vector-icons";
import Toast from "react-native-toast-message";
import { useCartStore } from "../../src/stores/cart";
import { useAuthStore } from "../../src/stores/auth";
import { useTiendaAbierta } from "../../src/hooks/useTiendaAbierta";
import { crearPedido, getDirecciones, crearDireccion, validarCupon, getConfigApp, getEstadoTienda, type DireccionGuardada, type CuponValidado } from "../../src/lib/api";
import { BarrioSelector, type BarrioSeleccionado } from "../../src/components/BarrioSelector";
import { tracker } from "../../src/lib/tracker";
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
  const direccionId = useCartStore((s) => s.direccionId);
  const setDireccionId = useCartStore((s) => s.setDireccionId);
  const getTotal = useCartStore((s) => s.getTotal);
  const clear = useCartStore((s) => s.clear);
  const cliente = useAuthStore((s) => s.cliente);
  const [loading, setLoading] = useState(false);
  const [usarPuntos, setUsarPuntos] = useState(false);
  const [mostrarNueva, setMostrarNueva] = useState(false);
  const [nuevaDireccion, setNuevaDireccion] = useState("");
  const [nuevoBarrioObj, setNuevoBarrioObj] = useState<BarrioSeleccionado | null>(null);
  const [nuevoBarrioTexto, setNuevoBarrioTexto] = useState("");
  const [nuevasNotas, setNuevasNotas] = useState("");
  const [codigoCupon, setCodigoCupon] = useState("");
  const [cuponValidado, setCuponValidado] = useState<CuponValidado | null>(null);
  const [cuponError, setCuponError] = useState("");
  const [validandoCupon, setValidandoCupon] = useState(false);
  const queryClient = useQueryClient();

  const tienda = useTiendaAbierta();

  const { data: configApp } = useQuery({
    queryKey: ['config-app'],
    queryFn: getConfigApp,
    staleTime: 5 * 60 * 1000,
  });

  const { data: direcciones = [], refetch: refetchDirs } = useQuery({
    queryKey: ["direcciones"],
    queryFn: getDirecciones,
  });

  const dirPredeterminada = direcciones.find((d) => d.predeterminada) || direcciones[0];
  const dirSeleccionada = direccionId ? direcciones.find((d) => d.id === direccionId) ?? null : null;
  const dirActiva = dirSeleccionada || dirPredeterminada;

  const subtotal = getTotal();
  const puntos = cliente?.puntos || 0;
  const puedeUsarPuntos = puntos >= 100;
  const envioGratisMinimo = configApp?.envio_gratis_minimo ?? 150000;
  const envioCosto = configApp?.envio_costo ?? 5000;
  const envio = (usarPuntos && puedeUsarPuntos) ? 0 : (subtotal >= envioGratisMinimo ? 0 : envioCosto);
  const descuentoCupon = cuponValidado?.descuento || 0;
  const total = subtotal - descuentoCupon + envio;

  const handleValidarCupon = async () => {
    if (!codigoCupon.trim()) return;
    if (cuponValidado?.cupon.codigo === codigoCupon.trim()) return;
    setValidandoCupon(true);
    setCuponError("");
    setCuponValidado(null);
    try {
      const result = await validarCupon(codigoCupon.trim(), subtotal);
      setCuponValidado(result);
      tracker.track('cupon_aplicado', { cupon_codigo: result.cupon.codigo, descuento: result.descuento }, 'cart');
      Toast.show({ type: "success", text1: "Cupon aplicado", text2: `-${formatCOP(result.descuento)} de descuento` });
    } catch (err: any) {
      setCuponError(err.message || "Cupon no valido");
      Toast.show({ type: "error", text1: "Cupon no valido", text2: err.message });
    } finally {
      setValidandoCupon(false);
    }
  };

  const handleQuitarCupon = () => {
    setCuponValidado(null);
    setCodigoCupon("");
    setCuponError("");
  };

  const submitLockRef = useRef(false);

  const handlePedir = async () => {
    if (submitLockRef.current) return;
    submitLockRef.current = true;

    if (subtotal < 30000) {
      submitLockRef.current = false;
      Toast.show({ type: "error", text1: "Pedido mínimo", text2: `Agrega ${formatCOP(30000 - subtotal)} más para continuar` });
      return;
    }

    const dir = dirActiva?.direccion || direccion.trim();
    const bar = dirActiva?.barrio || barrio.trim();
    const not = dirActiva?.notas || notas.trim();

    if (!dir && !mostrarNueva) {
      Toast.show({ type: "error", text1: "Falta direccion", text2: "Selecciona o agrega una direccion" });
      return;
    }
    if (mostrarNueva && !nuevaDireccion.trim()) {
      Toast.show({ type: "error", text1: "Falta direccion", text2: "Ingresa la nueva direccion" });
      return;
    }
    if (items.length === 0) return;

    const dirFinal = mostrarNueva ? nuevaDireccion.trim() : dir;
    const nuevoBarrioNombre = nuevoBarrioObj?.nombre || nuevoBarrioTexto.trim();
    const nuevoBarrioId = nuevoBarrioObj?.id || undefined;
    const barFinal = mostrarNueva ? nuevoBarrioNombre : bar;
    const barIdFinal = mostrarNueva ? nuevoBarrioId : (dirActiva as any)?.barrio_id || undefined;
    const notFinal = mostrarNueva ? nuevasNotas.trim() : not;

    if (!barFinal) {
      submitLockRef.current = false;
      Toast.show({ type: "error", text1: "Falta el barrio", text2: "Selecciona o escribe el barrio de entrega" });
      return;
    }

    setLoading(true);
    try {
      // S10 - Verificar estado fresco de la tienda antes de crear pedido
      const estadoTienda = await getEstadoTienda();
      if (!estadoTienda.abierta) {
        Toast.show({ type: "error", text1: "Tienda cerrada", text2: estadoTienda.proximaApertura || "Ya cerramos por hoy" });
        return;
      }

      // Guardar nueva dirección si la ingresó
      if (mostrarNueva && dirFinal) {
        await crearDireccion({ direccion: dirFinal, barrio: barFinal || undefined, barrio_id: barIdFinal, notas: notFinal || undefined, predeterminada: true });
        try { await refetchDirs(); } catch {}
      }

      const { pedido } = await crearPedido({
        direccion: dirFinal,
        barrio: barFinal || undefined,
        barrio_id: barIdFinal,
        notas_cliente: notFinal || undefined,
        usar_puntos: usarPuntos && puedeUsarPuntos,
        cupon_codigo: cuponValidado?.cupon.codigo || undefined,
        lineas: items.map((i) => ({ producto_id: i.productoId, cantidad: i.cantidad })),
      });
      tracker.track('pedido_creado', { pedido_id: pedido.id, total: pedido.total, items_count: items.length, uso_cupon: !!cuponValidado, uso_puntos: usarPuntos && puedeUsarPuntos }, 'cart');
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
      queryClient.invalidateQueries({ queryKey: ["cupones-disponibles"] });
      // Refrescar perfil antes de limpiar carrito (si falla, no afecta el pedido)
      const { getPerfil } = await import("../../src/lib/api");
      let clienteActualizado;
      try {
        clienteActualizado = await getPerfil();
      } catch {
        // Pedido creado exitosamente; puntos se actualizarán al reabrir el perfil
      }
      clear();
      if (clienteActualizado) {
        useAuthStore.getState().setCliente(clienteActualizado);
      }

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
      submitLockRef.current = false;
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
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={80}
      style={{ flex: 1 }}
    >
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
            {/* Delivery - Direcciones Guardadas */}
            <View className="p-5 rounded-2xl" style={{ backgroundColor: "#F4F4F0" }}>
              <View className="flex-row items-center justify-between mb-4">
                <View className="flex-row items-center">
                  <Text style={{ fontSize: 20, marginRight: 8 }}>🚚</Text>
                  <Text style={{ fontSize: 18, fontWeight: "700", color: "#1A1C1A" }}>Entrega</Text>
                </View>
                <Pressable onPress={() => setMostrarNueva(!mostrarNueva)}>
                  <Text style={{ fontSize: 12, fontWeight: "700", color: "#1FAF55" }}>
                    {mostrarNueva ? "Usar guardada" : "+ Nueva"}
                  </Text>
                </Pressable>
              </View>

              {!mostrarNueva ? (
                <>
                  {/* Direcciones guardadas */}
                  {direcciones.length > 0 ? (
                    <View style={{ gap: 8 }}>
                      {direcciones.map((d) => {
                        const selected = dirActiva?.id === d.id;
                        return (
                          <Pressable
                            key={d.id}
                            onPress={() => setDireccionId(d.id)}
                            className="flex-row items-center p-3 rounded-xl"
                            style={{
                              backgroundColor: "#fff",
                              borderWidth: 2,
                              borderColor: selected ? "#1FAF55" : "transparent",
                            }}
                          >
                            <Feather name="map-pin" size={16} color={selected ? "#1FAF55" : "#9E9E9E"} />
                            <View className="flex-1 ml-3">
                              <View className="flex-row items-center" style={{ gap: 6 }}>
                                <Text style={{ fontSize: 13, fontWeight: "700", color: "#1A1C1A" }}>{d.etiqueta}</Text>
                                {d.predeterminada && (
                                  <View style={{ backgroundColor: "rgba(31,175,85,0.1)", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 }}>
                                    <Text style={{ fontSize: 8, fontWeight: "700", color: "#1FAF55" }}>DEFAULT</Text>
                                  </View>
                                )}
                              </View>
                              <Text style={{ fontSize: 12, color: "#6D7B6C", marginTop: 2 }} numberOfLines={1}>
                                {d.direccion}{d.barrio ? ` - ${d.barrio}` : ""}
                              </Text>
                            </View>
                            {selected && <Feather name="check-circle" size={18} color="#1FAF55" />}
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : (
                    <Pressable
                      onPress={() => setMostrarNueva(true)}
                      className="items-center py-6 rounded-xl bg-white"
                    >
                      <Feather name="plus-circle" size={24} color="#1FAF55" />
                      <Text style={{ fontSize: 13, fontWeight: "600", color: "#1FAF55", marginTop: 6 }}>
                        Agregar dirección
                      </Text>
                    </Pressable>
                  )}
                </>
              ) : (
                <>
                  {/* Nueva dirección */}
                  <Text style={{ fontSize: 10, fontWeight: "700", color: "#6D7B6C", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 6, marginLeft: 4 }}>
                    Dirección
                  </Text>
                  <TextInput
                    style={{ backgroundColor: "#fff", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 14, color: "#1A1C1A", marginBottom: 12 }}
                    placeholder="Carrera 15 # 12-34"
                    placeholderTextColor="#BCCABA"
                    value={nuevaDireccion}
                    onChangeText={setNuevaDireccion}
                  />
                  <Text style={{ fontSize: 10, fontWeight: "700", color: "#6D7B6C", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 6, marginLeft: 4 }}>
                    Barrio
                  </Text>
                  <BarrioSelector
                    value={nuevoBarrioObj}
                    onSelect={setNuevoBarrioObj}
                    textoLibre={nuevoBarrioTexto}
                    onTextoLibreChange={setNuevoBarrioTexto}
                  />
                  <Text style={{ fontSize: 10, fontWeight: "700", color: "#6D7B6C", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 6, marginLeft: 4 }}>
                    Notas (Opcional)
                  </Text>
                  <TextInput
                    style={{ backgroundColor: "#fff", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 14, color: "#1A1C1A" }}
                    placeholder="Portería, dejar con vigilante..."
                    placeholderTextColor="#BCCABA"
                    value={nuevasNotas}
                    onChangeText={setNuevasNotas}
                    multiline
                    maxLength={200}
                  />
                </>
              )}
            </View>

            {/* Cupon de descuento */}
            <View className="p-5 rounded-2xl" style={{ backgroundColor: "#F4F4F0" }}>
              <View className="flex-row items-center mb-3">
                <Text style={{ fontSize: 20, marginRight: 8 }}>🏷️</Text>
                <Text style={{ fontSize: 18, fontWeight: "700", color: "#1A1C1A" }}>Cupon</Text>
              </View>

              {cuponValidado ? (
                <View className="flex-row items-center p-3 rounded-xl bg-white" style={{ borderWidth: 2, borderColor: "#1FAF55" }}>
                  <Feather name="check-circle" size={18} color="#1FAF55" />
                  <View className="flex-1 ml-3">
                    <Text style={{ fontSize: 13, fontWeight: "700", color: "#1FAF55" }}>
                      {cuponValidado.cupon.codigo}
                    </Text>
                    <Text style={{ fontSize: 11, color: "#6D7B6C" }}>
                      {cuponValidado.cupon.descripcion || (cuponValidado.cupon.tipo === "porcentaje" ? `${cuponValidado.cupon.valor}% de descuento` : `${formatCOP(cuponValidado.cupon.valor)} de descuento`)}
                    </Text>
                  </View>
                  <Pressable onPress={handleQuitarCupon}>
                    <Feather name="x-circle" size={18} color="#9E9E9E" />
                  </Pressable>
                </View>
              ) : (
                <View className="flex-row" style={{ gap: 8 }}>
                  <TextInput
                    style={{
                      flex: 1,
                      backgroundColor: "#fff",
                      borderRadius: 12,
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                      fontSize: 14,
                      color: "#1A1C1A",
                      fontFamily: "monospace",
                      textTransform: "uppercase",
                      letterSpacing: 2,
                    }}
                    placeholder="CODIGO"
                    placeholderTextColor="#BCCABA"
                    value={codigoCupon}
                    onChangeText={(t) => { setCodigoCupon(t.toUpperCase()); setCuponError(""); }}
                    autoCapitalize="characters"
                  />
                  <Pressable
                    onPress={handleValidarCupon}
                    disabled={validandoCupon || !codigoCupon.trim()}
                    style={{
                      backgroundColor: codigoCupon.trim() ? "#1FAF55" : "#E2E3DF",
                      borderRadius: 12,
                      paddingHorizontal: 16,
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>
                      {validandoCupon ? "..." : "Aplicar"}
                    </Text>
                  </Pressable>
                </View>
              )}

              {cuponError ? (
                <Text style={{ fontSize: 11, color: "#D33587", marginTop: 6, marginLeft: 4 }}>{cuponError}</Text>
              ) : null}
            </View>

            {/* Barra progreso envio gratis */}
            {subtotal < envioGratisMinimo && envio > 0 ? (
              <View style={{ backgroundColor: '#F4F4F0', borderRadius: 12, padding: 12, marginBottom: 0 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={{ fontSize: 12, color: '#6D7B6C' }}>Faltan {formatCOP(envioGratisMinimo - subtotal)} para envío gratis</Text>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#1FAF55' }}>{formatCOP(envioGratisMinimo)}</Text>
                </View>
                <View style={{ height: 4, borderRadius: 2, backgroundColor: '#E2E3DF' }}>
                  <View style={{ height: 4, borderRadius: 2, backgroundColor: '#1FAF55', width: `${Math.min(100, (subtotal / envioGratisMinimo) * 100)}%` }} />
                </View>
              </View>
            ) : subtotal >= envioGratisMinimo ? (
              <View style={{ backgroundColor: '#F4F4F0', borderRadius: 12, padding: 12, alignItems: 'center' }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#1FAF55' }}>🎉 ¡Envío gratis!</Text>
              </View>
            ) : null}

            {/* Puntos + Envio */}
            <View className="rounded-2xl p-4 bg-white" style={{ borderWidth: 1, borderColor: "#F4F4F0", gap: 12 }}>
              <View className="flex-row justify-between">
                <Text style={{ fontSize: 14, color: "#6D7B6C" }}>Subtotal</Text>
                <Text style={{ fontSize: 14, fontWeight: "600", color: "#1A1C1A" }}>{formatCOP(subtotal)}</Text>
              </View>
              {descuentoCupon > 0 && (
                <View className="flex-row justify-between">
                  <Text style={{ fontSize: 14, color: "#1FAF55" }}>Descuento cupon</Text>
                  <Text style={{ fontSize: 14, fontWeight: "600", color: "#1FAF55" }}>-{formatCOP(descuentoCupon)}</Text>
                </View>
              )}
              <View className="flex-row justify-between items-center">
                <Text style={{ fontSize: 14, color: "#6D7B6C" }}>Envio</Text>
                <Text style={{ fontSize: 14, fontWeight: "600", color: envio === 0 ? "#1FAF55" : "#1A1C1A" }}>
                  {envio === 0 ? "¡Gratis!" : formatCOP(envio)}
                </Text>
              </View>
              {puedeUsarPuntos && subtotal < envioGratisMinimo && (
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
              {!puedeUsarPuntos && puntos > 0 && subtotal < envioGratisMinimo && (
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
        {/* Banner cerrado */}
        {!tienda.abierta && (
          <View
            className="flex-row items-center px-4 py-3 rounded-xl mb-3"
            style={{ backgroundColor: "#1A1C1A" }}
          >
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#6B7280", marginRight: 10 }} />
            <View className="flex-1">
              <Text style={{ fontSize: 12, fontWeight: "700", color: "#fff" }}>Estamos cerrados ahora</Text>
              <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", marginTop: 1 }}>
                {tienda.proximaApertura}
              </Text>
            </View>
          </View>
        )}

        <View className="flex-row justify-between items-end mb-4">
          <View>
            <Text style={{ fontSize: 10, fontWeight: "600", color: "#6D7B6C", textTransform: "uppercase", letterSpacing: 1.5 }}>
              Total a pagar
            </Text>
            <Text style={{ fontSize: 28, fontWeight: "800", color: "#D33587", letterSpacing: -1 }}>
              {formatCOP(total)}
            </Text>
            {(() => {
              const ahorroEnvio = envio === 0 ? envioCosto : 0;
              const totalAhorro = descuentoCupon + ahorroEnvio;
              return totalAhorro > 0 ? (
                <Text style={{ fontSize: 12, fontWeight: "700", color: "#1FAF55", marginTop: 2 }}>
                  Ahorras {formatCOP(totalAhorro)} 🎉
                </Text>
              ) : null;
            })()}
          </View>
          <View>
            <Text style={{ fontSize: 11, color: "#6D7B6C", fontStyle: "italic" }}>
              {envio === 0 ? "Envío gratis con puntos 🎉" : `Incluye domicilio (${formatCOP(envio)})`}
            </Text>
            {subtotal < 30000 && (
              <Text style={{ fontSize: 11, color: "#D33587", fontWeight: "600", marginTop: 2 }}>
                Pedido mínimo: {formatCOP(30000)} (faltan {formatCOP(30000 - subtotal)})
              </Text>
            )}
          </View>
        </View>

        <Pressable
          onPress={handlePedir}
          disabled={loading || !tienda.abierta || subtotal < 30000}
        >
          <LinearGradient
            colors={
              !tienda.abierta ? ["#3D3D3D", "#2A2A2A"] :
              subtotal < 30000 ? ["#BCCABA", "#9EA89D"] :
              loading ? ["#9E9E9E", "#757575"] :
              ["#1FAF55", "#006D30"]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{
              borderRadius: 14,
              paddingVertical: 16,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              shadowColor: tienda.abierta ? "#1FAF55" : "#000",
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: tienda.abierta ? 0.3 : 0.1,
              shadowRadius: 16,
              elevation: 6,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 17, marginRight: 8 }}>
              {loading ? "Enviando..." : !tienda.abierta ? "Tienda cerrada" : subtotal < 30000 ? `Faltan ${formatCOP(30000 - subtotal)}` : "Confirmar pedido"}
            </Text>
            {!loading && tienda.abierta && <ChevronRightIcon />}
          </LinearGradient>
        </Pressable>
      </View>
    </View>
    </KeyboardAvoidingView>
  );
}
