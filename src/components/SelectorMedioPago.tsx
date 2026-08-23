import { View, Text, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { fuentes } from "../constants/theme";
import { ICONOS_MEDIO, ICONO_MEDIO_GENERICO } from "../constants/config";
import type { MedioPago } from "../lib/api";

// Mismo patron visual que la lista de direcciones guardadas (cart.tsx): radio
// con borde verde en el activo y check-circle a la derecha. Se ve nativo en
// esa pantalla porque ya existe ahi.
//
// EL BLOQUE DEL VUELTO ("¿con cuanto vas a pagar?") ESTA SUSPENDIDO
// (23-ago-2026, decision del dueño al revisarlo en el simulador: no le veia
// funcionalidad suficiente para el espacio que ocupaba). Se quito SOLO la
// interfaz: la columna `pedidos.paga_con`, su CHECK, `normalizarPagaCon()` y
// las pruebas del backend siguen en pie y desplegadas, asi que restaurarlo es
// devolver este bloque + la prop `pagaCon` y volver a mandar `paga_con` en
// crearPedido. `pide_vuelto` del catalogo se conserva por lo mismo.

interface Props {
  medios: MedioPago[];
  medioSeleccionado: string;
  onSeleccionar: (codigo: string) => void;
}

export function SelectorMedioPago({ medios, medioSeleccionado, onSeleccionar }: Props) {
  return (
    <View style={{ gap: 8 }}>
      {medios.map((m) => {
        const seleccionado = m.codigo === medioSeleccionado;
        const icono = ICONOS_MEDIO[m.codigo] ?? ICONO_MEDIO_GENERICO;
        return (
          <Pressable
            key={m.codigo}
            onPress={() => onSeleccionar(m.codigo)}
            accessibilityRole="radio"
            accessibilityState={{ checked: seleccionado }}
            accessibilityLabel={`Pagar con ${m.etiqueta}`}
            className="flex-row items-center p-3 rounded-xl"
            style={{
              backgroundColor: "#fff",
              borderWidth: 2,
              borderColor: seleccionado ? "#1FAF55" : "#E4E9E3",
              minHeight: 44,
            }}
          >
            <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: icono.bg, alignItems: "center", justifyContent: "center" }}>
              <Feather name={icono.icon} size={16} color={icono.color} />
            </View>
            <View className="flex-1 ml-3">
              <Text style={{ fontSize: 14, fontFamily: fuentes.destacado, color: "#1A1C1A" }}>{m.etiqueta}</Text>
            </View>
            {seleccionado && <Feather name="check-circle" size={18} color="#1FAF55" />}
          </Pressable>
        );
      })}
    </View>
  );
}
