// Pantalla de preferencias de notificaciones push.
// Operativas (pedido recibido/en camino/entregado) NO se pueden desactivar
// porque son transaccionales del pedido — switch fijo en true con explicacion.
// Marketing: el cliente decide categoria por categoria.

import { useEffect, useState } from "react";
import { View, Text, ScrollView, Switch, ActivityIndicator, Pressable } from "react-native";
import { Stack } from "expo-router";
import Toast from "react-native-toast-message";
import { Feather } from "@expo/vector-icons";
import { BackButton } from "../../src/components/BackButton";
import { apiFetch } from "../../src/lib/api";

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
  const [prefs, setPrefs] = useState<Preferencias | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<PrefKey | null>(null);
  const [fetchKey, setFetchKey] = useState(0);

  useEffect(() => {
    let cancelado = false;
    setLoading(true);
    setPrefs(null);
    (async () => {
      try {
        const data = await apiFetch<Preferencias>("/notificaciones/preferencias");
        if (!cancelado) setPrefs(data);
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
      setPrefs(prefs);
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
    <View className="flex-1" style={{ backgroundColor: "#FAFAF6" }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", paddingTop: 56, paddingBottom: 16, paddingHorizontal: 16, backgroundColor: "#FAFAF6", borderBottomWidth: 1, borderBottomColor: "#EFEFEB" }}>
        <BackButton style={{ paddingRight: 16 }} />
        <Text style={{ flex: 1, fontSize: 17, fontWeight: "800", color: "#1A1C1A", textAlign: "center", marginRight: 60 }}>
          Notificaciones
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}>
        {loading ? (
          <View style={{ alignItems: "center", paddingVertical: 48 }}>
            <ActivityIndicator color="#1FAF55" />
          </View>
        ) : !prefs ? (
          <View style={{ alignItems: "center", paddingVertical: 48, gap: 16 }}>
            <Text style={{ fontSize: 14, color: "#6D7B6C", textAlign: "center" }}>
              No pudimos cargar tus preferencias
            </Text>
            <Pressable
              onPress={() => setFetchKey((k) => k + 1)}
              style={{ backgroundColor: "#1FAF55", paddingHorizontal: 24, paddingVertical: 12, borderRadius: 999 }}
            >
              <Text style={{ color: "#fff", fontWeight: "600", fontSize: 14 }}>Reintentar</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* Operativas — no se pueden desactivar */}
            <View>
              <Text style={{ fontSize: 10, fontWeight: "900", color: "#9E9E9E", textTransform: "uppercase", letterSpacing: 2, marginBottom: 8 }}>
                Tus pedidos
              </Text>
              <View style={{ backgroundColor: "#fff", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#F4F4F0", flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(31,175,85,0.12)", alignItems: "center", justifyContent: "center" }}>
                  <Feather name="package" size={18} color="#1FAF55" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: "#1A1C1A" }}>
                    Estado de tus pedidos
                  </Text>
                  <Text style={{ fontSize: 12, color: "#6D7B6C", marginTop: 2 }}>
                    Recibido, en camino, entregado. Estas son transaccionales y no se pueden desactivar.
                  </Text>
                </View>
                <Switch
                  value
                  disabled
                  trackColor={{ false: "#E5E5E5", true: "#1FAF55" }}
                  thumbColor="#fff"
                />
              </View>
            </View>

            {/* Marketing */}
            <View>
              <Text style={{ fontSize: 10, fontWeight: "900", color: "#9E9E9E", textTransform: "uppercase", letterSpacing: 2, marginBottom: 8 }}>
                Promociones y avisos
              </Text>
              <View style={{ backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: "#F4F4F0", overflow: "hidden" }}>
                {ITEMS.map((item, idx) => (
                  <View
                    key={item.key}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                      padding: 16,
                      borderBottomWidth: idx === ITEMS.length - 1 ? 0 : 0.5,
                      borderBottomColor: "#F4F4F0",
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: "700", color: "#1A1C1A" }}>
                        {item.titulo}
                      </Text>
                      <Text style={{ fontSize: 12, color: "#6D7B6C", marginTop: 2 }}>
                        {item.descripcion}
                      </Text>
                    </View>
                    {saving === item.key ? (
                      <ActivityIndicator color="#1FAF55" />
                    ) : (
                      <Switch
                        value={prefs ? prefs[item.key] : true}
                        onValueChange={(v) => togglePref(item.key, v)}
                        trackColor={{ false: "#E5E5E5", true: "#1FAF55" }}
                        thumbColor="#fff"
                      />
                    )}
                  </View>
                ))}
              </View>
            </View>

            <Text style={{ fontSize: 11, color: "#9E9E9E", textAlign: "center", marginTop: 8, paddingHorizontal: 16 }}>
              Maximo 2 mensajes promocionales por semana. Puedes cambiar tus preferencias cuando quieras.
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}
