// Hoja de medio de pago — envoltura de SelectorMedioPago en el mismo molde de
// Modal que HojaCancelar/HojaDireccion. Reemplaza la lista de radios que vivía
// siempre desplegada en el carrito por una fila compacta con "Cambiar".
//
// Catalogo reducido a DOS medios (27-ago-2026, decision del dueño):
// 'transferencia'/'datafono' se retiraron, asi que ya no hace falta una lista
// plana de medios contra entrega — 'efectivo' es la unica. La hoja pasa a
// mostrar exactamente DOS filas de nivel superior, Efectivo y Tarjeta, y la
// segunda se despliega en una sub-lista anidada con las tarjetas guardadas +
// "Agregar tarjeta" (mismo patron de siempre: radio con badge PREDETERMINADA
// en la primera si aplica, "Agregar tarjeta" como fila de ACCION que navega y
// cierra la hoja, nunca una sub-lista vacia sin la fila de agregar).
//
// `mediosContraEntrega` (todo lo que no es 'tarjeta' en el catalogo real, que
// hoy es solo 'efectivo') sigue viniendo de SelectorMedioPago en vez de
// hardcodear "Efectivo": si el catalogo real alguna vez vuelve a tener mas de
// un medio contra entrega, esta hoja no necesita otro cambio.

import { useEffect, useState } from "react";
import { View, Text, Pressable, Modal, ScrollView, Dimensions } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fuentes } from "../../constants/theme";
import { ICONOS_MEDIO } from "../../constants/config";
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
  // 'tarjeta' no es un medio contra entrega: la fila de "Tarjeta" de abajo la
  // reemplaza por completo. Pasarla también a SelectorMedioPago duplicaría
  // la opción.
  const mediosContraEntrega = medios.filter((m) => m.codigo !== "tarjeta");
  const medioPagoEsTarjeta = medioSeleccionado.startsWith("tarjeta:");

  // Sub-lista de tarjetas: abierta o cerrada. Arranca reflejando la selección
  // vigente (si ya venía en "tarjeta:<id>", la hoja abre con la sub-lista ya
  // desplegada) y se vuelve a sincronizar cada vez que la hoja se abre — el
  // cliente pudo agregar o elegir una tarjeta en otra visita y volver.
  const [sublistaAbierta, setSublistaAbierta] = useState(medioPagoEsTarjeta);
  useEffect(() => {
    if (visible) setSublistaAbierta(medioSeleccionado.startsWith("tarjeta:"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const seleccionarContraEntrega = (codigo: string) => {
    setSublistaAbierta(false);
    onSeleccionar(codigo);
  };

  const alternarTarjeta = () => {
    if (sublistaAbierta) {
      setSublistaAbierta(false);
      return;
    }
    setSublistaAbierta(true);
    // Sin tarjeta elegida todavia: preseleccionar la predeterminada (con una
    // sola tarjeta, el backend YA la marca predeterminada siempre — ver
    // GET /pagos/metodos). Con 0 tarjetas no hay nada que preseleccionar; la
    // sub-lista abre mostrando solo "Agregar tarjeta".
    if (!medioPagoEsTarjeta && tarjetas.length > 0) {
      const predeterminada = tarjetas.find((t) => t.predeterminada) ?? tarjetas[0];
      onSeleccionar(`tarjeta:${predeterminada.id}`);
    }
  };

  const iconoTarjeta = ICONOS_MEDIO.tarjeta;

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
            {/* Fila de nivel superior 1: Efectivo (y cualquier otro medio
                contra entrega que el catalogo real llegue a tener). */}
            <SelectorMedioPago
              medios={mediosContraEntrega}
              medioSeleccionado={medioSeleccionado}
              onSeleccionar={seleccionarContraEntrega}
            />

            {pagoTarjetaActivo && (
              <View>
                {/* Fila de nivel superior 2: Tarjeta. El radio refleja la
                    seleccion REAL (una tarjeta elegida), no si la sub-lista
                    esta desplegada -- las dos cosas pueden diferir (p.ej.
                    reabrir para cambiar de tarjeta sin haber decidido aun). */}
                <FilaSeleccionable
                  seleccionado={medioPagoEsTarjeta}
                  onPress={alternarTarjeta}
                  iconoNode={
                    <View
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        backgroundColor: iconoTarjeta.bg,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Feather name={iconoTarjeta.icon} size={16} color={iconoTarjeta.color} />
                    </View>
                  }
                  titulo="Tarjeta"
                  a11yLabel="Pagar con tarjeta guardada"
                />

                {sublistaAbierta && (
                  <View
                    style={{
                      marginTop: 8,
                      marginLeft: 14,
                      paddingLeft: 12,
                      borderLeftWidth: 2,
                      borderLeftColor: colors.line,
                      gap: 8,
                    }}
                  >
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
                        check-circle, y su onPress navega en vez de
                        seleccionar. Nunca una sub-lista vacía sin esta fila —
                        con 0 tarjetas es lo ÚNICO que se ve aquí adentro. */}
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
                  </View>
                )}
              </View>
            )}
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
