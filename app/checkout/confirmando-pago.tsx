// Pantalla de confirmación de pago con tarjeta — dueña ÚNICA del cobro
// (rediseño 27-ago-2026, probado en vivo contra sandbox de Wompi). Antes el
// cobro corría fire-and-forget desde cart.tsx MIENTRAS el cliente ya estaba
// viendo el detalle del pedido (orders/[id].tsx) — que además le ofrecía ahí
// mismo "Otra tarjeta"/"Contra entrega". El dueño del producto decidió que
// el detalle de un pedido es de SOLO LECTURA y nunca debe pedirle al
// cliente que elija nada: esa decisión vive acá, o en el carrito/checkout
// (medio de pago inicial), nunca en la pantalla que solo informa el estado.
//
// El pedido YA existe cuando se llega aquí — POST /pedidos corrió en
// cart.tsx, ANTES del cobro, para reservar stock inmediatamente (si
// esperáramos a que el banco aprobara, alguien más podría comprarse las
// últimas unidades mientras este cliente todavía está metiendo la tarjeta).
// Esta pantalla nunca crea pedidos, solo cobra uno que ya existe y decide a
// dónde va el cliente según lo que responda el banco.
//
// Dos formas de llegar acá:
// 1. Recién creado el pedido en cart.tsx, CON metodoPagoId: esta pantalla
//    hace el cobro ella misma (getTokensAceptacion + pagarPedido).
// 2. Reabierto desde "Continuar con el pago" en orders/[id].tsx, SIN
//    metodoPagoId (esa pantalla no sabe qué tarjeta traía el intento
//    original): no se reintenta solo, se muestra el estado actual del
//    pedido y, si sigue sin resolver, las mismas dos salidas de siempre.

import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import * as Sentry from "@sentry/react-native";
import Toast from "react-native-toast-message";
import { colors, fuentes } from "../../src/constants/theme";
import { getPedido, getTokensAceptacion, pagarPedido, cambiarMedioPagoAEfectivo } from "../../src/lib/api";
import { useAuthStore } from "../../src/stores/auth";
import { tracker } from "../../src/lib/tracker";
import { HojaReintentarPago } from "../../src/components/checkout/HojaReintentarPago";
import { MS_PAGO_DEMORADO, dentroDeGraciaPago } from "../../src/lib/estadoPago";

type Estado = "cargando" | "esperando" | "aprobado" | "rechazado";

export default function ConfirmandoPagoScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const cliente = useAuthStore((s) => s.cliente);

  const { pedidoId: pedidoIdParam, metodoPagoId: metodoPagoIdParam, monto: montoParam } = useLocalSearchParams<{
    pedidoId: string;
    metodoPagoId?: string;
    monto?: string;
  }>();
  const pedidoId = pedidoIdParam && pedidoIdParam.trim() ? Number(pedidoIdParam) : NaN;
  const metodoPagoId = metodoPagoIdParam ? Number(metodoPagoIdParam) : null;
  const pedidoValido = Number.isFinite(pedidoId) && pedidoId > 0;

  const [hojaReintentarPago, setHojaReintentarPago] = useState(false);

  // --- Intento propio de cobro. Solo cuando llegamos CON una tarjeta ya
  // elegida en el checkout (metodoPagoId) -- la vía "Continuar con el pago"
  // de orders/[id].tsx no lo manda, y ahí no se intenta nada solo: se
  // muestra el estado actual del pedido tal cual está. ---
  const intentoHechoRef = useRef(false);
  const [intentoHecho, setIntentoHecho] = useState(metodoPagoId == null);
  // Motivo del fallo del intento PROPIO (no del pago en sí): sin email no se
  // pudo ni llamar al backend, y un error de red es que la llamada nunca
  // volvió con respuesta -- en los dos casos el cliente ve exactamente el
  // mismo estado de rechazo, con las mismas dos salidas. La diferencia entre
  // "el banco dijo que no" (DECLINED, se sabe con certeza) y "no sabemos si
  // alcanzó a cobrar" (red) solo importa para soporte/Sentry, nunca para lo
  // que se le muestra al cliente: no hay nada que el cliente pueda hacer
  // distinto en un caso o en el otro.
  const [intentoFallo, setIntentoFallo] = useState<"sin_email" | "red" | null>(null);

  useEffect(() => {
    if (intentoHechoRef.current || metodoPagoId == null || !pedidoValido) return;
    intentoHechoRef.current = true;
    (async () => {
      const email = cliente?.email;
      if (!email) {
        // Hueco ya documentado (fase 3): cliente?.email puede ser null
        // porque el registro es solo por teléfono. Sin correo el backend
        // rechaza POST /pedidos/:id/pagar con 400 -- ni se intenta, se va
        // derecho al mismo estado que un rechazo real.
        Sentry.captureMessage("Cobro con tarjeta sin email de cliente disponible", {
          tags: { flow: "pago_tarjeta", action: "pagar_checkout" },
        });
        setIntentoFallo("sin_email");
        setIntentoHecho(true);
        return;
      }
      try {
        const tokens = await getTokensAceptacion();
        await pagarPedido(pedidoId, {
          metodo_pago_id: metodoPagoId,
          customer_email: email,
          acceptance_token: tokens.acceptance_token ?? "",
          accept_personal_auth: tokens.accept_personal_auth ?? "",
        });
        tracker.track(
          "pago_iniciado",
          { pedido_id: pedidoId, monto: montoParam ? Number(montoParam) : 0 },
          "checkout/confirmando-pago"
        );
      } catch (err) {
        // Un error acá es de RED (la llamada nunca volvió) -- un rechazo del
        // banco no lanza: pagarPedido() responde 200/202 igual, con
        // estado:"DECLINED" adentro, y eso se ve más abajo vía el polling de
        // getPedido(), no por acá.
        Sentry.captureException(err instanceof Error ? err : new Error(String(err)), {
          tags: { flow: "pago_tarjeta", action: "pagar_checkout" },
        });
        setIntentoFallo("red");
      } finally {
        setIntentoHecho(true);
        queryClient.invalidateQueries({ queryKey: ["pedido", pedidoId] });
      }
    })();
  }, [pedidoId, pedidoValido, metodoPagoId, cliente?.email, montoParam, queryClient]);

  // Mientras esperamos nuestro propio intento, no tiene sentido sondear el
  // pedido todavía (el pago ni siquiera existe en el backend hasta que
  // pagarPedido() responda) -- se retoma solo cuando intentoHecho pasa a true.
  const esperandoIntentoPropio = metodoPagoId != null && !intentoHecho;

  const { data: pedido } = useQuery({
    queryKey: ["pedido", pedidoId],
    queryFn: () => getPedido(pedidoId),
    enabled: pedidoValido,
    staleTime: 0,
    refetchInterval: (query) => {
      if (esperandoIntentoPropio) return false;
      const d = query.state.data;
      if (!d) return 2000;
      if (d.pago?.estado === "APPROVED") return false;
      if (d.pago?.estado === "PENDING") return 3000;
      if (d.pago == null && dentroDeGraciaPago(d.created_at)) return 2000;
      return false;
    },
  });

  // Mismo bug real que se arregló en orders/[id].tsx (commit b0c2e73):
  // dentroDeGraciaPago()/MS_PAGO_DEMORADO comparan contra Date.now() EN EL
  // RENDER, y mientras `pago` sigue igual entre polls, TanStack Query
  // devuelve la MISMA referencia (structural sharing) y el componente no se
  // vuelve a renderizar solo. Este tick fuerza un re-render propio mientras
  // haya algo tiempo-dependiente que reevaluar.
  const [, forzarTick] = useState(0);
  useEffect(() => {
    const necesitaTick = esperandoIntentoPropio || pedido?.pago == null || pedido?.pago?.estado === "PENDING";
    if (!necesitaTick) return;
    const id = setInterval(() => forzarTick((n) => n + 1), 2000);
    return () => clearInterval(id);
  }, [esperandoIntentoPropio, pedido?.pago]);

  function calcularEstado(): Estado {
    if (esperandoIntentoPropio) return "esperando";
    // El intento propio falló (sin_email/red): no importa qué diga el
    // pedido todavía -- nunca llegamos a intentarlo o no sabemos si llegó,
    // así que no hay nada que esperar del backend.
    if (intentoFallo) return "rechazado";
    if (!pedido) return "cargando";
    if (pedido.pago?.estado === "APPROVED") return "aprobado";
    if (pedido.pago?.estado === "PENDING") return "esperando";
    if (pedido.pago == null) {
      return dentroDeGraciaPago(pedido.created_at) ? "esperando" : "rechazado";
    }
    // DECLINED / ERROR / VOIDED / cualquier estado que este binario no conozca.
    return "rechazado";
  }
  const estado = calcularEstado();

  // pago_rechazado: una vez por episodio de rechazo, no en cada re-render.
  // Se resetea al salir de "rechazado" (reintento exitoso, o aprobado) para
  // que un SEGUNDO rechazo tras "Otra tarjeta" también quede contado -- cada
  // intento de cobro es un evento de negocio distinto, no el mismo.
  const rechazadoTrackeadoRef = useRef(false);
  useEffect(() => {
    if (estado !== "rechazado") {
      rechazadoTrackeadoRef.current = false;
      return;
    }
    if (rechazadoTrackeadoRef.current) return;
    rechazadoTrackeadoRef.current = true;
    const motivo = intentoFallo ?? pedido?.pago?.estado ?? "sin_intento";
    tracker.track("pago_rechazado", { pedido_id: pedidoId, motivo }, "checkout/confirmando-pago");
  }, [estado, intentoFallo, pedido?.pago?.estado, pedidoId]);

  // Aprobado: check breve (mismo patrón visual que metodos-pago/nueva.tsx al
  // guardar tarjeta) y de ahí al detalle -- que es donde queda la
  // confirmación PERSISTENTE (franja verde) y donde vive pago_aprobado (ver
  // el comentario en orders/[id].tsx sobre por qué no se duplica acá).
  const aprobadoNavegadoRef = useRef(false);
  useEffect(() => {
    if (estado !== "aprobado" || aprobadoNavegadoRef.current || !pedidoValido) return;
    aprobadoNavegadoRef.current = true;
    const id = setTimeout(() => {
      router.replace({ pathname: "/(tabs)/orders/[id]", params: { id: String(pedidoId) } });
    }, 900);
    return () => clearTimeout(id);
  }, [estado, pedidoId, pedidoValido, router]);

  // "Pagar contra entrega": único lugar que puede tomar esta decisión ahora
  // (antes también vivía en orders/[id].tsx). PATCH /pedidos/:id/medio-pago
  // solo permite caer A 'efectivo' -- el backend nunca acepta otro valor acá.
  const contraEntregaMutation = useMutation({
    mutationFn: () => cambiarMedioPagoAEfectivo(pedidoId),
    onSuccess: () => {
      tracker.track("pago_cambiado_a_contraentrega", { pedido_id: pedidoId, medio: "efectivo" }, "checkout/confirmando-pago");
      queryClient.invalidateQueries({ queryKey: ["pedido", pedidoId] });
      router.replace({ pathname: "/(tabs)/orders/[id]", params: { id: String(pedidoId) } });
    },
    onError: (err: Error) => {
      Sentry.captureException(err, { tags: { flow: "pago_tarjeta", action: "contraentrega" } });
      Toast.show({ type: "error", text1: "No se pudo cambiar el medio de pago", text2: err.message });
    },
  });

  if (!pedidoValido) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#fff", padding: 24 }}>
        <Text style={{ fontFamily: fuentes.destacado, fontSize: 15, color: colors.danger, textAlign: "center" }}>
          Pedido no encontrado
        </Text>
      </View>
    );
  }

  const demorado = !!pedido?.pago?.creado_at && Date.now() - new Date(pedido.pago.creado_at).getTime() > MS_PAGO_DEMORADO;

  return (
    <View style={{ flex: 1, backgroundColor: "#fff", paddingTop: insets.top, paddingBottom: insets.bottom }}>
      {(estado === "cargando" || estado === "esperando") && (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
          <ActivityIndicator size="large" color={colors.green} />
          <Text style={{ marginTop: 16, fontSize: 15, fontFamily: fuentes.destacado, color: colors.ink, textAlign: "center" }}>
            {demorado ? "Se está demorando más de lo normal" : "Confirmando tu pago…"}
          </Text>
          <Text style={{ marginTop: 6, fontSize: 12.5, fontFamily: fuentes.destacado, color: colors.muted, textAlign: "center" }}>
            {demorado ? "Puedes cerrar la app; te avisamos cuando esté listo." : "Estamos hablando con tu banco. No cierres la app."}
          </Text>
        </View>
      )}

      {estado === "aprobado" && (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.greenTint, alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
            <Feather name="check" size={36} color={colors.green} />
          </View>
          <Text style={{ fontSize: 17, fontFamily: fuentes.destacado, color: colors.ink }}>Pago aprobado</Text>
        </View>
      )}

      {estado === "rechazado" && (
        <View style={{ flex: 1, padding: 24, justifyContent: "center" }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: "rgba(220,38,38,0.1)", alignItems: "center", justifyContent: "center", marginBottom: 20, alignSelf: "center" }}>
            <Feather name="alert-circle" size={30} color={colors.danger} />
          </View>
          <Text style={{ fontSize: 19, fontFamily: fuentes.destacado, color: colors.ink, textAlign: "center", marginBottom: 10 }}>
            {intentoFallo === "sin_email" || pedido?.pago == null ? "No pudimos iniciar tu pago" : "Tu banco rechazó el pago"}
          </Text>
          <Text style={{ fontSize: 14.5, fontFamily: fuentes.destacado, color: colors.muted, textAlign: "center", marginBottom: 28, lineHeight: 21 }}>
            Tu pedido está guardado. Elige cómo pagar.
          </Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Pressable
              onPress={() => setHojaReintentarPago(true)}
              accessibilityRole="button"
              accessibilityLabel="Intentar con otra tarjeta"
              style={{ flex: 1, paddingVertical: 15, borderRadius: 16, alignItems: "center", backgroundColor: colors.green }}
            >
              <Text style={{ fontSize: 14, fontFamily: fuentes.destacado, color: "#fff" }}>Otra tarjeta</Text>
            </Pressable>
            <Pressable
              onPress={() => contraEntregaMutation.mutate()}
              disabled={contraEntregaMutation.isPending}
              accessibilityRole="button"
              accessibilityLabel="Pagar contra entrega"
              style={{ flex: 1, paddingVertical: 15, borderRadius: 16, alignItems: "center", borderWidth: 1.5, borderColor: colors.green }}
            >
              <Text style={{ fontSize: 14, fontFamily: fuentes.destacado, color: colors.green }}>
                {contraEntregaMutation.isPending ? "Cambiando…" : "Contra entrega"}
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      <HojaReintentarPago
        visible={hojaReintentarPago}
        pedidoId={pedidoId}
        monto={pedido?.total ?? (montoParam ? Number(montoParam) : 0)}
        onCerrar={() => setHojaReintentarPago(false)}
        onExito={() => {
          setHojaReintentarPago(false);
          // No hace falta resetear rechazadoTrackeadoRef a mano: en cuanto
          // el refetch traiga el pago nuevo en PENDING, `estado` deja de ser
          // "rechazado" y el efecto de arriba ya lo resetea solo.
          queryClient.invalidateQueries({ queryKey: ["pedido", pedidoId] });
          Toast.show({ type: "success", text1: "Cobrando…", text2: "Te avisamos apenas confirme el banco" });
        }}
      />
    </View>
  );
}
