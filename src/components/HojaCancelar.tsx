// Por qué cancelas: hoja de motivos, en vez del "¿Estás seguro?" de siempre.
//
// El sí/no anterior no dejaba nada: el negocio veía caerse pedidos sin saber si
// era por demora, por un error al pedir o por precio — que son tres problemas
// distintos y se corrigen distinto.
//
// La lista VIENE DEL SERVIDOR (`configuracion-app`). No está quemada aquí a
// propósito: el parque de Android sigue en 1.2.3 y no recibe las
// actualizaciones de 1.3.0, así que un motivo quemado en el binario tardaría
// meses en cambiar allá. `MOTIVOS_RESPALDO` solo cubre el caso de abrir la hoja
// sin haber podido cargar la configuración.

import { useState } from "react";
import { View, Text, Pressable, TextInput, Modal, ScrollView } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { MotivoCancelacion } from "../lib/api";
import { fuentes } from "../constants/theme";

const MOTIVOS_RESPALDO: MotivoCancelacion[] = [
  { codigo: "pedi_por_equivocacion", etiqueta: "Lo pedí por equivocación" },
  { codigo: "se_esta_demorando", etiqueta: "Se está demorando mucho" },
  { codigo: "cambie_de_opinion", etiqueta: "Cambié de opinión" },
  { codigo: "otro", etiqueta: "Otro motivo" },
];

const MAX_DETALLE = 300;

export function HojaCancelar({
  visible,
  motivos,
  enviando,
  onCerrar,
  onConfirmar,
}: {
  visible: boolean;
  motivos?: MotivoCancelacion[];
  enviando: boolean;
  onCerrar: () => void;
  onConfirmar: (motivo: string, detalle?: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const [elegido, setElegido] = useState<string | null>(null);
  const [detalle, setDetalle] = useState("");

  const lista = motivos && motivos.length > 0 ? motivos : MOTIVOS_RESPALDO;
  // "Otro" sin explicación no dice nada, y es justo el caso donde el motivo
  // importa: no cupo en la lista. El servidor también lo exige.
  const listo = elegido != null && (elegido !== "otro" || detalle.trim().length > 0);

  const cerrar = () => {
    setElegido(null);
    setDetalle("");
    onCerrar();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={cerrar}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)" }} onPress={cerrar} />
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
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
          <Text style={{ flex: 1, fontSize: 19, fontFamily: fuentes.destacado, color: "#1A1C1A" }}>
            ¿Por qué cancelas?
          </Text>
          <Pressable onPress={cerrar} accessibilityRole="button" accessibilityLabel="Cerrar" hitSlop={10}>
            <Feather name="x" size={22} color="#6D7B6C" />
          </Pressable>
        </View>
        <Text style={{ fontFamily: fuentes.destacado, fontSize: 13.5, color: "#6D7B6C", marginBottom: 14 }}>
          Nos ayuda a mejorar. Solo toma un segundo.
        </Text>

        <ScrollView style={{ maxHeight: 320 }} keyboardShouldPersistTaps="handled">
          {lista.map((m) => {
            const activo = elegido === m.codigo;
            return (
              <Pressable
                key={m.codigo}
                onPress={() => setElegido(m.codigo)}
                accessibilityRole="radio"
                accessibilityState={{ selected: activo }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  paddingVertical: 14,
                  paddingHorizontal: 14,
                  borderRadius: 14,
                  marginBottom: 8,
                  borderWidth: 1.5,
                  borderColor: activo ? "#1FAF55" : "#E4E9E3",
                  backgroundColor: activo ? "rgba(31,175,85,0.07)" : "#fff",
                }}
              >
                <Feather
                  name={activo ? "check-circle" : "circle"}
                  size={19}
                  color={activo ? "#1FAF55" : "#B6BDB5"}
                />
                <Text style={{ flex: 1, fontSize: 15, color: "#1A1C1A", fontFamily: fuentes.destacado ? "700" : "500" }}>
                  {m.etiqueta}
                </Text>
              </Pressable>
            );
          })}

          {elegido === "otro" && (
            <TextInput
              value={detalle}
              onChangeText={(t) => setDetalle(t.slice(0, MAX_DETALLE))}
              placeholder="Cuéntanos brevemente qué pasó"
              placeholderTextColor="#9AA69A"
              multiline
              autoFocus
              style={{
                borderWidth: 1.5,
                borderColor: "#E4E9E3",
                borderRadius: 14,
                padding: 14,
                minHeight: 86,
                fontFamily: fuentes.destacado, fontSize: 15,
                color: "#1A1C1A",
                textAlignVertical: "top",
                marginBottom: 8,
              }}
            />
          )}
        </ScrollView>

        <Pressable
          onPress={() => elegido && onConfirmar(elegido, elegido === "otro" ? detalle.trim() : undefined)}
          disabled={!listo || enviando}
          accessibilityRole="button"
          accessibilityLabel="Confirmar la cancelación del pedido"
          style={{
            marginTop: 12,
            paddingVertical: 16,
            borderRadius: 16,
            alignItems: "center",
            backgroundColor: listo && !enviando ? "#D64545" : "#E4E9E3",
          }}
        >
          <Text style={{ fontSize: 15.5, fontFamily: fuentes.destacado, color: listo && !enviando ? "#fff" : "#9AA69A" }}>
            {enviando ? "Cancelando…" : "Cancelar mi pedido"}
          </Text>
        </Pressable>

        <Pressable onPress={cerrar} style={{ paddingVertical: 14, alignItems: "center" }} accessibilityRole="button">
          <Text style={{ fontSize: 15, color: "#6D7B6C", fontFamily: fuentes.destacado }}>Mejor no, sigo con el pedido</Text>
        </Pressable>
      </View>
    </Modal>
  );
}
