import { View, Text } from "react-native";
import { formatTime } from "../lib/format";
import type { Pedido } from "../lib/api";

const STEPS = [
  { key: "recibido", label: "Recibido", timeKey: "created_at" },
  { key: "en_preparacion", label: "En preparacion", timeKey: "preparado_at" },
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
      <View className="items-center py-4">
        <View className="w-10 h-10 rounded-full bg-red-100 items-center justify-center mb-2">
          <Text className="text-red-600 text-lg">X</Text>
        </View>
        <Text className="text-red-600 font-semibold">Pedido cancelado</Text>
      </View>
    );
  }

  const currentIndex = STEP_ORDER.indexOf(estado);

  return (
    <View className="py-2">
      {STEPS.map((step, index) => {
        const isCompleted = index <= currentIndex;
        const isCurrent = index === currentIndex;
        const timeValue = pedido[step.timeKey as keyof Pedido] as string | undefined;

        return (
          <View key={step.key} className="flex-row items-start mb-4">
            <View className="items-center mr-3">
              <View
                className={`w-8 h-8 rounded-full items-center justify-center ${
                  isCompleted ? "bg-brand-700" : "bg-gray-200"
                }`}
              >
                <Text
                  className={`text-sm font-bold ${
                    isCompleted ? "text-white" : "text-gray-400"
                  }`}
                >
                  {isCompleted ? "\u2713" : index + 1}
                </Text>
              </View>
              {index < STEPS.length - 1 && (
                <View
                  className={`w-0.5 h-6 ${
                    index < currentIndex ? "bg-brand-700" : "bg-gray-200"
                  }`}
                />
              )}
            </View>
            <View className="flex-1 pt-1">
              <Text
                className={`text-sm ${
                  isCurrent
                    ? "font-bold text-brand-800"
                    : isCompleted
                    ? "font-medium text-gray-800"
                    : "text-gray-400"
                }`}
              >
                {step.label}
              </Text>
              {timeValue && (
                <Text className="text-xs text-gray-500">
                  {formatTime(timeValue)}
                </Text>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}
