// Hoja mínima para editar los detalles de entrega (notas). Arregla algo que
// el carrito de una tarjeta no dejaba hacer: las notas de una dirección
// GUARDADA no se podían tocar desde el checkout — se mandaba `dirActiva.notas`
// a secas. Ver `notasOverride` en cart.tsx: null = "usa la de la dirección".

import { useState, useEffect } from "react";
import { View, Text, Pressable, TextInput, Modal, KeyboardAvoidingView, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fuentes } from "../../constants/theme";

interface Props {
  visible: boolean;
  valorInicial: string;
  onGuardar: (texto: string) => void;
  onCerrar: () => void;
}

export function HojaNotas({ visible, valorInicial, onGuardar, onCerrar }: Props) {
  const insets = useSafeAreaInsets();
  const [texto, setTexto] = useState(valorInicial);

  useEffect(() => {
    if (visible) setTexto(valorInicial);
  }, [visible, valorInicial]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCerrar}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)" }} onPress={onCerrar} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
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
            <Text style={{ flex: 1, fontSize: 19, fontFamily: fuentes.destacado, color: "#1A1C1A" }}>Detalles de entrega</Text>
            <Pressable onPress={onCerrar} accessibilityRole="button" accessibilityLabel="Cerrar" hitSlop={10}>
              <Feather name="x" size={22} color="#6D7B6C" />
            </Pressable>
          </View>
          <TextInput
            style={{ backgroundColor: colors.lowfill, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontFamily: fuentes.destacado, fontSize: 14, color: "#1A1C1A", minHeight: 90, textAlignVertical: "top" }}
            placeholder="Ej: portería, torre, color de la casa…"
            placeholderTextColor="#BCCABA"
            value={texto}
            onChangeText={(t) => setTexto(t.slice(0, 200))}
            multiline
            autoFocus
          />
          <Pressable
            onPress={() => { onGuardar(texto.trim()); onCerrar(); }}
            accessibilityRole="button"
            accessibilityLabel="Guardar detalles de entrega"
            style={{ marginTop: 16, paddingVertical: 15, borderRadius: 16, alignItems: "center", backgroundColor: colors.green }}
          >
            <Text style={{ fontSize: 15, fontFamily: fuentes.destacado, color: "#fff" }}>Guardar</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
