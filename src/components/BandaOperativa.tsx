// BandaOperativa — aviso con la tienda ABIERTA.
//
// POR QUE ES UN COMPONENTE APARTE Y NO UN CASO MAS DE BandaCerrado: aquel
// arranca con `if (tienda.abierta) return null`. Esa linea no es un detalle de
// implementacion, es su contrato — existe para explicar por que NO se puede
// comprar. Este dice lo contrario: se puede comprar, y asi va a ir. Meterlos en
// el mismo componente obligaria a que uno de los dos se contradiga con su
// propia guarda.
//
// El texto lo decide el backend (configuracion.aviso_demora_*, migracion 085),
// incluido CUAL de los dos mensajes se usa segun el ETA este visible u oculto.
// Aqui no se decide nada de eso a proposito: si la app eligiera el mensaje,
// tendria que saber si el ETA esta visible, y esa es justamente la clase de
// regla que se desincroniza entre el binario y el servidor.

import { View, Text } from "react-native";
import { ESTILO } from "./BandaCerrado";
import type { EstadoTienda } from "../lib/api";

interface Props {
  tienda: EstadoTienda;
  /** compact = sin la píldora de la derecha, para el resumen del carrito. */
  compact?: boolean;
  style?: object;
}

export function BandaOperativa({ tienda, compact = false, style }: Props) {
  // Cerrada manda el otro aviso: encimarle una demora a quien no puede comprar
  // es ruido.
  if (!tienda.abierta) return null;

  const aviso = tienda.aviso;
  // Un tipo que este binario no conoce se ignora en vez de pintarse con un
  // estilo prestado: es preferible no mostrar nada a mostrar un aviso con el
  // icono equivocado.
  if (!aviso || !ESTILO[aviso.tipo]) return null;

  const e = ESTILO[aviso.tipo];
  const { Icono } = e;

  return (
    <View
      accessibilityRole="alert"
      style={[
        { backgroundColor: "#fff", borderRadius: 16, borderWidth: 0.5, borderColor: e.border, padding: 14 },
        style,
      ]}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 11 }}>
        <View
          style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: e.chipBg, alignItems: "center", justifyContent: "center" }}
        >
          <Icono color={e.iconColor} size={20} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 13, fontWeight: "700", color: "#16241A" }}>{aviso.titulo}</Text>
          {/* Tres líneas y no dos: el mensaje sin ETA es más largo porque tiene
              que explicar sin prometer un tiempo, y cortarlo dejaría la frase a
              la mitad. */}
          <Text style={{ fontSize: 12, color: "#6E7A6C", marginTop: 1 }} numberOfLines={3}>
            {aviso.mensaje}
          </Text>
        </View>
        {!compact && (
          <View style={{ backgroundColor: e.pillBg, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 }}>
            <Text style={{ fontSize: 12, fontWeight: "700", color: e.pillColor }}>{e.pillTexto}</Text>
          </View>
        )}
      </View>
    </View>
  );
}
