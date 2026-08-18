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
import { colors, radii, shadows } from "../../src/constants/theme";

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

  const handleCopiar = async (cupon: CuponDisponible) => {
    await Clipboard.setStringAsync(cupon.codigo);
    tracker.track('cupon_copiado', { cupon_id: cupon.id }, 'cupones');
    Toast.show({ type: "success", text1: "Código copiado", text2: cupon.codigo, visibilityTime: 1500 });
  };

  const activos = cupones.filter((c) => !c.ya_usado);
  const usados = cupones.filter((c) => c.ya_usado);

  return (
    <View className="flex-1" style={{ backgroundColor: colors.bg }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", paddingTop: insets.top + 12, paddingBottom: 16, paddingHorizontal: 16, backgroundColor: colors.bg, borderBottomWidth: 1, borderBottomColor: colors.line }}>
        <BackButton style={{ paddingRight: 16 }} />
        <Text style={{ flex: 1, fontSize: 17, fontWeight: "800", color: colors.ink, textAlign: "center", marginRight: 60 }}>
          Cupones
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={!isLoading && isFetching} onRefresh={refetch} />}
      >
        {isError ? (
          <View className="items-center py-16">
            <Feather name="alert-circle" size={40} color={colors.faint} />
            <Text style={{ fontSize: 16, fontWeight: "600", color: colors.muted, marginTop: 12 }}>No pudimos cargar los cupones</Text>
            <Pressable
              onPress={() => refetch()}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Reintentar la carga de los cupones"
              style={{ marginTop: 12, paddingHorizontal: 24, paddingVertical: 10, backgroundColor: colors.green, borderRadius: radii.pill }}
            >
              <Text style={{ color: "#fff", fontWeight: "600" }}>Reintentar</Text>
            </Pressable>
          </View>
        ) : isLoading ? (
          <Text style={{ color: colors.faint, textAlign: "center", marginTop: 32 }}>Cargando cupones...</Text>
        ) : cupones.length === 0 ? (
          <View className="items-center py-16">
            <Feather name="tag" size={40} color={colors.faint} />
            <Text style={{ fontSize: 16, fontWeight: "600", color: colors.muted, marginTop: 12 }}>No hay cupones disponibles</Text>
            <Text style={{ fontSize: 13, color: colors.faint, marginTop: 4, textAlign: "center" }}>
              Sigue comprando para recibir descuentos exclusivos
            </Text>
          </View>
        ) : (
          <>
            {activos.length > 0 && (
              <>
                <Text style={{ fontSize: 12, fontWeight: "900", color: colors.faint, textTransform: "uppercase", letterSpacing: 2 }}>
                  Disponibles ({activos.length})
                </Text>
                {activos.map((c) => (
                  <CuponCard key={c.id} cupon={c} onCopiar={handleCopiar} />
                ))}
              </>
            )}

            {usados.length > 0 && (
              <>
                <Text style={{ fontSize: 12, fontWeight: "900", color: colors.faint, textTransform: "uppercase", letterSpacing: 2, marginTop: 8 }}>
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

function CuponCard({ cupon, onCopiar, usado }: { cupon: CuponDisponible; onCopiar: (c: CuponDisponible) => void; usado?: boolean }) {
  const expires = cupon.expires_at ? new Date(cupon.expires_at) : null;
  const diasRestantes = expires ? Math.ceil((expires.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;

  return (
    <View style={{
      backgroundColor: colors.surface,
      borderRadius: radii.card,
      overflow: "hidden",
      opacity: usado ? 0.6 : 1,
      ...shadows.card,
    }}>
      {/* Franja izquierda */}
      <View style={{ flexDirection: "row" }}>
        <View style={{ width: 6, backgroundColor: usado ? colors.faint : colors.offer }} />
        <View style={{ flex: 1, padding: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            {/* Código */}
            <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: colors.lowfill, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, gap: 8 }}>
              <Text style={{ fontSize: 15, fontWeight: "800", color: colors.ink, letterSpacing: 2, fontVariant: ["tabular-nums"] }}>
                {cupon.codigo}
              </Text>
              {!usado && (
                <Pressable
                  onPress={() => onCopiar(cupon)}
                  hitSlop={15}
                  accessibilityRole="button"
                  accessibilityLabel={`Copiar el cupón ${cupon.codigo}, ${getCuponLabel(cupon)}`}
                >
                  <Feather name="copy" size={14} color={colors.muted} />
                </Pressable>
              )}
            </View>

            {/* Valor */}
            <View style={{ backgroundColor: usado ? colors.lowfill : "rgba(240,101,63,0.1)", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
              <Text style={{ fontSize: 14, fontWeight: "800", color: usado ? colors.faint : colors.offer }}>
                {getCuponLabel(cupon)}
              </Text>
            </View>
          </View>

          {cupon.descripcion ? (
            <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 6 }}>{cupon.descripcion}</Text>
          ) : null}

          <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
            {Number(cupon.min_pedido) > 0 && (
              <Text style={{ fontSize: 12, color: colors.faint }}>
                Pedido mín. {formatCOP(cupon.min_pedido)}
              </Text>
            )}
            {diasRestantes !== null && (
              <Text style={{ fontSize: 12, color: diasRestantes <= 3 ? colors.offer : colors.faint }}>
                {diasRestantes === 1 ? "Vence hoy" : `Vence en ${diasRestantes} días`}
              </Text>
            )}
            {usado && (
              <Text style={{ fontSize: 12, color: colors.faint, fontStyle: "italic" }}>Ya utilizado</Text>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}
