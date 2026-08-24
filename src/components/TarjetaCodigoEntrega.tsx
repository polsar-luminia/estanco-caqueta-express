// El código de 4 dígitos que el cliente le dicta al repartidor para que
// pueda marcar el pedido como entregado.
//
// PARA QUÉ SIRVE: el repartidor externo paga la mercancía al recoger y le
// cobra el total al cliente. Este código es la prueba de que la entrega
// llegó a la persona correcta — nadie más que este cliente puede producirlo,
// porque nunca se compara en la app, solo en el servidor.
//
// COMPONENTE APARTE Y SIN HOOKS A PROPÓSITO: así se puede probar llamando la
// función directamente (como OrderStatusTimeline.test.tsx), sin un render
// real de React — este archivo no usa useEffect ni useRouter; la pantalla
// que lo monta (orders/[id].tsx) es quien decide cuándo trackear el evento
// de "visto" y a dónde navega "No veo mi código".
//
// EL CAMPO PUEDE FALTAR: la convención de `interface Pedido` en lib/api.ts
// dice que todo campo nuevo es opcional y la UI sobrevive a su ausencia. Acá
// además se comprueba `estado === "domiciliario_llego"` aunque el servidor ya
// deja de mandar el campo fuera de ese estado (lo borra en cuanto el pedido
// avanza) — es una redundancia deliberada, no el patrón usual de esta app
// (MapaDomiciliario, por ejemplo, confía ciegamente en lo que manda el
// servidor): un secreto de un solo uso vale la pena defenderlo dos veces.

import { View, Text, Pressable } from "react-native";
import { colors, fuentes } from "../constants/theme";
import { CARD_SHADOW } from "../constants/styles";
import type { Pedido } from "../lib/api";

export interface TarjetaCodigoEntregaProps {
  pedido: Pedido;
  /** "No veo mi código": la pantalla decide si eso abre el chat. */
  onPedirAyuda: () => void;
}

export function TarjetaCodigoEntrega({ pedido, onPedirAyuda }: TarjetaCodigoEntregaProps) {
  if (pedido.estado !== "domiciliario_llego" || !pedido.codigo_entrega) return null;

  const digitos = pedido.codigo_entrega;
  // Deletreado dígito por dígito: un lector de pantalla diciendo "cuatro mil
  // setenta y dos" es inservible para dictarlo en voz alta.
  const etiquetaAccesible = `Tu código de entrega: ${digitos.split("").join(", ")}`;

  return (
    <View className="bg-white rounded-2xl p-6" style={CARD_SHADOW}>
      <Text
        style={{
          fontSize: 12,
          fontFamily: fuentes.destacado,
          color: colors.muted,
          textTransform: "uppercase",
          letterSpacing: 1.2,
          marginBottom: 10,
        }}
      >
        Código de entrega
      </Text>
      <Text
        accessibilityLabel={etiquetaAccesible}
        style={{
          fontSize: 44,
          fontFamily: fuentes.titulo,
          color: colors.ink,
          letterSpacing: 8,
          fontVariant: ["tabular-nums"],
        }}
      >
        {digitos}
      </Text>
      <Text style={{ fontSize: 13, fontFamily: fuentes.destacado, color: colors.muted, marginTop: 8 }}>
        Dictáselo a tu domiciliario para confirmar la entrega.
      </Text>
      <Pressable
        onPress={onPedirAyuda}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="No veo mi código de entrega"
        style={{ marginTop: 12 }}
      >
        <Text style={{ fontSize: 12, fontFamily: fuentes.destacado, color: colors.greenInk, textDecorationLine: "underline" }}>
          No veo mi código
        </Text>
      </Pressable>
    </View>
  );
}
