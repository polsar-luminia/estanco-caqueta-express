import { View, Text, Pressable, ScrollView, RefreshControl } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Stack } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { BackButton } from "../../src/components/BackButton";
import { apiFetch } from "../../src/lib/api";
import { tracker } from "../../src/lib/tracker";
import { formatCOP } from "../../src/lib/format";

interface CuponDisponible {
  id: number;
  codigo: string;
  descripcion: string;
  tipo: "porcentaje" | "fijo";
  valor: number;
  min_pedido: number;
  expires_at: string | null;
  ya_usado: boolean;
}

function getCuponLabel(c: CuponDisponible) {
  return c.tipo === "porcentaje" ? `${c.valor}% de descuento` : `${formatCOP(c.valor)} de descuento`;
}

export default function CuponesScreen() {
  const insets = useSafeAreaInsets();
  const { data: cupones = [], isLoading, isError, isFetching, refetch } = useQuery<CuponDisponible[]>({
    queryKey: ["cupones-disponibles"],
    queryFn: () => apiFetch("/cupones/disponibles"),
  });

  const handleCopiar = async (codigo: string) => {
    await Clipboard.setStringAsync(codigo);
    tracker.track('cupon_copiado', { cupon_codigo: codigo }, 'cupones');
    Toast.show({ type: "success", text1: "Código copiado", text2: codigo, visibilityTime: 1500 });
  };

  const activos = cupones.filter((c) => !c.ya_usado);
  const usados = cupones.filter((c) => c.ya_usado);

  return (
    <View className="flex-1" style={{ backgroundColor: "#FAFAF6" }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", paddingTop: insets.top + 12, paddingBottom: 16, paddingHorizontal: 16, backgroundColor: "#FAFAF6", borderBottomWidth: 1, borderBottomColor: "#EFEFEB" }}>
        <BackButton style={{ paddingRight: 16 }} />
        <Text style={{ flex: 1, fontSize: 17, fontWeight: "800", color: "#1A1C1A", textAlign: "center", marginRight: 60 }}>
          Cupones
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={!isLoading && isFetching} onRefresh={refetch} />}
      >
        {isError ? (
          <View className="items-center py-16">
            <Feather name="alert-circle" size={40} color="#D1D5DB" />
            <Text style={{ fontSize: 16, fontWeight: "600", color: "#6D7B6C", marginTop: 12 }}>No pudimos cargar los cupones</Text>
            <Pressable onPress={() => refetch()} style={{ marginTop: 12, paddingHorizontal: 24, paddingVertical: 10, backgroundColor: "#1FAF55", borderRadius: 999 }}>
              <Text style={{ color: "#fff", fontWeight: "600" }}>Reintentar</Text>
            </Pressable>
          </View>
        ) : isLoading ? (
          <Text style={{ color: "#9E9E9E", textAlign: "center", marginTop: 32 }}>Cargando cupones...</Text>
        ) : cupones.length === 0 ? (
          <View className="items-center py-16">
            <Feather name="tag" size={40} color="#D1D5DB" />
            <Text style={{ fontSize: 16, fontWeight: "600", color: "#6D7B6C", marginTop: 12 }}>No hay cupones disponibles</Text>
            <Text style={{ fontSize: 13, color: "#9E9E9E", marginTop: 4, textAlign: "center" }}>
              Sigue comprando para recibir descuentos exclusivos
            </Text>
          </View>
        ) : (
          <>
            {activos.length > 0 && (
              <>
                <Text style={{ fontSize: 10, fontWeight: "900", color: "#9E9E9E", textTransform: "uppercase", letterSpacing: 2 }}>
                  Disponibles ({activos.length})
                </Text>
                {activos.map((c) => (
                  <CuponCard key={c.id} cupon={c} onCopiar={handleCopiar} />
                ))}
              </>
            )}

            {usados.length > 0 && (
              <>
                <Text style={{ fontSize: 10, fontWeight: "900", color: "#9E9E9E", textTransform: "uppercase", letterSpacing: 2, marginTop: 8 }}>
                  Ya usados ({usados.length})
                </Text>
                {usados.map((c) => (
                  <CuponCard key={c.id} cupon={c} onCopiar={handleCopiar} usado />
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function CuponCard({ cupon, onCopiar, usado }: { cupon: CuponDisponible; onCopiar: (c: string) => void; usado?: boolean }) {
  const expires = cupon.expires_at ? new Date(cupon.expires_at) : null;
  const diasRestantes = expires ? Math.ceil((expires.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;

  return (
    <View style={{
      backgroundColor: "#fff",
      borderRadius: 16,
      overflow: "hidden",
      opacity: usado ? 0.6 : 1,
      borderWidth: 1,
      borderColor: usado ? "#E5E7EB" : "#F4F4F0",
    }}>
      {/* Franja izquierda */}
      <View style={{ flexDirection: "row" }}>
        <View style={{ width: 6, backgroundColor: usado ? "#D1D5DB" : "#D33587" }} />
        <View style={{ flex: 1, padding: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            {/* Código */}
            <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#F4F4F0", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, gap: 8 }}>
              <Text style={{ fontSize: 15, fontWeight: "800", color: "#1A1C1A", letterSpacing: 2, fontVariant: ["tabular-nums"] }}>
                {cupon.codigo}
              </Text>
              {!usado && (
                <Pressable onPress={() => onCopiar(cupon.codigo)}>
                  <Feather name="copy" size={14} color="#6D7B6C" />
                </Pressable>
              )}
            </View>

            {/* Valor */}
            <View style={{ backgroundColor: usado ? "#F4F4F0" : "rgba(211,53,135,0.1)", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
              <Text style={{ fontSize: 14, fontWeight: "800", color: usado ? "#9E9E9E" : "#D33587" }}>
                {getCuponLabel(cupon)}
              </Text>
            </View>
          </View>

          {cupon.descripcion ? (
            <Text style={{ fontSize: 13, color: "#6D7B6C", marginBottom: 6 }}>{cupon.descripcion}</Text>
          ) : null}

          <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
            {Number(cupon.min_pedido) > 0 && (
              <Text style={{ fontSize: 11, color: "#9E9E9E" }}>
                Pedido mín. {formatCOP(cupon.min_pedido)}
              </Text>
            )}
            {diasRestantes !== null && (
              <Text style={{ fontSize: 11, color: diasRestantes <= 3 ? "#D33587" : "#9E9E9E" }}>
                {diasRestantes === 1 ? "Vence hoy" : `Vence en ${diasRestantes} días`}
              </Text>
            )}
            {usado && (
              <Text style={{ fontSize: 11, color: "#9E9E9E", fontStyle: "italic" }}>Ya utilizado</Text>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}
