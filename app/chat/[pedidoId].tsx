/**
 * Chat del pedido — pantalla dedicada, estilo WhatsApp simplificado.
 *
 * Antes el hilo vivía como una sección plegable dentro del detalle del pedido;
 * el dueño pidió (16-ago-2026) una pantalla propia: cabecera con el avatar y el
 * nombre del domiciliario, burbujas, y el campo de escribir fijo abajo.
 *
 * EL AVATAR ESTÁ LISTO PARA ENVÍOS EXPRESS: hoy pinta las iniciales del
 * domiciliario (su nombre llega en cada mensaje como `autor_staff_nombre`);
 * cuando la app de repartidores suba fotos de perfil (`autor_foto_url`), la
 * misma cabecera la mostrará sin tocar nada más aquí.
 *
 * Sondeo incremental cada 5 s (desde el último id): la base de usuarios tiene
 * planes de datos contados. El servidor decide visible/escribible en cada
 * respuesta — esta pantalla nunca inventa permisos.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Toast from "react-native-toast-message";
import { getMensajesPedido, enviarMensajePedido, type MensajePedido } from "../../src/lib/api";
import { nuevoUuidV4 } from "../../src/lib/uuid";
import { tracker } from "../../src/lib/tracker";
import { colors, fuentes } from "../../src/constants/theme";

const INTERVALO_MS = 5000;

function hora(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Bogota",
  });
}

function iniciales(nombre: string): string {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export default function ChatPedidoScreen() {
  // `v=1` llega desde la tarjeta de entrada, que solo se muestra con el pedido
  // en la calle: la pantalla arranca ASUMIENDO hilo visible y escribible en vez
  // de un spinner a pantalla completa mientras responde el primer sondeo (se
  // sentia como que el chat "tardaba en cargar"). El servidor corrige en la
  // primera respuesta si la suposicion era vieja.
  const { pedidoId: pedidoIdParam, n, v } = useLocalSearchParams<{ pedidoId: string; n?: string; v?: string }>();
  const pedidoId = Number(pedidoIdParam);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const optimista = v === "1";
  const [mensajes, setMensajes] = useState<MensajePedido[]>([]);
  const [visible, setVisible] = useState<boolean | null>(optimista ? true : null); // null = cargando
  const [escribible, setEscribible] = useState(optimista);
  const [motivoCierre, setMotivoCierre] = useState<string | null>(null);
  const [contraparte, setContraparte] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const ultimoId = useRef(0);
  const yaMedido = useRef(false);
  const scrollRef = useRef<ScrollView>(null);
  // Llave de idempotencia del envio EN CURSO (073): se genera al primer intento
  // y se conserva si fallo — reintentar el mismo texto reusa el mismo UUID y el
  // servidor no crea una segunda fila. Se limpia solo al exito.
  const envioUuidRef = useRef<string | null>(null);

  const sondear = useCallback(async () => {
    try {
      const r = await getMensajesPedido(pedidoId, ultimoId.current);
      setVisible(r.visible);
      setEscribible(r.escribible);
      setMotivoCierre(r.motivo);
      setContraparte(r.contraparte ?? null);
      if (r.mensajes.length > 0) {
        ultimoId.current = Math.max(ultimoId.current, r.mensajes[r.mensajes.length - 1].id);
        // Dedupe por id: un sondeo que ya estaba en vuelo cuando se ENVIO un
        // mensaje lo trae de nuevo (su `desde` era viejo) y lo duplicaba.
        setMensajes((previos) => {
          const vistos = new Set(previos.map((m) => m.id));
          const nuevos = r.mensajes.filter((m) => !vistos.has(m.id));
          return nuevos.length > 0 ? [...previos, ...nuevos] : previos;
        });
      }
    } catch {
      // 503 con la bandera apagada, o sin conexión: se muestra el estado vacío
      // amable, no un error rojo.
      setVisible(false);
    }
  }, [pedidoId]);

  useEffect(() => {
    if (!Number.isFinite(pedidoId) || pedidoId <= 0) return;
    sondear();
    const t = setInterval(sondear, INTERVALO_MS);
    return () => clearInterval(t);
  }, [sondear, pedidoId]);

  useEffect(() => {
    if (visible !== true || yaMedido.current) return;
    yaMedido.current = true;
    tracker.track("chat_abierto", { pedido_id: pedidoId }, "chat/[pedidoId]");
  }, [visible, pedidoId]);

  // Al fondo con cada mensaje nuevo, como cualquier chat.
  useEffect(() => {
    if (mensajes.length === 0) return;
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(t);
  }, [mensajes.length]);

  async function enviar() {
    const cuerpo = texto.trim();
    if (!cuerpo || enviando) return;
    setEnviando(true);
    if (!envioUuidRef.current) envioUuidRef.current = nuevoUuidV4();
    try {
      const m = await enviarMensajePedido(pedidoId, cuerpo, envioUuidRef.current);
      envioUuidRef.current = null;
      ultimoId.current = Math.max(ultimoId.current, m.id);
      setMensajes((previos) => (previos.some((x) => x.id === m.id) ? previos : [...previos, m]));
      setTexto("");
      // Solo el LARGO, nunca el contenido: lo que se hable de una entrega no
      // tiene por qué salir del teléfono dentro de un evento de analítica.
      tracker.track("chat_mensaje_enviado", { pedido_id: pedidoId, largo: cuerpo.length }, "chat/[pedidoId]");
    } catch (err) {
      Toast.show({ type: "error", text1: (err as Error).message });
    } finally {
      setEnviando(false);
    }
  }

  // Nombre y (futura) foto del domiciliario: salen del último mensaje del staff.
  const ultimoStaff = [...mensajes].reverse().find((m) => m.autor_tipo === "staff");
  const nombreDomiciliario = ultimoStaff?.autor_staff_nombre ?? null;
  const fotoDomiciliario = ultimoStaff?.autor_foto_url ?? null;
  // Antes del despacho contesta el mostrador; despues, quien lleva el pedido.
  // El nombre del staff solo se muestra cuando la contraparte es el
  // domiciliario: en la etapa del estanco, quien atiende puede ir cambiando y
  // ponerle la cara de un cajero a "el estanco" confunde mas de lo que ayuda.
  const esEstanco = contraparte !== "domiciliario";
  const titulo = esEstanco ? "Estanco Caquetá Express" : (nombreDomiciliario ?? "Tu domiciliario");
  const subtitulo = n
    ? `Pedido #${n}`
    : esEstanco ? "Estamos alistando tu pedido" : "Tu pedido en camino";

  return (
    <View style={{ flex: 1, backgroundColor: "#ECE9E2" }}>
      {/* Cabecera estilo WhatsApp: avatar + nombre + pedido */}
      <View
        style={{
          backgroundColor: colors.green,
          paddingTop: insets.top + 6,
          paddingBottom: 12,
          paddingHorizontal: 12,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
        }}
      >
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/orders"))}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Volver al pedido"
        >
          <Feather name="chevron-left" size={26} color="#fff" />
        </Pressable>

        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 999,
            backgroundColor: "rgba(255,255,255,0.25)",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          {esEstanco ? (
            <Feather name="home" size={20} color="#fff" />
          ) : fotoDomiciliario ? (
            <Image source={{ uri: fotoDomiciliario }} style={{ width: 40, height: 40 }} contentFit="cover" />
          ) : nombreDomiciliario ? (
            <Text style={{ color: "#fff", fontFamily: fuentes.destacado, fontSize: 15 }}>{iniciales(nombreDomiciliario)}</Text>
          ) : (
            <Feather name="user" size={20} color="#fff" />
          )}
        </View>

        <View style={{ flex: 1 }}>
          <Text style={{ color: "#fff", fontFamily: fuentes.destacado, fontSize: 16 }} numberOfLines={1}>
            {titulo}
          </Text>
          <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 12 }}>
            {subtitulo}
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Hilo */}
        {visible === null ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator color={colors.green} />
          </View>
        ) : visible === false ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32 }}>
            <Feather name="message-circle" size={40} color="#B9B4A8" />
            <Text style={{ color: "#6D7B6C", textAlign: "center", marginTop: 12, fontSize: 14 }}>
              {motivoCierre === "pedido_cerrado"
                ? "Este pedido ya fue entregado — el chat se cerró."
                : "El chat se abre cuando tu pedido salga a entrega."}
            </Text>
          </View>
        ) : (
          <ScrollView
            ref={scrollRef}
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 14, gap: 6 }}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
          >
            {mensajes.length === 0 ? (
              <View style={{ alignItems: "center", marginTop: 24 }}>
                <View style={{ backgroundColor: "rgba(31,175,85,0.12)", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8 }}>
                  <Text style={{ color: "#166534", fontSize: 12.5, textAlign: "center" }}>
                    Acuérdale dónde es, o dile con quién dejar el pedido.
                  </Text>
                </View>
              </View>
            ) : (
              mensajes.map((m) => {
                const mio = m.autor_tipo === "cliente";
                return (
                  <View key={m.id} style={{ alignItems: mio ? "flex-end" : "flex-start" }}>
                    <View
                      style={{
                        maxWidth: "80%",
                        backgroundColor: mio ? "#D2F5DE" : "#fff",
                        borderRadius: 14,
                        borderTopRightRadius: mio ? 4 : 14,
                        borderTopLeftRadius: mio ? 14 : 4,
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        shadowColor: "#000",
                        shadowOpacity: 0.06,
                        shadowRadius: 2,
                        shadowOffset: { width: 0, height: 1 },
                        elevation: 1,
                      }}
                    >
                      <Text style={{ fontSize: 14.5, color: "#1A1C1A", lineHeight: 20 }}>{m.cuerpo}</Text>
                      <Text style={{ fontSize: 10.5, color: "#8B948B", marginTop: 2, alignSelf: "flex-end" }}>
                        {hora(m.created_at)}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
        )}

        {/* Barra de escribir, o el aviso de solo lectura */}
        {visible === true && (
          escribible ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "flex-end",
                gap: 8,
                paddingHorizontal: 10,
                paddingTop: 8,
                paddingBottom: Math.max(insets.bottom, 10),
                backgroundColor: "#F4F2EC",
              }}
            >
              <TextInput
                value={texto}
                onChangeText={setTexto}
                placeholder="Escribe un mensaje…"
                placeholderTextColor="#9E9E9E"
                multiline
                maxLength={1000}
                style={{
                  flex: 1,
                  backgroundColor: "#fff",
                  borderRadius: 22,
                  paddingHorizontal: 16,
                  paddingTop: 10,
                  paddingBottom: 10,
                  fontSize: 14.5,
                  maxHeight: 110,
                  color: "#1A1C1A",
                }}
                accessibilityLabel="Mensaje para tu domiciliario"
              />
              <Pressable
                onPress={enviar}
                disabled={enviando || !texto.trim()}
                accessibilityRole="button"
                accessibilityLabel="Enviar mensaje"
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: texto.trim() ? colors.green : "#C6CEC6",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {enviando ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Feather name="send" size={18} color="#fff" />
                )}
              </Pressable>
            </View>
          ) : (
            <View style={{ padding: 12, paddingBottom: Math.max(insets.bottom, 12), backgroundColor: "#F4F2EC" }}>
              <Text style={{ textAlign: "center", fontSize: 12.5, color: "#6D7B6C" }}>
                El pedido se entregó. El chat queda como constancia de lo acordado.
              </Text>
            </View>
          )
        )}
      </KeyboardAvoidingView>
    </View>
  );
}
