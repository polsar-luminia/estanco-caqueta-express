// Fila de radio con check — el mismo patrón que vivía copiado tres veces
// (direcciones guardadas en cart.tsx, medios de pago en SelectorMedioPago.tsx,
// motivos en HojaCancelar.tsx). Unifica las dos primeras; HojaCancelar se deja
// como está porque su variante visual es distinta (borde 1.5, círculo a la
// izquierda, fondo tintado) y parametrizarla para un solo llamador no vale la pena.

import { View, Text, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors, fuentes } from "../../constants/theme";

interface Badge {
  texto: string;
  icono?: keyof typeof Feather.glyphMap;
}

interface Props {
  seleccionado: boolean;
  onPress: () => void;
  /** Ícono plano (patrón dirección): se colorea verde/gris según selección. */
  icono?: keyof typeof Feather.glyphMap;
  /** Nodo de ícono ya armado (patrón medio de pago: tile de color). Tiene
   *  prioridad sobre `icono` si ambos llegan. */
  iconoNode?: React.ReactNode;
  titulo: string;
  subtitulo?: string;
  badges?: Badge[];
  /** Acción secundaria a la derecha del título (p.ej. "Ubicar" en una
   *  dirección sin pin). No reemplaza el check de selección. */
  accion?: { texto: string; onPress: () => void };
  a11yLabel: string;
}

export function FilaSeleccionable({
  seleccionado,
  onPress,
  icono,
  iconoNode,
  titulo,
  subtitulo,
  badges,
  accion,
  a11yLabel,
}: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: seleccionado }}
      accessibilityLabel={a11yLabel}
      className="flex-row items-center p-3 rounded-xl"
      style={{
        backgroundColor: "#fff",
        borderWidth: 2,
        borderColor: seleccionado ? colors.green : "transparent",
        minHeight: 44,
      }}
    >
      {iconoNode ? (
        iconoNode
      ) : icono ? (
        <Feather name={icono} size={16} color={seleccionado ? colors.green : "#9E9E9E"} />
      ) : null}
      <View className="flex-1 ml-3">
        <View className="flex-row items-center" style={{ gap: 6 }}>
          <Text style={{ fontSize: 13, fontFamily: fuentes.destacado, color: "#1A1C1A" }}>{titulo}</Text>
          {badges?.map((b) => (
            <View
              key={b.texto}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 2,
                backgroundColor: "rgba(31,175,85,0.1)",
                borderRadius: 4,
                paddingHorizontal: 5,
                paddingVertical: 1,
              }}
            >
              {b.icono && <Feather name={b.icono} size={8} color={colors.green} />}
              <Text style={{ fontSize: 12, fontFamily: fuentes.destacado, color: colors.green }}>{b.texto}</Text>
            </View>
          ))}
        </View>
        {subtitulo ? (
          <Text style={{ fontFamily: fuentes.destacado, fontSize: 12, color: "#6D7B6C", marginTop: 2 }} numberOfLines={1}>
            {subtitulo}
          </Text>
        ) : null}
      </View>
      {accion ? (
        <Pressable
          onPress={accion.onPress}
          accessibilityRole="button"
          accessibilityLabel={accion.texto}
          hitSlop={10}
          style={{ paddingHorizontal: 8, paddingVertical: 4 }}
        >
          <Text style={{ fontSize: 12, fontFamily: fuentes.destacado, color: colors.green }}>{accion.texto}</Text>
        </Pressable>
      ) : seleccionado ? (
        <Feather name="check-circle" size={18} color={colors.green} />
      ) : null}
    </Pressable>
  );
}
