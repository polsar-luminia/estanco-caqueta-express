// Tarjeta de "Entregar ahora en ..." con esquinas redondeadas, montada sobre el
// banner (rediseno del catalogo 1.3.0, referencia visual TaDa).
//
// El radio sale de radii.card (16), que YA existia en el tema. No se inventa un
// numero suelto: para eso estan los tokens, y un 14 escrito a mano aqui haria
// que esta tarjeta no encaje con las demas sin que nadie sepa por que.
//
// El margen negativo de arriba es lo que la hace "montar" sobre el banner. Es
// deliberado y solo funciona si va inmediatamente despues de una seccion de
// banner; cuando no hay banner (porque no hay patrocinados vigentes y el
// servidor descarto la seccion) la tarjeta se dibuja sin solaparse, que es la
// razon de la prop `montada`.

import { View, Text, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors, radii, shadows } from "../constants/theme";

interface Props {
  direccion: string | null;
  autenticado: boolean;
  montada: boolean;
  onCambiar: () => void;
}

export function TarjetaDireccion({ direccion, autenticado, montada, onCambiar }: Props) {
  return (
    <View style={{ paddingHorizontal: 16, marginTop: montada ? -26 : 12 }}>
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
          backgroundColor: colors.surface,
          borderRadius: radii.card,
          paddingHorizontal: 14,
          paddingVertical: 12,
          ...shadows.card,
        }}
      >
        <View style={{ width: 32, height: 32, borderRadius: radii.pill, backgroundColor: colors.greenTint, alignItems: "center", justifyContent: "center" }}>
          <Feather name="map-pin" size={15} color={colors.greenInk} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 11.5, fontWeight: "700", color: colors.muted }}>Entregar ahora en</Text>
          <Text style={{ fontSize: 13.5, fontWeight: "800", color: colors.ink }} numberOfLines={1}>
            {autenticado ? (direccion || "Agrega tu dirección") : "Florencia, Caquetá"}
          </Text>
        </View>
        <Text style={{ fontSize: 12.5, fontWeight: "800", color: colors.greenInk }}>Cambiar</Text>
      </Pressable>
    </View>
  );
}
