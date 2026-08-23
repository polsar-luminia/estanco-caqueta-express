// Tarjeta "Punto de entrega" — lo primero del checkout denso: mapa (o CTA de
// captura), fila de dirección y fila de detalles. Compone MiniMapaEntrega +
// FilaAccion.
//
// El estado vacío (dirección sin pin) es un CTA, nunca un mapa centrado en
// Florencia: pintar un punto que no es el de la persona es mentirle sobre a
// dónde va el pedido. Medido en producción (23-ago-2026): 286 de 369
// direcciones guardadas SÍ tienen pin (77,5%) — el mapa se pinta la mayoría
// de las veces; el CTA cubre las 83 que no.
//
// `dirActiva` puede ser una dirección guardada O una síntesis de la dirección
// nueva en progreso (ver `dirParaMostrar` en cart.tsx): la decisión "hay
// dirección pero sin pin" vs "no hay ninguna" se toma sobre ESTE valor, no
// sobre el conteo de direcciones guardadas — quien está llenando una
// dirección nueva no debe ver "Agrega una dirección" otra vez.

import { View, Text, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors, radii, fuentes, shadows } from "../../constants/theme";
import type { DireccionGuardada } from "../../lib/api";
import { MiniMapaEntrega } from "./MiniMapaEntrega";
import { FilaAccion } from "./FilaAccion";

interface Props {
  dirActiva: DireccionGuardada | null;
  eta: { min: number; max: number } | null;
  notas: string;
  exigirUbicacion: boolean;
  onCambiarDireccion: () => void;
  onAgregarDireccion: () => void;
  onUbicarEnMapa: () => void;
  onEditarNotas: () => void;
}

export function BloquePuntoEntrega({
  dirActiva,
  eta,
  notas,
  exigirUbicacion,
  onCambiarDireccion,
  onAgregarDireccion,
  onUbicarEnMapa,
  onEditarNotas,
}: Props) {
  const tienePin = dirActiva?.lat != null && dirActiva?.lng != null;

  return (
    <View className="rounded-2xl" style={{ backgroundColor: colors.surface, ...shadows.card, overflow: "hidden" }}>
      {dirActiva && tienePin ? (
        <MiniMapaEntrega
          lat={dirActiva.lat as number}
          lng={dirActiva.lng as number}
          eta={eta}
          onPress={onUbicarEnMapa}
          a11yLabel="Punto de entrega en el mapa. Toca para ajustarlo"
        />
      ) : (
        <View style={{ padding: 14, backgroundColor: exigirUbicacion && dirActiva ? "rgba(240,101,63,0.08)" : colors.lowfill }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: exigirUbicacion && dirActiva ? "rgba(240,101,63,0.15)" : "rgba(31,175,85,0.1)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Feather name="map-pin" size={16} color={exigirUbicacion && dirActiva ? colors.offer : colors.green} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontFamily: fuentes.destacado, color: "#1A1C1A" }}>
                {!dirActiva ? "Agrega una dirección" : exigirUbicacion ? "Necesitamos el punto para entregar" : "Falta el punto exacto"}
              </Text>
              <Text style={{ fontFamily: fuentes.destacado, fontSize: 12, color: "#6D7B6C", marginTop: 1 }}>
                {!dirActiva ? "Para saber a dónde enviarte el pedido." : "El domiciliario llega por el mapa, no por el texto."}
              </Text>
            </View>
          </View>
          <Pressable
            onPress={dirActiva ? onUbicarEnMapa : onAgregarDireccion}
            accessibilityRole="button"
            accessibilityLabel={dirActiva ? "Ubicar en el mapa" : "Agregar una dirección"}
            style={{
              marginTop: 10,
              alignSelf: "flex-start",
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              paddingVertical: 8,
              paddingHorizontal: 14,
              borderRadius: radii.pill,
              borderWidth: 1.5,
              borderColor: exigirUbicacion && dirActiva ? colors.offer : colors.green,
            }}
          >
            <Feather name="map" size={13} color={exigirUbicacion && dirActiva ? colors.offer : colors.greenInk} />
            <Text style={{ fontSize: 12.5, fontFamily: fuentes.destacado, color: exigirUbicacion && dirActiva ? colors.offer : colors.greenInk }}>
              {dirActiva ? "Ubicar en el mapa" : "Agregar dirección"}
            </Text>
          </Pressable>
        </View>
      )}

      <View style={{ paddingHorizontal: 14 }}>
        <FilaAccion
          icono="map-pin"
          etiqueta="Entregar en"
          valor={dirActiva?.direccion}
          placeholder="Agrega tu dirección"
          accion="Cambiar"
          onPress={onCambiarDireccion}
          a11yLabel={`Cambiar dirección de entrega. Actual: ${dirActiva?.direccion || "sin dirección"}`}
        />
        <FilaAccion
          icono="file-text"
          etiqueta="Detalles de entrega"
          valor={notas}
          placeholder="Portería, torre, color de la casa…"
          onPress={onEditarNotas}
          a11yLabel={`Editar detalles de entrega. Actual: ${notas || "ninguno"}`}
          hairline
        />
      </View>
    </View>
  );
}
