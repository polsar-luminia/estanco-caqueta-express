import { useEffect, useRef, useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import Toast from "react-native-toast-message";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getConfigApp, getPedido, cancelarPedido } from "../../../src/lib/api";
import { tracker } from "../../../src/lib/tracker";
import { formatCOP, formatDate, formatTime } from "../../../src/lib/format";
import { OrderStatusTimeline } from "../../../src/components/OrderStatusTimeline";
import { TarjetaResena } from "../../../src/components/TarjetaResena";
import { HojaCancelar } from "../../../src/components/HojaCancelar";
import { MapaDomiciliario } from "../../../src/components/MapaDomiciliario";
import { FotoEntrega } from "../../../src/components/FotoEntrega";
import { SkeletonBox } from "../../../src/components/skeletons/SkeletonBox";
import { ErrorState } from "../../../src/components/ErrorState";

import * as Sentry from "@sentry/react-native";
import { Feather } from "@expo/vector-icons";
import { Image as ImagenExpo } from "expo-image";
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

  const [hojaCancelar, setHojaCancelar] = useState(false);

  const cancelMutation = useMutation({
    mutationFn: ({ motivo, detalle }: { motivo: string; detalle?: string }) =>
      cancelarPedido(pedidoId, motivo, detalle),
    onSuccess: (_data, variables) => {
      setHojaCancelar(false);
      // Solo el CODIGO del motivo viaja a telemetria. El texto libre no: es un
      // campo abierto donde la gente escribe lo que sea, incluida su direccion.
      tracker.track('pedido_cancelado', { pedido_id: pedidoId, motivo: variables.motivo }, 'orders/[id]');
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

  // Antes era un Alert de si/no. Ahora abre la hoja de motivos: el negocio
  // necesita saber POR QUE se cae un pedido, y preguntarlo en el momento en que
  // la persona ya decidio cancelar es cuando de verdad responde.
  const handleCancelar = () => setHojaCancelar(true);

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

  // En la calle el chat es con quien lleva el pedido; antes, con el mostrador.
  const enCalle = pedido.estado === "en_camino" || pedido.estado === "domiciliario_llego";

  return (
    <>
    <Stack.Screen
      options={{
        // El boton nativo de atras desaparece cuando se llega al detalle sin
        // pasar por la lista (justo despues de crear el pedido). Este siempre
        // esta, y sin historial lleva a Mis pedidos.
        headerLeft: () => (
          <Pressable
            // `navigate` y no `back()`. El boton dice "Pedidos", pero back() te
            // devuelve a DONDE ESTABAS, que no es lo mismo: si llegaste desde
            // el carrito al confirmar, o desde un push, lo de abajo es Inicio y
            // ahi terminabas. `navigate` vuelve a la lista si ya esta en la
            // pila, y si no, entra a ella — desde cualquier via de entrada.
            onPress={() => router.navigate("/(tabs)/orders")}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Volver a mis pedidos"
            style={{ flexDirection: "row", alignItems: "center", paddingRight: 8 }}
          >
            <Feather name="chevron-left" size={26} color="#fff" />
            <Text style={{ color: "#fff", fontSize: 15, fontWeight: "600" }}>Pedidos</Text>
          </Pressable>
        ),
      }}
    />
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
            recalcula en la app — el ETA no puede moverse hacia adelante.
            `no_entregado` queda fuera (077): el ETA se calculó para un viaje que
            ya se hizo y falló, así que seguir prometiendo "llega en 20–30 min"
            justo cuando el pedido volvió al estanco es la peor de las mentiras
            posibles — y no fallaría, se vería perfectamente normal. */}
        {pedido.eta && !["entregado", "cancelado", "domiciliario_llego", "no_entregado"].includes(pedido.estado) && (
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

        {/* Domicilio. El total SIEMPRE lo incluyó, pero sin este renglón el
            desglose no cuadraba a ojo (visto 16-ago: productos + frío ≠ total).
            $0 se dice "¡Gratis!" — es un logro del cliente, no un vacío. */}
        {pedido.costo_domicilio != null && (
          <View className="border-t border-gray-100 mt-2 pt-3 flex-row justify-between items-center">
            <Text className="text-sm text-gray-600">Domicilio</Text>
            {pedido.costo_domicilio > 0 ? (
              <Text className="text-sm font-semibold text-on-surface">{formatCOP(pedido.costo_domicilio)}</Text>
            ) : (
              <Text className="text-sm font-bold text-brand-600">¡Gratis!</Text>
            )}
          </View>
        )}
        {(pedido.descuento ?? 0) > 0 && (
          <View className="border-t border-gray-100 mt-2 pt-3 flex-row justify-between items-center">
            <Text className="text-sm text-gray-600">
              Descuento{pedido.cupon_codigo ? ` (${pedido.cupon_codigo})` : ""}
            </Text>
            <Text className="text-sm font-semibold" style={{ color: "#D33587" }}>
              -{formatCOP(pedido.descuento ?? 0)}
            </Text>
          </View>
        )}

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

      {/* Perfil del domiciliario asignado (070/071): foto, nombre, moto y
          placa. Solo se pinta si el backend lo manda — hoy casi nunca; queda
          listo para cuando Envíos Express asigne y llene perfiles. */}
      {pedido.domiciliario && (
        <View className="bg-white rounded-2xl p-5" style={CARD_SHADOW}>
          <Text style={{ fontSize: 12, fontWeight: "700", color: "#6D7B6C", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 10 }}>
            Tu domiciliario
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ width: 48, height: 48, borderRadius: 999, backgroundColor: "rgba(31,175,85,0.12)", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
              {pedido.domiciliario.foto_url ? (
                <ImagenExpo source={{ uri: pedido.domiciliario.foto_url }} style={{ width: 48, height: 48 }} contentFit="cover" />
              ) : (
                <Feather name="user" size={22} color="#1FAF55" />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15.5, fontWeight: "800", color: "#1A1C1A" }}>{pedido.domiciliario.nombre}</Text>
              {(pedido.domiciliario.moto || pedido.domiciliario.placa) && (
                <Text style={{ fontSize: 12.5, color: "#6D7B6C", marginTop: 1 }}>
                  {[pedido.domiciliario.moto, pedido.domiciliario.placa].filter(Boolean).join(" · ")}
                </Text>
              )}
            </View>
          </View>
        </View>
      )}

      {/* Por donde viene el repartidor. Solo en la calle; el resto de los limites
          (senal vieja, sin domiciliario, bandera apagada) los decide el SERVIDOR
          y el componente solo pinta lo que le den. */}
      {enCalle && <MapaDomiciliario pedidoId={pedido.id} />}

      {/* Chat del pedido: pantalla propia estilo WhatsApp (16-ago).
          Desde el 17-ago está vivo durante TODO el pedido, no solo en la calle:
          antes del despacho contesta el mostrador y después el domiciliario.
          Sin esto, en toda la preparación el cliente no tenía por dónde
          preguntar y le tocaba salirse a WhatsApp, donde lo que se acuerde
          queda suelto y no pegado al pedido.
          Quién puede escribir lo sigue decidiendo el SERVIDOR dentro del chat. */}
      {pedido.estado !== "entregado" && pedido.estado !== "cancelado" && (
        <Pressable
          onPress={() => router.push(`/chat/${pedido.id}?n=${pedido.numero_orden_cliente ?? ""}&v=1`)}
          accessibilityRole="button"
          accessibilityLabel={enCalle ? "Abrir el chat con tu domiciliario" : "Escribirle al Estanco"}
          className="bg-white rounded-2xl p-5"
          style={CARD_SHADOW}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ width: 40, height: 40, borderRadius: 999, backgroundColor: "rgba(31,175,85,0.12)", alignItems: "center", justifyContent: "center" }}>
              <Feather name="message-circle" size={20} color="#1FAF55" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: "800", color: "#1A1C1A" }}>
                {enCalle ? "Chat con tu domiciliario" : "Escríbele al Estanco"}
              </Text>
              <Text style={{ fontSize: 12.5, color: "#6D7B6C", marginTop: 1 }}>
                {(pedido.chat_sin_leer ?? 0) > 0
                  ? `${pedido.chat_sin_leer} mensaje${(pedido.chat_sin_leer ?? 0) > 1 ? "s" : ""} sin leer`
                  : enCalle
                    ? "Dile con quién dejar el pedido o acuérdale dónde es."
                    : "¿Necesitas cambiar algo del pedido o de la dirección?"}
              </Text>
            </View>
            {(pedido.chat_sin_leer ?? 0) > 0 && (
              <View style={{ minWidth: 22, height: 22, borderRadius: 11, backgroundColor: "#D33587", alignItems: "center", justifyContent: "center", paddingHorizontal: 6, marginRight: 4 }}>
                <Text style={{ color: "#fff", fontSize: 12, fontWeight: "800" }}>{pedido.chat_sin_leer}</Text>
              </View>
            )}
            <Feather name="chevron-right" size={20} color="#9E9E9E" />
          </View>
        </Pressable>
      )}

      {/* Calificación (bloque C). Solo en pedidos entregados: preguntarle a alguien
          que todavía está esperando cómo le fue es la peor forma de preguntarlo. */}
      {pedido.estado === "entregado" && (
        <View onLayout={(e) => setYResena(e.nativeEvent.layout.y)}>
          <TarjetaResena pedidoId={pedido.id} abrirAlEntrar={calificar === "1"} nombreDomiciliario={pedido.domiciliario?.nombre ?? null} />
        </View>
      )}

      {/* Foto de la entrega (bloque B). El enlace ahora exige la sesión del
          cliente y el servidor comprueba que el pedido sea suyo (078): antes se
          servía por una URL pública protegida solo por ser difícil de adivinar.
          El header lo pone FotoEntrega, que tiene que leer el token de
          SecureStore antes de poder pintar nada. */}
      {pedido.foto_entrega_url && (
        <View className="bg-white rounded-2xl p-6" style={CARD_SHADOW}>
          <Text className="text-base font-bold text-on-surface mb-3">
            Así se entregó tu pedido
          </Text>
          <FotoEntrega uri={pedido.foto_entrega_url} />
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

      <HojaCancelar
        visible={hojaCancelar}
        motivos={configApp?.motivos_cancelacion}
        enviando={cancelMutation.isPending}
        onCerrar={() => setHojaCancelar(false)}
        onConfirmar={(motivo, detalle) => cancelMutation.mutate({ motivo, detalle })}
      />

    </>
  );
}
