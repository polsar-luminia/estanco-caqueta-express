/**
 * Hoja de contexto antes del diálogo de permisos del sistema (bloque F).
 *
 * POR QUÉ EXISTE: el diálogo nativo de ubicación solo se puede mostrar UNA VEZ.
 * Si el cliente lo niega, no se puede volver a pedir: hay que mandarlo a Ajustes,
 * y casi nadie va. Preguntar en frío quema ese único intento con la gente que
 * habría dicho que sí de haber entendido para qué.
 *
 * Por eso primero se explica, en una hoja nuestra que no gasta nada, y solo
 * quien elige "Usar mi ubicación" llega al diálogo del sistema.
 *
 * LA SALIDA DE EMERGENCIA NO ES OPCIONAL: "Lo pongo a mano" abre el mapa, que
 * funciona sin ningún permiso. Ningún camino de esta pantalla puede terminar sin
 * manera de completar el pedido.
 */

import { Modal, View, Text, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors } from "../constants/theme";

export interface PermisoUbicacionProps {
  visible: boolean;
  /** El cliente acepta: recién aquí se muestra el diálogo del sistema. */
  onUsarUbicacion: () => void;
  /** El cliente prefiere el mapa. Funciona sin ningún permiso. */
  onPonerAMano: () => void;
  onCerrar: () => void;
}

export function PermisoUbicacion({
  visible,
  onUsarUbicacion,
  onPonerAMano,
  onCerrar,
}: PermisoUbicacionProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCerrar}>
      <Pressable
        onPress={onCerrar}
        accessibilityRole="button"
        accessibilityLabel="Cerrar"
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" }}
      >
        <Pressable
          // Solo detiene la propagación; no es un destino de foco.
          accessible={false}
          onPress={() => {}}
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingHorizontal: 24,
            paddingTop: 24,
            paddingBottom: 32,
          }}
        >
          <View
            style={{
              alignSelf: "center",
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: "rgba(31,175,85,0.12)",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16,
            }}
          >
            <Feather name="map-pin" size={26} color={colors.green} />
          </View>

          <Text
            style={{ fontSize: 18, fontWeight: "800", color: colors.ink, textAlign: "center" }}
          >
            ¿Dónde te dejamos el pedido?
          </Text>
          <Text
            style={{
              fontSize: 14,
              lineHeight: 20,
              color: colors.muted,
              textAlign: "center",
              marginTop: 8,
            }}
          >
            Usamos tu ubicación solo para llevarte el pedido al punto exacto. No la
            compartimos con nadie y puedes quitarla cuando quieras.
          </Text>

          <Pressable
            onPress={onUsarUbicacion}
            accessibilityRole="button"
            accessibilityLabel="Usar mi ubicación"
            style={{
              minHeight: 48,
              borderRadius: 14,
              backgroundColor: colors.green,
              alignItems: "center",
              justifyContent: "center",
              marginTop: 20,
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: "800", color: "#fff" }}>
              Usar mi ubicación
            </Text>
          </Pressable>

          {/* La salida de emergencia. Se ve como una opción de verdad, no como
              letra pequeña: para mucha gente va a ser el camino principal. */}
          <Pressable
            onPress={onPonerAMano}
            accessibilityRole="button"
            accessibilityLabel="Poner el punto a mano en el mapa"
            style={{
              minHeight: 48,
              borderRadius: 14,
              backgroundColor: colors.lowfill,
              alignItems: "center",
              justifyContent: "center",
              marginTop: 10,
            }}
          >
            <Text style={{ fontSize: 15, fontWeight: "700", color: colors.ink }}>
              Lo pongo a mano en el mapa
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
