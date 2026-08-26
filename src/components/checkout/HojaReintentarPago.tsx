// Reintento de pago con tarjeta desde el detalle del pedido (fase 3,
// DECLINED/ERROR). Modal mínimo: lista de tarjetas guardadas + botón
// "Reintentar pago" — no reabre HojaMedioPago (vive en el carrito, atada a
// un pedido que ya no se está creando) ni duplica la máquina de estados 3DS
// de metodos-pago/nueva.tsx (aquí la tarjeta YA está guardada; solo se
// vuelve a llamar POST /pedidos/:id/pagar).

import { useEffect, useState } from "react";
import { View, Text, Pressable, Modal, ScrollView, ActivityIndicator, TextInput } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import * as Sentry from "@sentry/react-native";
import { colors, fuentes } from "../../constants/theme";
import { getMetodosPago, getTokensAceptacion, pagarPedido } from "../../lib/api";
import { useAuthStore } from "../../stores/auth";
import { tracker } from "../../lib/tracker";
import { FilaSeleccionable } from "./FilaSeleccionable";
import { LogoFranquicia } from "../LogoFranquicia";

const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Props {
  visible: boolean;
  pedidoId: number;
  monto: number;
  onCerrar: () => void;
  /** El pago se inició bien (202). El estado final (APPROVED/DECLINED) lo
   *  resuelve el polling del detalle, no este modal. */
  onExito: () => void;
}

export function HojaReintentarPago({ visible, pedidoId, monto, onCerrar, onExito }: Props) {
  const insets = useSafeAreaInsets();
  const cliente = useAuthStore((s) => s.cliente);
  const [seleccionado, setSeleccionado] = useState<number | null>(null);
  const [email, setEmail] = useState(cliente?.email ?? "");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setSeleccionado(null);
      setError(null);
    }
  }, [visible]);

  const { data: metodos, isLoading } = useQuery({
    queryKey: ["metodos-pago"],
    queryFn: getMetodosPago,
    enabled: visible,
  });

  // Cerrar sin haber cobrado (X, tocar fuera, o atrás) es abandono del
  // reintento — el pedido queda guardado, tal como estaba.
  const cerrar = () => {
    if (!enviando) {
      tracker.track("pago_abandonado", { pedido_id: pedidoId, segundos: 0, paso: "reintento" }, "orders/[id]");
    }
    onCerrar();
  };

  const reintentar = async () => {
    if (!seleccionado) {
      setError("Elige una tarjeta");
      return;
    }
    if (!REGEX_EMAIL.test(email.trim())) {
      setError("Correo inválido");
      return;
    }
    setError(null);
    setEnviando(true);
    try {
      const tokens = await getTokensAceptacion();
      await pagarPedido(pedidoId, {
        metodo_pago_id: seleccionado,
        customer_email: email.trim(),
        acceptance_token: tokens.acceptance_token ?? "",
        accept_personal_auth: tokens.accept_personal_auth ?? "",
      });
      tracker.track("pago_iniciado", { pedido_id: pedidoId, monto }, "orders/[id]");
      onExito();
    } catch (err) {
      Sentry.captureException(err instanceof Error ? err : new Error(String(err)), {
        tags: { flow: "pago_tarjeta", action: "reintentar" },
      });
      setError("No se pudo iniciar el cobro. Intenta de nuevo.");
    } finally {
      setEnviando(false);
    }
  };

  const sinTarjetas = (metodos?.length ?? 0) === 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={cerrar}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)" }} onPress={cerrar} />
      <View
        style={{
          backgroundColor: "#fff",
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          paddingTop: 20,
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 20,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
          <Text style={{ flex: 1, fontSize: 19, fontFamily: fuentes.destacado, color: "#1A1C1A" }}>
            Intentar con otra tarjeta
          </Text>
          <Pressable onPress={cerrar} accessibilityRole="button" accessibilityLabel="Cerrar" hitSlop={10}>
            <Feather name="x" size={22} color="#6D7B6C" />
          </Pressable>
        </View>

        <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
          <View style={{ gap: 8 }}>
            {isLoading ? (
              <ActivityIndicator color={colors.green} style={{ marginVertical: 20 }} />
            ) : sinTarjetas ? (
              <Text style={{ fontFamily: fuentes.destacado, fontSize: 14, color: colors.muted, textAlign: "center", paddingVertical: 20 }}>
                No tienes tarjetas guardadas.
              </Text>
            ) : (
              metodos!.map((m) => (
                <FilaSeleccionable
                  key={m.id}
                  seleccionado={seleccionado === m.id}
                  onPress={() => setSeleccionado(m.id)}
                  iconoNode={<LogoFranquicia brand={m.brand} size={32} />}
                  titulo={`•••• ${m.last_four}`}
                  subtitulo={`Vence ${m.exp_month}/${m.exp_year}`}
                  badges={m.predeterminada ? [{ texto: "PREDETERMINADA" }] : undefined}
                  a11yLabel={`Pagar con tarjeta terminada en ${m.last_four}`}
                />
              ))
            )}

            {!cliente?.email && !sinTarjetas && (
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="Correo para el comprobante de pago"
                keyboardType="email-address"
                autoCapitalize="none"
                style={{
                  borderWidth: 1,
                  borderColor: colors.line,
                  borderRadius: 12,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  fontFamily: fuentes.destacado,
                  fontSize: 14,
                  color: colors.ink,
                  marginTop: 4,
                }}
              />
            )}

            {error && (
              <Text style={{ color: colors.danger, fontSize: 12.5, fontFamily: fuentes.destacado }}>{error}</Text>
            )}
          </View>
        </ScrollView>

        <Pressable
          onPress={reintentar}
          disabled={enviando || sinTarjetas}
          accessibilityRole="button"
          accessibilityLabel="Reintentar pago"
          style={{
            marginTop: 16,
            paddingVertical: 15,
            borderRadius: 16,
            alignItems: "center",
            backgroundColor: enviando || sinTarjetas ? colors.faint : colors.green,
          }}
        >
          <Text style={{ fontSize: 15, fontFamily: fuentes.destacado, color: "#fff" }}>
            {enviando ? "Cobrando…" : "Reintentar pago"}
          </Text>
        </Pressable>
      </View>
    </Modal>
  );
}
