import { View, Text } from "react-native";
import { formatTime } from "../lib/format";
import { colors } from "../constants/theme";
import type { Pedido } from "../lib/api";

const STEPS = [
  { key: "recibido", label: "Recibido", timeKey: "created_at" },
  { key: "en_preparacion", label: "En preparación", timeKey: "preparado_at" },
  { key: "en_camino", label: "En camino", timeKey: "despachado_at" },
  { key: "entregado", label: "Entregado", timeKey: "entregado_at" },
] as const;

const STEP_ORDER = ["recibido", "en_preparacion", "en_camino", "entregado"];

interface Props {
  estado: string;
  pedido: Pedido;
}

export function OrderStatusTimeline({ estado, pedido }: Props) {
  if (estado === "cancelado") {
    return (
      <View style={{ alignItems: "center", paddingVertical: 16 }}>
        <View style={{ width: 44, height: 44, borderRadius: 999, backgroundColor: "rgba(220,38,38,0.12)", alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
          <Text style={{ color: colors.danger, fontSize: 20, fontWeight: "800" }}>✕</Text>
        </View>
        <Text style={{ color: colors.danger, fontWeight: "700" }}>Pedido cancelado</Text>
      </View>
    );
  }

  const currentIndex = STEP_ORDER.indexOf(estado);

  return (
    <View style={{ paddingVertical: 4 }}>
      {STEPS.map((step, index) => {
        const done = index < currentIndex;
        const current = index === currentIndex;
        const timeValue = pedido[step.timeKey as keyof Pedido] as string | undefined;

        return (
          <View key={step.key} style={{ flexDirection: "row", alignItems: "flex-start" }}>
            {/* Columna del dot + riel */}
            <View style={{ alignItems: "center", marginRight: 12 }}>
              <View
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 999,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: done ? colors.green : current ? colors.surface : colors.lowfill,
                  borderWidth: current ? 2.5 : done ? 0 : 2,
                  borderColor: current ? colors.green : colors.line,
                  ...(current
                    ? { shadowColor: colors.green, shadowOpacity: 0.28, shadowRadius: 6, shadowOffset: { width: 0, height: 0 }, elevation: 4 }
                    : {}),
                }}
              >
                {done ? (
                  <Text style={{ color: "#fff", fontSize: 13, fontWeight: "900" }}>✓</Text>
                ) : current ? (
                  <View style={{ width: 9, height: 9, borderRadius: 999, backgroundColor: colors.green }} />
                ) : null}
              </View>
              {index < STEPS.length - 1 && (
                <View style={{ width: 2, height: 26, backgroundColor: done ? colors.green : colors.line }} />
              )}
            </View>

            {/* Etiqueta + hora */}
            <View style={{ flex: 1, paddingTop: 3, paddingBottom: 14 }}>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: current ? "800" : done ? "700" : "500",
                  color: current ? colors.greenInk : done ? colors.ink : colors.faint,
                }}
              >
                {step.label}
              </Text>
              {timeValue ? (
                <Text style={{ fontSize: 12, color: current ? colors.greenInk : colors.muted, marginTop: 1 }}>
                  {formatTime(timeValue)}{current ? " · ahora" : ""}
                </Text>
              ) : current ? (
                <Text style={{ fontSize: 12, color: colors.greenInk, marginTop: 1, fontWeight: "700" }}>ahora</Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}
