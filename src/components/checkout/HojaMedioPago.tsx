// Hoja de medio de pago — envoltura de SelectorMedioPago en el mismo molde de
// Modal que HojaCancelar/HojaDireccion. Reemplaza la lista de radios que vivía
// siempre desplegada en el carrito por una fila compacta con "Cambiar".

import { View, Text, Pressable, Modal } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fuentes } from "../../constants/theme";
import type { MedioPago } from "../../lib/api";
import { SelectorMedioPago } from "../SelectorMedioPago";

interface Props {
  visible: boolean;
  medios: MedioPago[];
  medioSeleccionado: string;
  onSeleccionar: (codigo: string) => void;
  onCerrar: () => void;
}

export function HojaMedioPago({ visible, medios, medioSeleccionado, onSeleccionar, onCerrar }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCerrar}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)" }} onPress={onCerrar} />
      <View
        style={{
          backgroundColor: "#fff",
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          paddingTop: 20,
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 20,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
          <Text style={{ flex: 1, fontSize: 19, fontFamily: fuentes.destacado, color: "#1A1C1A" }}>Método de pago</Text>
          <Pressable onPress={onCerrar} accessibilityRole="button" accessibilityLabel="Cerrar" hitSlop={10}>
            <Feather name="x" size={22} color="#6D7B6C" />
          </Pressable>
        </View>

        {/* Sin ScrollView: son tres opciones y caben siempre. Un ScrollView sin
            alto propio dentro de esta View se estiraba a llenar el espacio
            disponible y dejaba un hueco vacío antes del botón. */}
        <SelectorMedioPago
          medios={medios}
          medioSeleccionado={medioSeleccionado}
          onSeleccionar={onSeleccionar}
        />

        <Pressable
          onPress={onCerrar}
          accessibilityRole="button"
          accessibilityLabel="Confirmar medio de pago"
          style={{ marginTop: 16, paddingVertical: 15, borderRadius: 16, alignItems: "center", backgroundColor: "#1FAF55" }}
        >
          <Text style={{ fontSize: 15, fontFamily: fuentes.destacado, color: "#fff" }}>Listo</Text>
        </Pressable>
      </View>
    </Modal>
  );
}
