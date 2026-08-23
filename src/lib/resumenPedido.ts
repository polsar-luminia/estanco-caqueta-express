/**
 * Cuenta del carrito — punto unico donde se arma lo que el cliente ve.
 *
 * El servidor es la autoridad sobre la plata: `POST /pedidos` recalcula subtotal,
 * cupon y envio desde la base de datos y nunca confia en lo que manda el cliente.
 * Este helper existe para que lo que el carrito MUESTRA salga de la misma formula
 * que lo que el servidor COBRA. Si divergen, el cliente ve $5.000 de envio y le
 * cobran $8.000, que es exactamente lo que el bloque A vino a evitar.
 *
 * Se extrae a un archivo aparte a proposito: con tarifa por zona (bloque A) y frio
 * asegurado (bloque H) hay dos cosas nuevas colgando del mismo total. Tenerlo en un
 * solo lugar puro y con tests evita tocar dos veces el punto donde un error cobra de mas.
 *
 * Espejo de packages/api/src/routes/pedidos.js (calculo de envio y total).
 */

export interface EntradaResumen {
  /** Suma de precio x cantidad de las lineas. Nunca incluye envio ni servicios. */
  subtotal: number;
  /** Descuento del cupon ya resuelto por el backend. */
  descuentoCupon?: number;
  /** Costo de envio a aplicar: el de la zona si la tiene, si no el global. */
  envioCosto: number;
  /** A partir de este subtotal el envio es gratis. */
  envioGratisMinimo: number;
  /** El cliente pidio canjear puntos Y tiene saldo suficiente. */
  usaPuntos?: boolean;
  /** El cupon aplicado es de tipo envio_gratis. */
  cuponEnvioGratis?: boolean;
  /** Frio asegurado: el check esta marcado Y hay al menos un producto elegible. */
  frio?: boolean;
  /** Cargo por pedido del frio, desde configuracion. Nunca hardcodeado. */
  frioCosto?: number;
}

export interface ResumenPedido {
  subtotal: number;
  descuento: number;
  envio: number;
  frio: number;
  total: number;
  /** Para explicarle al cliente por que no le cobramos envio. */
  motivoEnvioGratis: 'monto' | 'puntos' | 'cupon' | null;
}

export function calcularResumen(e: EntradaResumen): ResumenPedido {
  const subtotal = Math.max(0, e.subtotal || 0);
  const descuento = Math.max(0, e.descuentoCupon || 0);

  // Mismo orden que el servidor: el monto y el cupon deciden primero, y solo si
  // el envio todavia se cobra tiene sentido gastar los puntos. Canjear puntos
  // por un envio que ya era $0 no le da nada al cliente.
  const gratisPorMonto = subtotal >= e.envioGratisMinimo;
  const gratisPorCupon = !!e.cuponEnvioGratis;
  const gratisPorPuntos = !!e.usaPuntos;

  let motivoEnvioGratis: ResumenPedido['motivoEnvioGratis'] = null;
  if (gratisPorMonto) motivoEnvioGratis = 'monto';
  else if (gratisPorCupon) motivoEnvioGratis = 'cupon';
  else if (gratisPorPuntos) motivoEnvioGratis = 'puntos';

  const envio = motivoEnvioGratis ? 0 : Math.max(0, e.envioCosto || 0);

  // El frio se suma AL FINAL, fuera del subtotal. Esa es toda la regla:
  //  - no acerca a nadie al envio gratis (que se mide contra el subtotal),
  //  - no cuenta para el pedido minimo,
  //  - no genera puntos,
  //  - y ningun cupon de descuento lo toca, porque los cupones son sobre mercancia.
  // Pegarlo al subtotal regalaria puntos por un servicio. Mismo orden que el
  // servidor en POST /pedidos.
  const frio = e.frio ? Math.max(0, e.frioCosto || 0) : 0;

  return {
    subtotal,
    descuento,
    envio,
    frio,
    total: subtotal - descuento + envio + frio,
    motivoEnvioGratis,
  };
}

/**
 * Costo de envio a usar: el de la zona del punto de entrega si tiene tarifa propia,
 * si no el global de configuracion.
 *
 * `null` del servidor significa "usar el global", NO cero: una zona sin tarifa no
 * es una zona con envio gratis.
 */
export function envioDeZona(costoZona: number | null | undefined, costoGlobal: number): number {
  return costoZona == null ? costoGlobal : costoZona;
}
