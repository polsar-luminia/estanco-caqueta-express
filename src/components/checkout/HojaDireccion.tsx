// Hoja de dirección — reemplaza la tarjeta "Entrega" que vivía siempre
// desplegada en el carrito. Plantilla de HojaCancelar.tsx:58-161, con dos
// modos: `lista` (guardadas) y `nueva` (el formulario que ya existía en
// cart.tsx:927-983, sin cambios de lógica).
//
// El estado del formulario es CONTROLADO por CartScreen — esta hoja no muda
// nada, solo lo muestra y dispara los mismos setState de siempre. Así no hace
// falta levantar el estado del checkout a un store: sigue en `useState` de
// CartScreen, tal como estaba.
//
// Contrato commit/descarta: "Usar esta dirección" aplica y cierra; el
// backdrop o la "x" descartan el borrador. Sin esto, cerrar con un borrador a
// medias deja a handlePedir pidiendo por una dirección que el cliente ya no
// ve — ver el comentario de `onCerrar` más abajo.

import { useEffect, useState } from "react";
import { View, Text, Pressable, TextInput, Modal, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fuentes } from "../../constants/theme";
import type { DireccionGuardada, UbicacionCapturada } from "../../lib/api";
import { UbicacionButton } from "../UbicacionButton";
import { BuscadorDireccion } from "../BuscadorDireccion";
import { FilaSeleccionable } from "./FilaSeleccionable";

interface Props {
  visible: boolean;
  modoInicial: "lista" | "nueva";
  direcciones: DireccionGuardada[];
  direccionActivaId: number | null;
  onSeleccionar: (d: DireccionGuardada) => void;
  onUbicarEnMapa: (d: DireccionGuardada) => void;

  nuevaDireccion: string;
  onNuevaDireccion: (t: string) => void;
  nuevasNotas: string;
  onNuevasNotas: (t: string) => void;
  nuevaUbicacion: UbicacionCapturada | null;
  onNuevaUbicacion: (u: UbicacionCapturada | null) => void;
  silenciado: boolean;
  onSilenciado: (v: boolean) => void;

  onUsarNueva: () => void;
  onCerrar: () => void;
}

export function HojaDireccion({
  visible,
  modoInicial,
  direcciones,
  direccionActivaId,
  onSeleccionar,
  onUbicarEnMapa,
  nuevaDireccion,
  onNuevaDireccion,
  nuevasNotas,
  onNuevasNotas,
  nuevaUbicacion,
  onNuevaUbicacion,
  silenciado,
  onSilenciado,
  onUsarNueva,
  onCerrar,
}: Props) {
  const insets = useSafeAreaInsets();
  const [modo, setModo] = useState(modoInicial);

  // Reabrir la hoja siempre arranca en el modo que pidió quien la abrió (p.ej.
  // "nueva" cuando handlePedir detecta que falta dirección).
  useEffect(() => {
    if (visible) setModo(modoInicial);
  }, [visible, modoInicial]);

  const puedeUsarNueva = !!nuevaDireccion.trim() || !!nuevaUbicacion;

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
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
            <Text style={{ flex: 1, fontSize: 19, fontFamily: fuentes.destacado, color: "#1A1C1A" }}>
              {modo === "lista" ? "¿A dónde te lo llevamos?" : "Dirección nueva"}
            </Text>
            <Pressable onPress={onCerrar} accessibilityRole="button" accessibilityLabel="Cerrar" hitSlop={10}>
              <Feather name="x" size={22} color="#6D7B6C" />
            </Pressable>
          </View>

          {modo === "lista" ? (
            <>
              {/* maxHeight en PUNTOS, nunca en %. Un porcentaje aquí se
                  resuelve contra el KeyboardAvoidingView de arriba, que se
                  dimensiona por su contenido — la medida sale circular y el
                  resultado fue la lista recortada con el botón encima
                  (visto en el simulador, 23-ago-2026). HojaCancelar, que
                  lleva meses en producción, también usa puntos fijos. */}
              <ScrollView style={{ maxHeight: 300 }} contentContainerStyle={{ paddingTop: 12, gap: 8 }} keyboardShouldPersistTaps="handled">
                {direcciones.map((d) => (
                  <View key={d.id}>
                    <FilaSeleccionable
                      seleccionado={d.id === direccionActivaId}
                      onPress={() => onSeleccionar(d)}
                      icono="map-pin"
                      titulo={d.etiqueta}
                      subtitulo={d.direccion}
                      badges={[
                        ...(d.predeterminada ? [{ texto: "PRINCIPAL" }] : []),
                        ...(d.lat != null ? [{ texto: "CON UBICACIÓN", icono: "map-pin" as const }] : []),
                      ]}
                      a11yLabel={`Entregar en ${d.etiqueta}: ${d.direccion}`}
                    />
                    {d.lat == null && (
                      <Pressable
                        onPress={() => onUbicarEnMapa(d)}
                        accessibilityRole="button"
                        accessibilityLabel={`Ubicar ${d.etiqueta} en el mapa`}
                        hitSlop={10}
                        style={{ paddingVertical: 6, paddingLeft: 12 }}
                      >
                        <Text style={{ fontSize: 12, fontFamily: fuentes.destacado, color: colors.offer }}>
                          Sin punto en el mapa · Ubicar
                        </Text>
                      </Pressable>
                    )}
                  </View>
                ))}
              </ScrollView>

              {/* FUERA del ScrollView a proposito: adentro quedaba al final de
                  la lista, asi que con varias direcciones habia que deslizar
                  para descubrir que se podia agregar una nueva — y con una
                  sola direccion se leia como parte de la lista, no como la
                  accion que es. Fijo aqui, siempre se ve. */}
              <Pressable
                onPress={() => setModo("nueva")}
                accessibilityRole="button"
                accessibilityLabel="Agregar una dirección nueva"
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  marginTop: 12,
                  paddingVertical: 14,
                  borderRadius: 16,
                  borderWidth: 1.5,
                  borderColor: colors.green,
                }}
              >
                <Feather name="plus-circle" size={18} color={colors.greenInk} />
                <Text style={{ fontSize: 14.5, fontFamily: fuentes.destacado, color: colors.greenInk }}>Agregar dirección nueva</Text>
              </Pressable>
            </>
          ) : (
            <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ paddingTop: 12 }} keyboardShouldPersistTaps="handled">
              <UbicacionButton
                value={nuevaUbicacion}
                textoDireccion={nuevaDireccion}
                onChange={(u) => {
                  onNuevaUbicacion(u);
                  if (u?.geocoded_direccion && (u.metodo_ubicacion === "pin_mapa" || !nuevaDireccion.trim())) {
                    onNuevaDireccion(u.geocoded_direccion);
                  }
                  onSilenciado(u != null);
                }}
              />
              <Text style={{ fontSize: 12, fontFamily: fuentes.destacado, color: "#6D7B6C", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 6, marginLeft: 4 }}>
                Dirección
              </Text>
              <View style={{ marginBottom: 4 }}>
                <BuscadorDireccion
                  value={nuevaDireccion}
                  onChangeText={(t) => { onNuevaDireccion(t); onSilenciado(false); }}
                  silenciado={silenciado}
                  onUbicacion={(u) => { onNuevaUbicacion(u); onSilenciado(true); }}
                  placeholder="Ej: Carrera 15 # 12-34"
                  accessibilityLabel="Dirección de entrega"
                />
              </View>
              <Text style={{ fontFamily: fuentes.destacado, fontSize: 12, color: "#9AA69A", marginBottom: 12, marginLeft: 4 }}>
                El punto del mapa es el que usa el domiciliario. Esto le ayuda a identificar la casa cuando ya está cerca.
              </Text>
              <Text style={{ fontSize: 12, fontFamily: fuentes.destacado, color: "#6D7B6C", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 6, marginLeft: 4 }}>
                Notas (Opcional)
              </Text>
              <TextInput
                style={{ backgroundColor: colors.lowfill, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontFamily: fuentes.destacado, fontSize: 14, color: "#1A1C1A", marginBottom: 16 }}
                placeholder="Ej: portería, dejar con vigilante"
                placeholderTextColor="#BCCABA"
                value={nuevasNotas}
                onChangeText={onNuevasNotas}
                multiline
                maxLength={200}
              />

              {direcciones.length > 0 && (
                <Pressable
                  onPress={() => setModo("lista")}
                  accessibilityRole="button"
                  accessibilityLabel="Usar una dirección guardada"
                  style={{ paddingVertical: 4, marginBottom: 8 }}
                >
                  <Text style={{ fontSize: 12.5, fontFamily: fuentes.destacado, color: colors.green }}>← Usar una dirección guardada</Text>
                </Pressable>
              )}

              <Pressable
                onPress={onUsarNueva}
                disabled={!puedeUsarNueva}
                accessibilityRole="button"
                accessibilityLabel="Usar esta dirección"
                accessibilityState={{ disabled: !puedeUsarNueva }}
                style={{
                  marginTop: 4,
                  paddingVertical: 16,
                  borderRadius: 16,
                  alignItems: "center",
                  backgroundColor: puedeUsarNueva ? colors.green : colors.line,
                }}
              >
                <Text style={{ fontSize: 15.5, fontFamily: fuentes.destacado, color: puedeUsarNueva ? "#fff" : "#9AA69A" }}>
                  Usar esta dirección
                </Text>
              </Pressable>
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
