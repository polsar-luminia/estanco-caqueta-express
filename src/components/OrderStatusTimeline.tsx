import { View, Text } from "react-native";
import { formatTime } from "../lib/format";
import { colors } from "../constants/theme";
import type { Pedido } from "../lib/api";

// Los cuatro pasos clasicos van siempre. Los dos de la 068 (preparado, llego)
// son OPCIONALES: solo se pintan si ocurrieron (tienen timestamp o son el
// estado actual). Con la bandera del servidor apagada nunca aparecen, y un
// pedido viejo no muestra pasos que jamas paso.
type Step = { key: string; label: string; timeKey: keyof Pedido };

function stepsDelPedido(estado: string, pedido: Pedido, extendidos: boolean): Step[] {
  const steps: Step[] = [
    { key: "recibido", label: "Recibido", timeKey: "created_at" },
    { key: "en_preparacion", label: "En preparación", timeKey: "preparado_at" },
  ];
  // Con la bandera del servidor prendida (estados_extendidos_activo, viaja en
  // /configuracion-app) los 6 pasos se muestran desde el arranque: el cliente
  // ve el camino completo que le espera. Sin bandera, los dos pasos nuevos solo
  // aparecen si ocurrieron — un pedido de la operación clásica no muestra pasos
  // por los que jamás va a pasar.
  if (extendidos || pedido.listo_at || estado === "preparado") {
    steps.push({ key: "preparado", label: "Preparado", timeKey: "listo_at" });
  }
  steps.push({ key: "en_camino", label: "Despachado", timeKey: "despachado_at" });
  if (extendidos || pedido.llego_at || estado === "domiciliario_llego") {
    steps.push({ key: "domiciliario_llego", label: "Tu domiciliario llegó", timeKey: "llego_at" });
  }
  steps.push({ key: "entregado", label: "Entregado", timeKey: "entregado_at" });
  return steps;
}

interface Props {
  estado: string;
  pedido: Pedido;
  estadosExtendidos?: boolean;
}

export function OrderStatusTimeline({ estado, pedido, estadosExtendidos = false }: Props) {
  // Entrega fallida (077). Va en lugar del timeline y no como un paso mas,
  // porque no es un avance: el pedido volvio atras. Pintarlo dentro de la
  // escalera lo dejaria "en curso" en un paso que no existe — que es justo lo
  // que pasaba antes: el cliente veia "Tu domiciliario llegó" para siempre, con
  // la tarjeta del domiciliario ya desaparecida y sin ninguna explicacion.
  //
  // El texto NO menciona el motivo. Los mas frecuentes son "el cliente no
  // estaba" y "no tenia con que pagar", y esta pantalla no es donde se discute
  // eso. Dice que paso con el pedido y que sigue, que es lo que el cliente
  // necesita para no quedarse esperando.
  if (estado === "no_entregado") {
    return (
      <View style={{ alignItems: "center", paddingVertical: 16 }}>
        <View style={{ width: 44, height: 44, borderRadius: 999, backgroundColor: "rgba(180,83,9,0.12)", alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
          <Text style={{ color: "#B45309", fontSize: 20, fontWeight: "800" }}>!</Text>
        </View>
        <Text style={{ color: "#B45309", fontWeight: "700" }}>No pudimos entregarlo</Text>
        <Text style={{ color: colors.muted, fontSize: 13, marginTop: 6, textAlign: "center", paddingHorizontal: 12, lineHeight: 18 }}>
          Tu pedido volvió al estanco. Te contactamos para reprogramar la entrega — también puedes
          escribirnos por el chat de abajo.
        </Text>
      </View>
    );
  }

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

  const STEPS = stepsDelPedido(estado, pedido, estadosExtendidos);
  let currentIndex = STEPS.findIndex((s) => s.key === estado);
  if (currentIndex === -1) {
    // Estado que este binario no conoce: se resuelve por el ULTIMO paso con
    // timestamp. Antes de esto, un estado nuevo dejaba el timeline entero gris
    // como si el pedido no hubiera avanzado nada.
    for (let i = STEPS.length - 1; i >= 0; i--) {
      if (pedido[STEPS[i].timeKey]) { currentIndex = i; break; }
    }
  }

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
