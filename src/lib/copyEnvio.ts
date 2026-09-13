/**
 * Por qué el envío salió gratis, en texto — a partir de `motivoEnvioGratis`
 * que ya calcula `calcularResumen()` (resumenPedido.ts).
 *
 * Existe porque la barra inferior del carrito decía SIEMPRE "Envío gratis con
 * tus puntos" cuando `envio === 0`, aunque hubiera sido gratis por superar el
 * monto mínimo o por un cupón — un bug de contenido real, ya en producción,
 * detectado al rediseñar el checkout (1.3.2/build 94). Se extrae a un
 * archivo puro con su propia prueba precisamente para que no se repita al
 * volver a tocar el desglose.
 */
import { formatCOP } from "./format";
import type { ResumenPedido } from "./resumenPedido";

export function copyEnvioGratis(motivo: ResumenPedido["motivoEnvioGratis"], envioGratisMinimo: number): string | null {
  switch (motivo) {
    case "monto":
      return `Envío gratis por superar ${formatCOP(envioGratisMinimo)}`;
    case "cupon":
      return "Envío gratis con tu cupón";
    case "puntos":
      return "Envío gratis con tus puntos";
    default:
      return null;
  }
}
