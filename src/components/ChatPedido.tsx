// Chat con el domiciliario, lado CLIENTE (bloque 5 de la app de operaciones).
//
// LO QUE DECIDE SI SE VE ES EL SERVIDOR, no esta pantalla. `lib/chat.js` del
// backend responde `visible` y `escribible`, y las mismas reglas las usa la app
// de operaciones. Si cada app decidiera por su cuenta, una dejaría escribir en
// un pedido ya entregado y la otra no, y el cliente vería mensajes que nadie
// recibe.
//
// La regla, en corto: el hilo se abre cuando el pedido va **en camino** y se
// cierra a solo lectura al entregarse o cancelarse. Antes de que el pedido salga
// no hay nada que preguntar sobre la entrega, y el cliente escribiéndole al vacío
// es peor que no tener chat.
//
// No se exige que haya domiciliario asignado: en producción ningún pedido lo
// tiene todavía (los estados los mueve el admin desde la web), así que exigirlo
// habría dejado el chat sin abrirse nunca. Sin domiciliario, el mensaje le llega
// al admin — que es quien de hecho está atendiendo el pedido.

import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator } from "react-native";
import Toast from "react-native-toast-message";
import {
  getMensajesPedido,
  enviarMensajePedido,
  type MensajePedido,
} from "../lib/api";
import { tracker } from "../lib/tracker";
import { CARD_SHADOW } from "../constants/styles";

const INTERVALO_MS = 5000;

function hora(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Bogota",
  });
}

interface Props {
  pedidoId: number;
  /** Estado del pedido. Solo se sondea mientras puede haber conversación. */
  estado: string;
  /** Llega del deep link `?chat=1` del push: abre el hilo desplegado. */
  abrirAlEntrar?: boolean;
}

export function ChatPedido({ pedidoId, estado, abrirAlEntrar = false }: Props) {
  const [mensajes, setMensajes] = useState<MensajePedido[]>([]);
  const [visible, setVisible] = useState(false);
  const [escribible, setEscribible] = useState(false);
  const [motivo, setMotivo] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [abierto, setAbierto] = useState(abrirAlEntrar);
  const ultimoId = useRef(0);
  const yaMedido = useRef(false);

  // Solo se consulta cuando el hilo puede existir. Sondear el chat de un pedido
  // entregado hace tres semanas es gastar batería para recibir siempre lo mismo.
  const vivo = estado === "en_camino";

  const sondear = useCallback(async () => {
    try {
      const r = await getMensajesPedido(pedidoId, ultimoId.current);
      setVisible(r.visible);
      setEscribible(r.escribible);
      setMotivo(r.motivo);
      if (r.mensajes.length > 0) {
        ultimoId.current = r.mensajes[r.mensajes.length - 1].id;
        setMensajes((previos) => [...previos, ...r.mensajes]);
      }
    } catch {
      // 503 con la bandera apagada, o sin conexión. En los dos casos la sección
      // simplemente no se pinta: un error rojo aquí asusta sin motivo.
      setVisible(false);
    }
  }, [pedidoId]);

  useEffect(() => {
    if (!vivo) return;
    sondear();
    const t = setInterval(sondear, INTERVALO_MS);
    return () => clearInterval(t);
  }, [sondear, vivo]);

  useEffect(() => {
    if (!visible || yaMedido.current) return;
    yaMedido.current = true;
    tracker.track("chat_abierto", { pedido_id: pedidoId }, "orders/[id]");
  }, [visible, pedidoId]);

  async function enviar() {
    const cuerpo = texto.trim();
    if (!cuerpo) return;
    setEnviando(true);
    try {
      const m = await enviarMensajePedido(pedidoId, cuerpo);
      ultimoId.current = m.id;
      setMensajes((previos) => [...previos, m]);
      setTexto("");
      // Solo el LARGO, nunca el contenido: lo que se hable de una entrega no
      // tiene por qué salir del teléfono dentro de un evento de analítica.
      tracker.track("chat_mensaje_enviado", { pedido_id: pedidoId, largo: cuerpo.length }, "orders/[id]");
    } catch (err) {
      Toast.show({ type: "error", text1: (err as Error).message });
    } finally {
      setEnviando(false);
    }
  }

  if (!visible) return null;

  return (
    <View className="bg-white rounded-2xl p-6" style={CARD_SHADOW}>
      <Pressable
        onPress={() => setAbierto((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={abierto ? "Cerrar el chat" : "Abrir el chat con el domiciliario"}
        style={{ minHeight: 44, justifyContent: "center" }}
      >
        <View className="flex-row justify-between items-center">
          <Text className="text-base font-bold text-on-surface">
            Escríbele al domiciliario
          </Text>
          <Text className="text-sm text-gray-500">{abierto ? "Ocultar" : "Abrir"}</Text>
        </View>
      </Pressable>

      {abierto && (
        <View style={{ marginTop: 12, gap: 8 }}>
          {mensajes.length === 0 ? (
            <Text className="text-sm text-gray-500">
              Aquí puedes decirle cómo llegar o dónde dejarte el pedido.
            </Text>
          ) : (
            mensajes.map((m) => {
              const mio = m.autor_tipo === "cliente";
              return (
                <View
                  key={m.id}
                  style={{
                    maxWidth: "85%",
                    alignSelf: mio ? "flex-end" : "flex-start",
                    backgroundColor: mio ? "#1FAF55" : "#F1F3F5",
                    borderRadius: 14,
                    padding: 10,
                  }}
                >
                  {!mio && (
                    <Text className="text-[11px] font-bold text-gray-500">
                      {m.autor_staff_nombre ?? "Estanco"}
                    </Text>
                  )}
                  <Text style={{ fontSize: 15, color: mio ? "#fff" : "#111418" }}>{m.cuerpo}</Text>
                  <Text
                    style={{
                      fontSize: 10,
                      alignSelf: "flex-end",
                      color: mio ? "rgba(255,255,255,0.8)" : "#8A94A6",
                    }}
                  >
                    {hora(m.created_at)}
                  </Text>
                </View>
              );
            })
          )}

          {escribible ? (
            <View className="flex-row items-end" style={{ gap: 8, marginTop: 4 }}>
              <TextInput
                value={texto}
                onChangeText={setTexto}
                placeholder="Escribe un mensaje"
                placeholderTextColor="#8A94A6"
                multiline
                maxLength={1000}
                accessibilityLabel="Mensaje para el domiciliario"
                style={{
                  flex: 1,
                  minHeight: 48,
                  maxHeight: 110,
                  borderWidth: 1,
                  borderColor: "#E2E5EA",
                  borderRadius: 14,
                  paddingHorizontal: 12,
                  paddingTop: 12,
                  fontSize: 15,
                  color: "#111418",
                }}
              />
              <Pressable
                onPress={enviar}
                disabled={enviando}
                accessibilityRole="button"
                accessibilityLabel="Enviar mensaje"
                style={{
                  minHeight: 48,
                  minWidth: 88,
                  borderRadius: 14,
                  backgroundColor: "#1FAF55",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: enviando ? 0.5 : 1,
                }}
              >
                {enviando ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{ color: "#fff", fontWeight: "800" }}>Enviar</Text>
                )}
              </Pressable>
            </View>
          ) : (
            <Text className="text-sm text-gray-500">
              {motivo === "pedido_cerrado"
                ? "Este pedido ya se cerró. Si necesitas algo, escríbenos por WhatsApp."
                : "Podrás escribirle cuando tu pedido salga."}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}
