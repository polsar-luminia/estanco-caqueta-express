// Desglose de dinero del checkout — espejo de
// app/(tabs)/orders/[id].tsx:262-311 (el desglose canónico que ya usa el
// detalle de pedido), más dos cosas que ese no necesita:
//
//   1. La barra de "faltan $X para envío gratis" absorbida como renglón bajo
//      Domicilio (antes era una tarjeta suelta de 50pt en cart.tsx).
//   2. El copy de "por qué el envío es gratis" derivado de
//      `resumen.motivoEnvioGratis`, que calcularResumen() YA calcula y que
//      antes nadie usaba: la barra inferior decía SIEMPRE "con tus puntos",
//      así hubiera sido gratis por monto o por cupón.
//
// Recibe el ResumenPedido ENTERO, no subtotal/total sueltos, para que sea
// imposible recalcular nada aquí: resumenPedido.ts es espejo del servidor y
// tiene pruebas propias — este componente solo formatea.

import { View, Text } from "react-native";
import { colors, fuentes } from "../../constants/theme";
import { formatCOP } from "../../lib/format";
import { copyEnvioGratis } from "../../lib/copyEnvio";
import type { ResumenPedido } from "../../lib/resumenPedido";

interface Props {
  resumen: ResumenPedido;
  envioCosto: number;
  envioGratisMinimo: number;
  cuponCodigo?: string | null;
}

function Renglon({ etiqueta, valor, color, hairline = true }: { etiqueta: string; valor: React.ReactNode; color?: string; hairline?: boolean }) {
  return (
    <View
      className="flex-row justify-between items-center"
      style={{ paddingTop: hairline ? 10 : 0, borderTopWidth: hairline ? 1 : 0, borderTopColor: colors.line }}
    >
      <Text style={{ fontFamily: fuentes.destacado, fontSize: 14, color: "#6D7B6C" }}>{etiqueta}</Text>
      {typeof valor === "string" ? (
        <Text style={{ fontSize: 14, fontFamily: fuentes.destacado, color: color ?? "#1A1C1A" }}>{valor}</Text>
      ) : (
        valor
      )}
    </View>
  );
}

export function ResumenTotales({ resumen, envioCosto, envioGratisMinimo, cuponCodigo }: Props) {
  const { subtotal, descuento, envio, frio, total, motivoEnvioGratis } = resumen;
  const faltaParaGratis = envio > 0 ? Math.max(0, envioGratisMinimo - subtotal) : 0;
  const ahorroEnvio = envio === 0 && motivoEnvioGratis ? envioCosto : 0;
  const totalAhorro = descuento + ahorroEnvio;
  const copyGratis = envio === 0 ? copyEnvioGratis(motivoEnvioGratis, envioGratisMinimo) : null;

  return (
    <View className="rounded-2xl p-4 bg-white" style={{ backgroundColor: colors.surface }}>
      <Renglon etiqueta="Subtotal" valor={formatCOP(subtotal)} hairline={false} />

      <View style={{ paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.line }}>
        <View className="flex-row justify-between items-center">
          <Text style={{ fontFamily: fuentes.destacado, fontSize: 14, color: "#6D7B6C" }}>Domicilio</Text>
          <Text style={{ fontSize: 14, fontFamily: fuentes.destacado, color: envio === 0 ? colors.green : "#1A1C1A" }}>
            {envio === 0 ? "¡Gratis!" : formatCOP(envio)}
          </Text>
        </View>
        {copyGratis ? (
          <Text style={{ fontSize: 12, fontFamily: fuentes.destacado, color: colors.green, marginTop: 2 }}>{copyGratis}</Text>
        ) : faltaParaGratis > 0 ? (
          <View style={{ marginTop: 8 }}>
            <Text style={{ fontFamily: fuentes.destacado, fontSize: 12, color: "#6D7B6C", marginBottom: 4 }}>
              Faltan {formatCOP(faltaParaGratis)} para envío gratis
            </Text>
            <View style={{ height: 4, borderRadius: 2, backgroundColor: colors.line }}>
              <View
                style={{
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: colors.green,
                  width: `${Math.min(100, (subtotal / envioGratisMinimo) * 100)}%`,
                }}
              />
            </View>
          </View>
        ) : null}
      </View>

      {descuento > 0 && (
        <Renglon
          etiqueta={`Descuento${cuponCodigo ? ` (${cuponCodigo})` : ""}`}
          valor={`-${formatCOP(descuento)}`}
          color={colors.pink}
        />
      )}

      {frio > 0 && <Renglon etiqueta="Frío asegurado" valor={formatCOP(frio)} color="#0F3A6B" />}

      <View style={{ paddingTop: 12, marginTop: 2, borderTopWidth: 1, borderTopColor: colors.line }}>
        <View className="flex-row justify-between items-center">
          <Text style={{ fontSize: 16, fontFamily: fuentes.destacado, color: "#1A1C1A" }}>Total</Text>
          <Text style={{ fontSize: 20, fontFamily: fuentes.titulo, color: colors.green }}>{formatCOP(total)}</Text>
        </View>
        {totalAhorro > 0 && (
          <Text style={{ fontSize: 12, fontFamily: fuentes.destacado, color: colors.green, marginTop: 2, textAlign: "right" }}>
            Ahorras {formatCOP(totalAhorro)} 🎉
          </Text>
        )}
      </View>
    </View>
  );
}
