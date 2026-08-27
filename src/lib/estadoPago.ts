// Ventanas de tiempo del cobro con tarjeta (fase 3/4), compartidas entre
// checkout/confirmando-pago.tsx (dueña única del cobro) y orders/[id].tsx
// (solo informa, nunca decide) para que las dos lean el mismo pedido con el
// mismo criterio de "¿todavía puede estar en camino?". Antes esto vivía
// solo en orders/[id].tsx; duplicarlo a mano en la pantalla nueva es
// exactamente el tipo de copia que se desalinea con un solo cambio futuro
// en una de las dos.

/** >90s en PENDING: el texto cambia de "confirmando" a "se está demorando". */
export const MS_PAGO_DEMORADO = 90_000;

/**
 * Ventana de gracia tras crear el pedido en la que `pago == null` todavía
 * puede significar "el cobro sigue en vuelo" (el POST /pedidos/:id/pagar de
 * confirmando-pago.tsx corre DESPUÉS de crear el pedido) y no "nunca se
 * intentó". Pasada esta ventana, null se trata como un fallo real.
 */
export const MS_GRACIA_PAGO_NULO = 15_000;

export function dentroDeGraciaPago(creadoAt: string | undefined): boolean {
  if (!creadoAt) return false;
  return Date.now() - new Date(creadoAt).getTime() < MS_GRACIA_PAGO_NULO;
}
