import { useEffect, useRef, useState } from "react";
import { View, Text, ScrollView, Pressable, Modal } from "react-native";
import { Stack, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import * as Sentry from "@sentry/react-native";
import Toast from "react-native-toast-message";
import { BackButton } from "../../src/components/BackButton";
import { LogoFranquicia } from "../../src/components/LogoFranquicia";
import { colors, radii, shadows, fuentes } from "../../src/constants/theme";
import {
  getConfigApp,
  getMetodosPago,
  eliminarMetodoPago,
  marcarMetodoPredeterminado,
  type MetodoPago,
} from "../../src/lib/api";
import { MEDIOS_PAGO_RESPALDO, ICONOS_MEDIO, ICONO_MEDIO_GENERICO } from "../../src/constants/config";
import { formatDateDDMMYYYY } from "../../src/lib/format";
import { tracker } from "../../src/lib/tracker";
import { modoPruebasActivo } from "../../src/lib/backendPruebas";

// Ventana de aviso de validity_ends_at (093/100 · plan de pago con tarjeta).
// Decisión abierta #3 del plan: propuesta 30 días, sin resolver todavía por
// el usuario — se deja como constante nombrada para que cambiarla sea un
// número, no una búsqueda por el archivo.
const DIAS_AVISO_CADUCIDAD = 30;

function diasHasta(fechaISO: string): number {
  const ms = new Date(fechaISO).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

/** Hoja de acciones de una tarjeta guardada. Mismo molde que HojaCancelar.tsx
 *  (Modal transparent animationType="slide") — no se reutiliza ese componente
 *  porque es específico de motivos de cancelación de pedido. */
function HojaAccionesTarjeta({
  visible,
  metodo,
  onCerrar,
  onPredeterminada,
  onEliminar,
  marcandoPredeterminada,
}: {
  visible: boolean;
  metodo: MetodoPago | null;
  onCerrar: () => void;
  onPredeterminada: () => void;
  onEliminar: () => void;
  marcandoPredeterminada: boolean;
}) {
  const insets = useSafeAreaInsets();
  const [confirmandoEliminar, setConfirmandoEliminar] = useState(false);

  const cerrar = () => {
    setConfirmandoEliminar(false);
    onCerrar();
  };

  if (!metodo) return null;

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
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16, gap: 12 }}>
          <LogoFranquicia brand={metodo.brand} size={36} />
          <Text style={{ flex: 1, fontSize: 17, fontFamily: fuentes.destacado, color: colors.ink }}>
            •••• {metodo.last_four}
          </Text>
          <Pressable onPress={cerrar} accessibilityRole="button" accessibilityLabel="Cerrar" hitSlop={10}>
            <Feather name="x" size={22} color={colors.muted} />
          </Pressable>
        </View>

        {!confirmandoEliminar ? (
          <>
            {!metodo.predeterminada && (
              <Pressable
                onPress={onPredeterminada}
                disabled={marcandoPredeterminada}
                accessibilityRole="button"
                style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14 }}
              >
                <Feather name="star" size={19} color={colors.ink} />
                <Text style={{ fontSize: 15.5, fontFamily: fuentes.destacado, color: colors.ink }}>
                  {marcandoPredeterminada ? "Marcando…" : "Usar como predeterminada"}
                </Text>
              </Pressable>
            )}
            <Pressable
              onPress={() => setConfirmandoEliminar(true)}
              accessibilityRole="button"
              style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14 }}
            >
              <Feather name="trash-2" size={19} color={colors.danger} />
              <Text style={{ fontSize: 15.5, fontFamily: fuentes.destacado, color: colors.danger }}>
                Eliminar tarjeta
              </Text>
            </Pressable>
          </>
        ) : (
          <View>
            <Text style={{ fontSize: 14.5, fontFamily: fuentes.destacado, color: colors.muted, marginBottom: 16, lineHeight: 20 }}>
              Vas a eliminar la tarjeta que termina en {metodo.last_four}. Tendrás que volver a
              guardarla si quieres usarla otra vez.
            </Text>
            <Pressable
              onPress={onEliminar}
              accessibilityRole="button"
              accessibilityLabel="Confirmar eliminación de la tarjeta"
              style={{ paddingVertical: 16, borderRadius: 16, alignItems: "center", backgroundColor: colors.danger, marginBottom: 8 }}
            >
              <Text style={{ fontSize: 15.5, fontFamily: fuentes.destacado, color: "#fff" }}>
                Sí, eliminar
              </Text>
            </Pressable>
            <Pressable onPress={() => setConfirmandoEliminar(false)} style={{ paddingVertical: 12, alignItems: "center" }} accessibilityRole="button">
              <Text style={{ fontSize: 14.5, color: colors.muted, fontFamily: fuentes.destacado }}>Mejor no</Text>
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  );
}

export default function MetodosPagoScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [hojaMetodo, setHojaMetodo] = useState<MetodoPago | null>(null);

  // Mismo queryKey que cart.tsx y las demás: comparten caché.
  const { data: configApp } = useQuery({
    queryKey: ["config-app"],
    queryFn: getConfigApp,
    staleTime: 5 * 60 * 1000,
  });
  // Antes esta pantalla tenía su propio catálogo (093 lo generaliza): el
  // servidor manda la lista vigente, y esto cae al respaldo local solo
  // mientras arranca o si el backend no responde.
  const medios = configApp?.medios_pago ?? MEDIOS_PAGO_RESPALDO;
  // No hay un booleano `pago_tarjeta_activo` propio en /configuracion-app: el
  // backend ya filtra 'tarjeta' de `medios_pago` por la bandera Y el umbral
  // de versión (C-2/C-3 del plan), así que su sola presencia en la lista ES
  // la señal — duplicar la condición aquí sería confiar en dos fuentes que
  // podrían desincronizarse.
  const pagoTarjetaActivo = medios.some((m) => m.codigo === "tarjeta");

  // Clave NUEVA a propósito: ["config-app"] es compartida por ~10 pantallas
  // con staleTime de 5 min, y una tarjeta recién guardada/eliminada tiene que
  // verse de inmediato, no en 5 minutos.
  const { data: metodos, isLoading: cargandoMetodos } = useQuery({
    queryKey: ["metodos-pago"],
    queryFn: getMetodosPago,
    enabled: pagoTarjetaActivo,
  });

  const vacioTrackeadoRef = useRef(false);
  useEffect(() => {
    if (!pagoTarjetaActivo || cargandoMetodos || vacioTrackeadoRef.current) return;
    if ((metodos?.length ?? 0) === 0) {
      vacioTrackeadoRef.current = true;
      tracker.track("metodos_pago_vacio_visto", { origen: "perfil" }, "profile/metodos-pago");
    }
  }, [pagoTarjetaActivo, cargandoMetodos, metodos]);

  const predeterminadaMutation = useMutation({
    mutationFn: (id: number) => marcarMetodoPredeterminado(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["metodos-pago"] });
      setHojaMetodo(null);
    },
    onError: (err: Error) => {
      Sentry.captureException(err, { tags: { flow: "pago_tarjeta", action: "predeterminada" } });
      Toast.show({ type: "error", text1: "No se pudo cambiar la predeterminada", text2: err.message });
    },
  });

  const eliminarMutation = useMutation({
    mutationFn: (id: number) => eliminarMetodoPago(id),
    onSuccess: () => {
      // La fila desaparece solo si Wompi confirmó el void (eliminarMetodoPago
      // lanza si el backend respondió error) — nunca se borra optimista.
      tracker.track("tarjeta_eliminada", { motivo_disponible: false }, "profile/metodos-pago");
      queryClient.invalidateQueries({ queryKey: ["metodos-pago"] });
      setHojaMetodo(null);
      Toast.show({ type: "success", text1: "Tarjeta eliminada" });
    },
    onError: (err: Error) => {
      // Si Wompi no pudo anular la fuente, la fila NO desaparece (mismo
      // criterio que DELETE /pagos/metodos/:id en el backend): dejarla ir del
      // lado nuestro y no del de Wompi es exactamente cómo se cobra una
      // tarjeta que el cliente cree eliminada.
      Sentry.captureException(err, { tags: { flow: "pago_tarjeta", action: "eliminar" } });
      Toast.show({ type: "error", text1: "No se pudo eliminar", text2: err.message });
    },
  });

  return (
    <View className="flex-1" style={{ backgroundColor: colors.bg }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", paddingTop: insets.top + 12, paddingBottom: 16, paddingHorizontal: 16, backgroundColor: colors.bg, borderBottomWidth: 1, borderBottomColor: colors.line }}>
        <BackButton style={{ paddingRight: 16 }} />
        <Text style={{ flex: 1, fontSize: 17, fontFamily: fuentes.destacado, color: colors.ink, textAlign: "center", marginRight: 60 }}>
          Métodos de Pago
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
        <View style={{ backgroundColor: colors.ink, borderRadius: radii.card, padding: 20, marginBottom: 4 }}>
          {pagoTarjetaActivo ? (
            <>
              <Text style={{ fontSize: 12, fontFamily: fuentes.destacado, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: 2, marginBottom: 8 }}>
                Cómo pagar
              </Text>
              <Text style={{ fontSize: 16, fontFamily: fuentes.destacado, color: "#fff", lineHeight: 22 }}>
                Paga con tu tarjeta al confirmar, o contra entrega cuando llegue tu pedido.
              </Text>
            </>
          ) : (
            <>
              <Text style={{ fontSize: 12, fontFamily: fuentes.destacado, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: 2, marginBottom: 8 }}>
                Todo contra entrega
              </Text>
              <Text style={{ fontSize: 16, fontFamily: fuentes.destacado, color: "#fff", lineHeight: 22 }}>
                Paga cuando recibas tu pedido. No manejamos pagos anticipados.
              </Text>
            </>
          )}
        </View>

        {pagoTarjetaActivo && (
          <View style={{ gap: 12 }}>
            <Text style={{ fontSize: 13, fontFamily: fuentes.destacado, color: colors.muted, textTransform: "uppercase", letterSpacing: 1 }}>
              Mis tarjetas
            </Text>

            {(metodos?.length ?? 0) === 0 ? (
              <View style={{ backgroundColor: colors.surface, borderRadius: radii.card, padding: 24, alignItems: "center", ...shadows.card }}>
                <Feather name="credit-card" size={48} color="#BCCABA" style={{ marginBottom: 10 }} />
                <Text style={{ fontSize: 20, fontFamily: fuentes.titulo, color: "#6D7B6C", marginBottom: 6, textAlign: "center" }}>
                  Aún no tienes tarjetas
                </Text>
                <Text style={{ color: "#BCCABA", textAlign: "center", fontFamily: fuentes.destacado, fontSize: 14, marginBottom: 18 }}>
                  Guarda una y paga en un toque la próxima vez
                </Text>
                <Pressable
                  onPress={() => {
                    tracker.track("tarjeta_guardado_iniciado", { origen: "perfil" }, "profile/metodos-pago");
                    router.push("/profile/metodos-pago/nueva?origen=perfil");
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Agregar tarjeta"
                  style={{ paddingVertical: 15, paddingHorizontal: 28, borderRadius: 16, backgroundColor: colors.green }}
                >
                  <Text style={{ fontSize: 15, fontFamily: fuentes.destacado, color: "#fff" }}>Agregar tarjeta</Text>
                </Pressable>
              </View>
            ) : (
              <>
                {metodos!.map((m) => {
                  const diasRestantes = m.validity_ends_at ? diasHasta(m.validity_ends_at) : null;
                  const porCaducar = diasRestantes !== null && diasRestantes <= DIAS_AVISO_CADUCIDAD && diasRestantes > 0;
                  const yaCaducada = diasRestantes !== null && diasRestantes <= 0;
                  return (
                    <View
                      key={m.id}
                      style={{ backgroundColor: colors.surface, borderRadius: radii.card, padding: 16, ...shadows.card, opacity: yaCaducada ? 0.55 : 1 }}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                        <LogoFranquicia brand={m.brand} size={44} />
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                            <Text style={{ fontSize: 15, fontFamily: fuentes.destacado, color: colors.ink }}>
                              •••• {m.last_four}
                            </Text>
                            {m.predeterminada && (
                              <View style={{ borderRadius: radii.pill, backgroundColor: colors.greenTint, paddingHorizontal: 8, paddingVertical: 3 }}>
                                <Text style={{ fontSize: 10, fontFamily: fuentes.destacado, color: colors.greenInk, textTransform: "uppercase", letterSpacing: 1 }}>
                                  Predeterminada
                                </Text>
                              </View>
                            )}
                            {modoPruebasActivo() && (
                              <View style={{ borderRadius: radii.pill, backgroundColor: "rgba(228,164,0,0.12)", paddingHorizontal: 8, paddingVertical: 3 }}>
                                <Text style={{ fontSize: 10, fontFamily: fuentes.destacado, color: colors.amber, textTransform: "uppercase", letterSpacing: 1 }}>
                                  Prueba
                                </Text>
                              </View>
                            )}
                          </View>
                          <Text style={{ fontFamily: fuentes.destacado, fontSize: 13, color: colors.muted }}>
                            Vence {m.exp_month}/{m.exp_year}
                          </Text>
                        </View>
                        <Pressable
                          onPress={() => setHojaMetodo(m)}
                          accessibilityRole="button"
                          accessibilityLabel={`Más acciones para la tarjeta terminada en ${m.last_four}`}
                          hitSlop={10}
                        >
                          <Feather name="more-vertical" size={20} color={colors.muted} />
                        </Pressable>
                      </View>

                      {porCaducar && m.validity_ends_at && (
                        <View style={{ backgroundColor: "rgba(228,164,0,0.12)", borderRadius: 12, padding: 12, marginTop: 12 }}>
                          <Text style={{ fontFamily: fuentes.destacado, fontSize: 12.5, color: "#8A6400", lineHeight: 18 }}>
                            Vas a tener que volver a guardar esta tarjeta antes del{" "}
                            {formatDateDDMMYYYY(m.validity_ends_at)}.
                          </Text>
                        </View>
                      )}
                      {yaCaducada && (
                        <View style={{ marginTop: 12 }}>
                          <Text style={{ fontFamily: fuentes.destacado, fontSize: 12.5, color: colors.danger, lineHeight: 18, marginBottom: 6 }}>
                            Esta tarjeta ya no sirve. Guárdala de nuevo.
                          </Text>
                          <Pressable
                            onPress={() => router.push("/profile/metodos-pago/nueva?origen=perfil")}
                            accessibilityRole="button"
                          >
                            <Text style={{ fontFamily: fuentes.destacado, fontSize: 13, color: colors.green }}>
                              Guardar tarjeta de nuevo
                            </Text>
                          </Pressable>
                        </View>
                      )}
                    </View>
                  );
                })}

                <Pressable
                  onPress={() => {
                    tracker.track("tarjeta_guardado_iniciado", { origen: "perfil" }, "profile/metodos-pago");
                    router.push("/profile/metodos-pago/nueva?origen=perfil");
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Agregar otra tarjeta"
                  style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12 }}
                >
                  <Feather name="plus-circle" size={18} color={colors.green} />
                  <Text style={{ fontSize: 14, fontFamily: fuentes.destacado, color: colors.green }}>Agregar otra tarjeta</Text>
                </Pressable>
              </>
            )}
          </View>
        )}

        {medios.map((m) => {
          const icono = ICONOS_MEDIO[m.codigo] ?? ICONO_MEDIO_GENERICO;
          return (
            <View key={m.codigo} style={{ backgroundColor: colors.surface, borderRadius: radii.card, padding: 20, flexDirection: "row", alignItems: "flex-start", gap: 16, ...shadows.card }}>
              <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: icono.bg, alignItems: "center", justifyContent: "center" }}>
                <Feather name={icono.icon} size={20} color={icono.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontFamily: fuentes.destacado, color: colors.ink, marginBottom: 4 }}>{m.etiqueta}</Text>
                <Text style={{ fontFamily: fuentes.destacado, fontSize: 13, color: colors.muted, lineHeight: 19 }}>{m.descripcion}</Text>
              </View>
            </View>
          );
        })}

        <View style={{ backgroundColor: colors.lowfill, borderRadius: 12, padding: 16, marginTop: 8 }}>
          <Text style={{ fontFamily: fuentes.destacado, fontSize: 12, color: colors.muted, textAlign: "center", lineHeight: 18 }}>
            ¿Preguntas sobre tu pago? Escríbenos por WhatsApp y te ayudamos de inmediato.
          </Text>
        </View>
      </ScrollView>

      <HojaAccionesTarjeta
        visible={hojaMetodo !== null}
        metodo={hojaMetodo}
        onCerrar={() => setHojaMetodo(null)}
        marcandoPredeterminada={predeterminadaMutation.isPending}
        onPredeterminada={() => hojaMetodo && predeterminadaMutation.mutate(hojaMetodo.id)}
        onEliminar={() => hojaMetodo && eliminarMutation.mutate(hojaMetodo.id)}
      />
    </View>
  );
}
