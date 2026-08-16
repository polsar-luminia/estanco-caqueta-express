import { useEffect, useRef, useState } from "react";
import { View, Text, ScrollView, Pressable, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import Toast from "react-native-toast-message";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getConfigApp, getPedido, cancelarPedido } from "../../../src/lib/api";
import { tracker } from "../../../src/lib/tracker";
import { formatCOP, formatDate, formatTime } from "../../../src/lib/format";
import { OrderStatusTimeline } from "../../../src/components/OrderStatusTimeline";
import { TarjetaResena } from "../../../src/components/TarjetaResena";
import { SkeletonBox } from "../../../src/components/skeletons/SkeletonBox";
import { ErrorState } from "../../../src/components/ErrorState";

import * as Sentry from "@sentry/react-native";
import { Feather } from "@expo/vector-icons";
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
  // `calificar=1` llega del deep link del push de reseña: abre el formulario ya
  // desplegado. Si el cliente tiene que buscar dónde calificar, no califica.
  // `chat=1` llega del deep link del push de mensaje nuevo: abre el hilo ya
  // desplegado, por el mismo motivo que `calificar=1` baja hasta la reseña.
  const { id, calificar, chat } = useLocalSearchParams<{
    id: string;
    calificar?: string;
    chat?: string;
  }>();
  const pedidoId = id && id.trim() ? Number(id) : NaN;
  const queryClient = useQueryClient();

  // `chat=1` (push de mensaje nuevo): ir directo a la pantalla del chat, una
  // sola vez — al volver con el boton atras no debe rebotar de nuevo.
  const router = useRouter();
  const chatAbiertoRef = useRef(false);

  // Bajar hasta la tarjeta de calificación cuando se llega con `calificar=1`.
  // Antes ese parámetro solo le pintaba un borde verde, y la tarjeta vive al final
  // de la pantalla: el cliente tocaba "Califícanos en 10 segundos", aterrizaba
  // arriba del todo y tenía que ponerse a buscar. Es exactamente lo que la tarjeta
  // dice que no le va a tocar hacer.
  const scrollRef = useRef<ScrollView>(null);
  const [yResena, setYResena] = useState<number | null>(null);
  const yaBajoRef = useRef(false);

  useEffect(() => {
    if (calificar !== "1" || yResena === null || yaBajoRef.current) return;
    // Una sola vez: si vuelve a medirse (rotación, la reseña se envía y la tarjeta
    // cambia de alto) no se le arrastra la pantalla al cliente otra vez.
    yaBajoRef.current = true;
    // El margen de 16 deja ver que hay algo encima y que no es el tope.
    scrollRef.current?.scrollTo({ y: Math.max(0, yResena - 16), animated: true });
  }, [calificar, yResena]);

  useEffect(() => {
    if (chat === "1" && !chatAbiertoRef.current && Number.isFinite(pedidoId) && pedidoId > 0) {
      chatAbiertoRef.current = true;
      router.push(`/chat/${pedidoId}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- una sola vez por entrada con ?chat=1
  }, [chat, pedidoId]);

  // Bandera de estados extendidos: decide si el timeline muestra los 6 pasos
  // completos desde el arranque. Comparte caché con el carrito.
  const { data: configApp } = useQuery({
    queryKey: ['config-app'],
    queryFn: getConfigApp,
    staleTime: 5 * 60 * 1000,
  });

  const { data: pedido, isLoading, isError, refetch } = useQuery({
    queryKey: ["pedido", pedidoId],
    queryFn: () => getPedido(pedidoId),
    // M-ORD-11: no seguir haciendo polling si el pedido ya está en estado final.
    refetchInterval: (query) =>
      ["entregado", "cancelado"].includes(query.state.data?.estado ?? "") ? false : 15000,
    // Esta pantalla existe para mostrar en qué va el pedido, así que servir una
    // copia de hace rato es servir lo contrario de lo que promete. El staleTime
    // global es de 5 minutos: si el pedido pasó a entregado mientras el cliente
    // estaba en otro lado, al volver seguía viendo "en camino" —y con él, la
    // tarjeta de calificación escondida, porque solo sale en pedidos entregados.
    // Justo el caso de quien llega desde el push de reseña.
    staleTime: 0,
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
      ref={scrollRef}
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
        <OrderStatusTimeline estado={pedido.estado} pedido={pedido} estadosExtendidos={configApp?.estados_extendidos_activo === true} />

        {/* El servidor ya resolvió el override del staff y la bandera: si llega un
            rango, se muestra; si llega null, no hay nada que prometer. Nunca se
            recalcula en la app — el ETA no puede moverse hacia adelante. */}
        {pedido.eta && !["entregado", "cancelado", "domiciliario_llego"].includes(pedido.estado) && (
          <View className="mt-4 rounded-xl px-4 py-3" style={{ backgroundColor: "rgba(31,175,85,0.08)" }}>
            <Text className="text-xs" style={{ color: "#6D7B6C" }}>Tiempo estimado de entrega</Text>
            <Text className="text-lg font-extrabold" style={{ color: "#14803E" }}>
              {pedido.eta.min}–{pedido.eta.max} min
            </Text>
          </View>
        )}
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

        {/* Frío asegurado. Cuando el cargo se quitó porque no alcanzó a estar
            frío, el cliente tiene que verlo aquí: sin eso nunca se entera de que
            cumplimos y el cobro se siente como una estafa. */}
        {pedido.frio && (pedido.frio_costo ?? 0) > 0 && (
          <View className="border-t border-gray-100 mt-2 pt-3 flex-row justify-between items-center">
            <Text className="text-sm text-gray-600">Frío asegurado</Text>
            <Text className="text-sm font-semibold" style={{ color: "#0F3A6B" }}>
              {formatCOP(pedido.frio_costo ?? 0)}
            </Text>
          </View>
        )}
        {pedido.frio_removido && (
          <View className="border-t border-gray-100 mt-2 pt-3">
            <Text className="text-sm font-semibold" style={{ color: "#0F3A6B" }}>
              Frío — no alcanzó, sin cobro
            </Text>
            <Text className="text-xs text-gray-500 mt-0.5">
              No alcanzamos a tenerlo frío, así que te quitamos el cargo.
            </Text>
          </View>
        )}

        {/* Total */}
        <View className="border-t border-gray-200 mt-2 pt-4 flex-row justify-between items-center">
          <Text className="text-base font-bold text-on-surface">Total</Text>
          <Text className="text-xl font-extrabold text-brand-600">
            {formatCOP(pedido.total)}
          </Text>
        </View>
      </View>

      {/* Chat con el domiciliario: pantalla propia estilo WhatsApp (16-ago).
          La tarjeta solo aparece con el pedido en la calle; quién puede escribir
          lo sigue decidiendo el SERVIDOR dentro de la pantalla del chat. */}
      {(pedido.estado === "en_camino" || pedido.estado === "domiciliario_llego") && (
        <Pressable
          onPress={() => router.push(`/chat/${pedido.id}?n=${pedido.numero_orden_cliente ?? ""}`)}
          accessibilityRole="button"
          accessibilityLabel="Abrir el chat con tu domiciliario"
          className="bg-white rounded-2xl p-5"
          style={CARD_SHADOW}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ width: 40, height: 40, borderRadius: 999, backgroundColor: "rgba(31,175,85,0.12)", alignItems: "center", justifyContent: "center" }}>
              <Feather name="message-circle" size={20} color="#1FAF55" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: "800", color: "#1A1C1A" }}>Chat con tu domiciliario</Text>
              <Text style={{ fontSize: 12.5, color: "#6D7B6C", marginTop: 1 }}>
                Dile con quién dejar el pedido o acuérdale dónde es.
              </Text>
            </View>
            <Feather name="chevron-right" size={20} color="#9E9E9E" />
          </View>
        </Pressable>
      )}

      {/* Calificación (bloque C). Solo en pedidos entregados: preguntarle a alguien
          que todavía está esperando cómo le fue es la peor forma de preguntarlo. */}
      {pedido.estado === "entregado" && (
        <View onLayout={(e) => setYResena(e.nativeEvent.layout.y)}>
          <TarjetaResena pedidoId={pedido.id} abrirAlEntrar={calificar === "1"} />
        </View>
      )}

      {/* Foto de la entrega (bloque B). Solo llega si el pedido es del cliente:
          el endpoint filtra por cliente_id. Es la prueba de que llegó y dónde. */}
      {pedido.foto_entrega_url && (
        <View className="bg-white rounded-2xl p-6" style={CARD_SHADOW}>
          <Text className="text-base font-bold text-on-surface mb-3">
            Así se entregó tu pedido
          </Text>
          <Image
            source={{ uri: pedido.foto_entrega_url }}
            accessibilityLabel="Foto de la entrega de tu pedido"
            contentFit="cover"
            style={{ width: "100%", height: 200, borderRadius: 12 }}
            transition={150}
          />
        </View>
      )}

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
          accessibilityRole="button"
          accessibilityLabel={`Cancelar el pedido número ${pedido.numero_orden_cliente ?? pedido.id}`}
          accessibilityState={{ disabled: cancelMutation.isPending }}
          className="bg-red-50 rounded-2xl py-4 items-center"
          style={CARD_SHADOW}
        >
          <Text className="text-red-600 font-semibold">Cancelar pedido</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}
