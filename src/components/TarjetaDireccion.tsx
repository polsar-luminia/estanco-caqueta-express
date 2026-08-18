// Tarjeta de "Entregar ahora en ..." montada sobre el banner (diseno 1.3.0).
//
// Son DOS piezas, no una: el bloque blanco con las esquinas de arriba
// redondeadas —que es el que monta sobre el banner y arranca el cuerpo de la
// pantalla— y dentro la tarjeta con el pin y la direccion.
//
// El margen negativo solo funciona si esta seccion va inmediatamente despues de
// un banner. Cuando no hay banner (porque no habia patrocinados vigentes y el
// servidor descarto la seccion) tiene que dibujarse sin solaparse, o queda
// cortada contra el borde de arriba: de ahi la prop `montada`.

import { View, Text, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors, radii, fuentes } from "../constants/theme";

interface Props {
  direccion: string | null;
  autenticado: boolean;
  montada: boolean;
  onCambiar: () => void;
}

export function TarjetaDireccion({ direccion, autenticado, montada, onCambiar }: Props) {
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        marginTop: montada ? -28 : 0,
        paddingTop: 18,
        paddingHorizontal: 16,
      }}
    >
      <Pressable
        onPress={onCambiar}
        accessibilityRole="button"
        accessibilityLabel={
          autenticado
            ? `Cambiar dirección de entrega. Actual: ${direccion || "sin dirección"}`
            : "Iniciar sesión para agregar tu dirección de entrega"
        }
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          borderWidth: 1,
          borderColor: colors.line,
          borderRadius: radii.card,
          paddingHorizontal: 14,
          paddingVertical: 11,
        }}
      >
        <Feather name="map-pin" size={19} color={colors.pink} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fuentes.destacado, fontSize: 12.5, color: colors.muted }}>
            Entregar ahora en
          </Text>
          <Text style={{ fontFamily: fuentes.destacado, fontSize: 14.5, color: colors.ink }} numberOfLines={1}>
            {autenticado ? (direccion || "Agrega tu dirección") : "Florencia, Caquetá"}
          </Text>
        </View>
        <Text style={{ fontFamily: fuentes.destacado, fontSize: 13.5, color: colors.pink }}>Cambiar</Text>
      </Pressable>
    </View>
  );
}
