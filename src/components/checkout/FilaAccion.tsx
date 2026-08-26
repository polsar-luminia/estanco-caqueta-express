// Fila "etiqueta / valor" con acción a la derecha — el patrón de MenuItem
// (profile.tsx) y TarjetaDireccion.tsx, unificado y con subtítulo (que
// MenuItem no tenía). Usada por método de pago y por la fila de detalles de
// entrega dentro del bloque de punto de entrega.

import { View, Text, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors, fuentes } from "../../constants/theme";

interface Props {
  icono: keyof typeof Feather.glyphMap;
  colorIcono?: string;
  /** Nodo de ícono ya armado (p.ej. LogoFranquicia para una tarjeta guardada).
   *  Tiene prioridad sobre `icono` si ambos llegan — mismo patrón que
   *  FilaSeleccionable.iconoNode. */
  iconoNode?: React.ReactNode;
  etiqueta: string;
  valor?: string;
  valorNode?: React.ReactNode;
  placeholder?: string;
  /** Texto de la acción ("Cambiar"); si falta, se pinta un chevron. */
  accion?: string;
  onPress: () => void;
  a11yLabel: string;
  /** Borde superior, para apilar filas dentro de una misma tarjeta. */
  hairline?: boolean;
}

export function FilaAccion({
  icono,
  colorIcono = colors.green,
  iconoNode,
  etiqueta,
  valor,
  valorNode,
  placeholder,
  accion,
  onPress,
  a11yLabel,
  hairline,
}: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingVertical: 12,
        borderTopWidth: hairline ? 1 : 0,
        borderTopColor: colors.line,
        minHeight: 44,
      }}
    >
      {iconoNode ?? <Feather name={icono} size={18} color={colorIcono} />}
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fuentes.destacado, fontSize: 12, color: colors.muted }}>{etiqueta}</Text>
        {valorNode ? (
          valorNode
        ) : (
          <Text
            style={{ fontFamily: fuentes.destacado, fontSize: 14, color: valor ? colors.ink : colors.faint }}
            numberOfLines={1}
          >
            {valor || placeholder}
          </Text>
        )}
      </View>
      {accion ? (
        <Text style={{ fontSize: 13, fontFamily: fuentes.destacado, color: colors.green }}>{accion}</Text>
      ) : (
        <Feather name="chevron-right" size={18} color="#CBD3C7" />
      )}
    </Pressable>
  );
}
