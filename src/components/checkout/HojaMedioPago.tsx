// Hoja de medio de pago — envoltura de SelectorMedioPago en el mismo molde de
// Modal que HojaCancelar/HojaDireccion. Reemplaza la lista de radios que vivía
// siempre desplegada en el carrito por una fila compacta con "Cambiar".
//
// Fase 3 (checkout con tarjeta guardada, plan PLAN-UI-PAGO-TARJETA-PRUEBAS.md
// §3): las tarjetas guardadas van PRIMERO (radio, con badge PREDETERMINADA en
// la primera si aplica), luego "Agregar tarjeta" (fila de ACCIÓN, no radio —
// navega y cierra la hoja), un separador de línea, y por último los medios
// contra entrega de siempre (SelectorMedioPago, sin tocar).

import { View, Text, Pressable, Modal, ScrollView, Dimensions } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fuentes } from "../../constants/theme";
import type { MedioPago, MetodoPago } from "../../lib/api";
import { SelectorMedioPago } from "../SelectorMedioPago";
import { FilaSeleccionable } from "./FilaSeleccionable";
import { LogoFranquicia } from "../LogoFranquicia";

interface Props {
  visible: boolean;
  medios: MedioPago[];
  medioSeleccionado: string;
  onSeleccionar: (codigo: string) => void;
  onCerrar: () => void;
  /** Tarjetas guardadas del cliente. Vacío es un estado válido (ver
   *  "Agregar tarjeta" abajo), no un error. */
  tarjetas: MetodoPago[];
  /** true solo si 'tarjeta' viene en `medios` — el backend ya filtró por
   *  bandera + versión, así que su sola presencia ES la señal (mismo criterio
   *  que metodos-pago.tsx). Con esto en false la hoja no cambia de nada:
   *  queda igual a como era antes de la fase 3. */
  pagoTarjetaActivo: boolean;
  onAgregarTarjeta: () => void;
}

export function HojaMedioPago({
  visible,
  medios,
  medioSeleccionado,
  onSeleccionar,
  onCerrar,
  tarjetas,
  pagoTarjetaActivo,
  onAgregarTarjeta,
}: Props) {
  const insets = useSafeAreaInsets();
  // 'tarjeta' no es un medio contra entrega: la sección de tarjetas de arriba
  // la reemplaza por completo. Pasarla también a SelectorMedioPago duplicaría
  // la opción.
  const mediosContraEntrega = medios.filter((m) => m.codigo !== "tarjeta");

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

        {/* Antes eran solo tres opciones contra entrega y cabían siempre sin
            ScrollView. Con tarjetas guardadas ya no caben. maxHeight
            EXPLÍCITO, NUNCA flex:1: un ScrollView sin alto propio dentro de
            esta View se estira a llenar el espacio disponible y deja un
            hueco vacío antes del botón "Listo". */}
        <ScrollView
          style={{ maxHeight: Dimensions.get("window").height * 0.5 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ gap: 8 }}>
            {pagoTarjetaActivo && (
              <>
                {tarjetas.map((t) => {
                  const codigo = `tarjeta:${t.id}`;
                  return (
                    <FilaSeleccionable
                      key={codigo}
                      seleccionado={medioSeleccionado === codigo}
                      onPress={() => onSeleccionar(codigo)}
                      iconoNode={<LogoFranquicia brand={t.brand} size={32} />}
                      titulo={`•••• ${t.last_four}`}
                      subtitulo={`Vence ${t.exp_month}/${t.exp_year}`}
                      badges={t.predeterminada ? [{ texto: "PREDETERMINADA" }] : undefined}
                      a11yLabel={`Pagar con tarjeta terminada en ${t.last_four}`}
                    />
                  );
                })}

                {/* Fila de ACCIÓN, no radio: no lleva borde verde ni
                    check-circle, y su onPress navega en vez de seleccionar. */}
                <Pressable
                  onPress={onAgregarTarjeta}
                  accessibilityRole="button"
                  accessibilityLabel="Agregar tarjeta"
                  className="flex-row items-center p-3 rounded-xl"
                  style={{ minHeight: 44 }}
                >
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      backgroundColor: "rgba(31,175,85,0.08)",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Feather name="plus" size={16} color={colors.green} />
                  </View>
                  <View className="flex-1 ml-3">
                    <Text style={{ fontSize: 14, fontFamily: fuentes.destacado, color: colors.green }}>
                      Agregar tarjeta
                    </Text>
                    {tarjetas.length === 0 && (
                      <Text style={{ fontSize: 12, fontFamily: fuentes.destacado, color: "#6D7B6C", marginTop: 2 }}>
                        Paga en un toque la próxima vez
                      </Text>
                    )}
                  </View>
                </Pressable>

                <View style={{ height: 1, backgroundColor: colors.line, marginVertical: 4 }} />
              </>
            )}

            <SelectorMedioPago
              medios={mediosContraEntrega}
              medioSeleccionado={medioSeleccionado}
              onSeleccionar={onSeleccionar}
            />
          </View>
        </ScrollView>

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
