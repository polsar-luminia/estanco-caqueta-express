// Pantalla de preferencias de notificaciones y comunicaciones.
// Operativas (pedido recibido/en camino/entregado) NO se pueden desactivar
// porque son transaccionales del pedido — switch fijo en true con explicacion.
//
// Encima de las categorias hay un interruptor MAESTRO: la autorizacion de
// mercadeo. Existe aparte de los cuatro switches porque estos solo gobiernan el
// push, y la publicidad tambien sale por WhatsApp. Revocar tiene que cortar los
// dos canales de una vez, y ademas dejar constancia de cuando se revoco — eso lo
// hace el endpoint, que escribe la evidencia y el reflejo en la misma transaccion.

import { useEffect, useState } from "react";
import { View, Text, ScrollView, Switch, ActivityIndicator, Pressable } from "react-native";
import { Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { Feather } from "@expo/vector-icons";
import { BackButton } from "../../src/components/BackButton";
import { apiFetch, getConsentimiento, actualizarConsentimientoMercadeo } from "../../src/lib/api";
import { tracker } from "../../src/lib/tracker";
import { colors, radii, shadows, fuentes } from "../../src/constants/theme";

interface Preferencias {
  operativas: boolean;
  marketing_ofertas: boolean;
  marketing_carrito_abandonado: boolean;
  marketing_re_engagement: boolean;
  marketing_time_based: boolean;
}

type PrefKey = keyof Omit<Preferencias, "operativas">;

const ITEMS: { key: PrefKey; titulo: string; descripcion: string }[] = [
  {
    key: "marketing_ofertas",
    titulo: "Ofertas nuevas",
    descripcion: "Te avisamos cuando publiquemos una oferta nueva en el catalogo.",
  },
  {
    key: "marketing_carrito_abandonado",
    titulo: "Carrito pendiente",
    descripcion: "Recordatorio si dejas productos en el carrito sin completar la compra.",
  },
  {
    key: "marketing_re_engagement",
    titulo: "Te extranamos",
    descripcion: "Maximo una vez al mes, si no has pedido en mas de dos semanas.",
  },
  {
    key: "marketing_time_based",
    titulo: "Recordatorios de fin de semana",
    descripcion: "Viernes en la noche y sabado en la tarde.",
  },
];

export default function NotificacionesScreen() {
  const insets = useSafeAreaInsets();
  const [prefs, setPrefs] = useState<Preferencias | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<PrefKey | null>(null);
  const [fetchKey, setFetchKey] = useState(0);
  // `null` = nunca se le pregunto (clientes anteriores a esta pantalla). Se
  // distingue de `false` a proposito: uno no autorizo, al otro no le preguntaron.
  const [mercadeo, setMercadeo] = useState<boolean | null>(null);
  const [guardandoMercadeo, setGuardandoMercadeo] = useState(false);

  useEffect(() => {
    let cancelado = false;
    setLoading(true);
    setPrefs(null);
    (async () => {
      try {
        const [data, cons] = await Promise.all([
          apiFetch<Preferencias>("/notificaciones/preferencias"),
          getConsentimiento().catch(() => null),
        ]);
        if (!cancelado) {
          setPrefs(data);
          setMercadeo(cons?.consentimiento?.mercadeo?.otorgado ?? null);
        }
      } catch (err) {
        Toast.show({
          type: "error",
          text1: "No se pudieron cargar las preferencias",
          text2: err instanceof Error ? err.message : undefined,
        });
      } finally {
        if (!cancelado) setLoading(false);
      }
    })();
    return () => { cancelado = true; };
  }, [fetchKey]);

  // El maestro no es optimista: se espera la respuesta antes de mover el switch.
  // Mostrar "revocado" cuando el guardado fallo seria la peor mentira posible aca
  // — el cliente creeria que corto la publicidad y le seguiria llegando.
  const toggleMercadeo = async (value: boolean) => {
    setGuardandoMercadeo(true);
    try {
      await actualizarConsentimientoMercadeo(value);
      setMercadeo(value);
      // Al revocar se apagan las cuatro categorias; al autorizar se encienden.
      setPrefs((p) => p && {
        ...p,
        marketing_ofertas: value,
        marketing_carrito_abandonado: value,
        marketing_re_engagement: value,
        marketing_time_based: value,
      });
      tracker.track('consentimiento_mercadeo_cambiado', { otorgado: value, origen: 'perfil' }, 'profile/notificaciones');
      Toast.show({
        type: "success",
        text1: value ? "Listo, te avisamos de las ofertas" : "No te enviaremos mas publicidad",
        text2: value ? undefined : "Seguiras recibiendo el estado de tus pedidos.",
      });
    } catch (err) {
      Toast.show({
        type: "error",
        text1: "No se pudo guardar",
        text2: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setGuardandoMercadeo(false);
    }
  };

  const togglePref = async (key: PrefKey, value: boolean) => {
    if (!prefs) return;
    const optimista = { ...prefs, [key]: value };
    setPrefs(optimista);
    setSaving(key);
    try {
      const updated = await apiFetch<Preferencias>("/notificaciones/preferencias", {
        method: "PUT",
        body: JSON.stringify({ [key]: value }),
      });
      setPrefs(updated);
    } catch (err) {
      // Rollback
      setPrefs(curr => curr ? { ...curr, [key]: !value } : curr);
      Toast.show({
        type: "error",
        text1: "No se pudo guardar",
        text2: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSaving(null);
    }
  };

  return (
    <View className="flex-1" style={{ backgroundColor: colors.bg }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", paddingTop: insets.top + 12, paddingBottom: 16, paddingHorizontal: 16, backgroundColor: colors.bg, borderBottomWidth: 1, borderBottomColor: colors.line }}>
        <BackButton style={{ paddingRight: 16 }} />
        <Text style={{ flex: 1, fontSize: 16, fontFamily: fuentes.destacado, color: colors.ink, textAlign: "center", marginRight: 44 }}>
          Notificaciones y comunicaciones
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}>
        {loading ? (
          <View style={{ alignItems: "center", paddingVertical: 48 }}>
            <ActivityIndicator color={colors.green} />
          </View>
        ) : !prefs ? (
          <View style={{ alignItems: "center", paddingVertical: 48, gap: 16 }}>
            <Text style={{ fontFamily: fuentes.destacado, fontSize: 14, color: colors.muted, textAlign: "center" }}>
              No pudimos cargar tus preferencias
            </Text>
            <Pressable
              onPress={() => setFetchKey((k) => k + 1)}
              hitSlop={4}
              accessibilityRole="button"
              accessibilityLabel="Reintentar la carga de mis preferencias de notificaciones"
              style={{ backgroundColor: colors.green, paddingHorizontal: 24, paddingVertical: 12, borderRadius: radii.pill }}
            >
              <Text style={{ color: "#fff", fontFamily: fuentes.destacado, fontSize: 14 }}>Reintentar</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* Operativas — no se pueden desactivar */}
            <View>
              <Text style={{ fontSize: 12, fontFamily: fuentes.destacado, color: colors.faint, textTransform: "uppercase", letterSpacing: 2, marginBottom: 8 }}>
                Tus pedidos
              </Text>
              <View style={{ backgroundColor: colors.surface, borderRadius: radii.card, padding: 16, flexDirection: "row", alignItems: "center", gap: 12, ...shadows.card }}>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(31,175,85,0.12)", alignItems: "center", justifyContent: "center" }}>
                  <Feather name="package" size={18} color={colors.green} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontFamily: fuentes.destacado, color: colors.ink }}>
                    Estado de tus pedidos
                  </Text>
                  <Text style={{ fontFamily: fuentes.destacado, fontSize: 12, color: colors.muted, marginTop: 2 }}>
                    Recibido, despachado, cuando el domiciliario llega y entregado. Estas son transaccionales y no se pueden desactivar.
                  </Text>
                </View>
                <Switch
                  value
                  disabled
                  accessibilityLabel="Estado de tus pedidos"
                  accessibilityHint="Estas notificaciones son transaccionales y no se pueden desactivar"
                  trackColor={{ false: colors.line, true: colors.green }}
                  thumbColor="#fff"
                />
              </View>
            </View>

            {/* Autorizacion de mercadeo — maestro de los dos canales */}
            <View>
              <Text style={{ fontSize: 12, fontFamily: fuentes.destacado, color: colors.faint, textTransform: "uppercase", letterSpacing: 2, marginBottom: 8 }}>
                Publicidad
              </Text>
              <View style={{ backgroundColor: colors.surface, borderRadius: radii.card, padding: 16, ...shadows.card }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(211,53,135,0.12)", alignItems: "center", justifyContent: "center" }}>
                    <Feather name="message-circle" size={18} color={colors.pink} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontFamily: fuentes.destacado, color: colors.ink }}>
                      Ofertas y promociones
                    </Text>
                    <Text style={{ fontFamily: fuentes.destacado, fontSize: 12, color: colors.muted, marginTop: 2 }}>
                      Por WhatsApp y por notificaciones. Es opcional: apagarlo no afecta tus pedidos.
                    </Text>
                  </View>
                  {guardandoMercadeo ? (
                    <ActivityIndicator color={colors.green} />
                  ) : (
                    <Switch
                      value={mercadeo === true}
                      onValueChange={toggleMercadeo}
                      accessibilityLabel="Recibir ofertas y promociones por WhatsApp y notificaciones"
                      trackColor={{ false: colors.line, true: colors.green }}
                      thumbColor="#fff"
                    />
                  )}
                </View>

                {/* Nunca se le pregunto: se pide, no se asume. */}
                {mercadeo === null && (
                  <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 0.5, borderTopColor: colors.line }}>
                    <Text style={{ fontFamily: fuentes.destacado, fontSize: 12, color: colors.muted, lineHeight: 17 }}>
                      Todavia no nos has dicho si quieres recibir ofertas. Activalo si quieres
                      enterarte de las promociones; si lo dejas apagado, no te escribiremos.
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Categorias de push — solo aplican si autorizo el mercadeo */}
            <View style={{ opacity: mercadeo === true ? 1 : 0.45 }}>
              <Text style={{ fontSize: 12, fontFamily: fuentes.destacado, color: colors.faint, textTransform: "uppercase", letterSpacing: 2, marginBottom: 8 }}>
                Que notificaciones quieres
              </Text>
              <View style={{ backgroundColor: colors.surface, borderRadius: radii.card, overflow: "hidden", ...shadows.card }}>
                {ITEMS.map((item, idx) => (
                  <View
                    key={item.key}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                      padding: 16,
                      borderBottomWidth: idx === ITEMS.length - 1 ? 0 : 0.5,
                      borderBottomColor: colors.line,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontFamily: fuentes.destacado, color: colors.ink }}>
                        {item.titulo}
                      </Text>
                      <Text style={{ fontFamily: fuentes.destacado, fontSize: 12, color: colors.muted, marginTop: 2 }}>
                        {item.descripcion}
                      </Text>
                    </View>
                    {saving === item.key ? (
                      <ActivityIndicator color={colors.green} />
                    ) : (
                      <Switch
                        value={mercadeo === true && !!prefs?.[item.key]}
                        disabled={mercadeo !== true}
                        onValueChange={(v) => togglePref(item.key, v)}
                        // Sin esto el lector anuncia "interruptor, activado" sin
                        // decir de cual de los cuatro se trata.
                        accessibilityLabel={item.titulo}
                        trackColor={{ false: colors.line, true: colors.green }}
                        thumbColor="#fff"
                      />
                    )}
                  </View>
                ))}
              </View>
            </View>

            <Text style={{ fontFamily: fuentes.destacado, fontSize: 12, color: colors.faint, textAlign: "center", marginTop: 8, paddingHorizontal: 16 }}>
              Maximo 2 mensajes promocionales por semana. Puedes cambiar esto cuando quieras, y el estado de tus pedidos te llega siempre.
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}
