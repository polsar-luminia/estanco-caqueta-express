// Garantías TRANSACCIONALES del intento de pedido en curso: idempotency
// keys y el id de la dirección creada en este intento. Singleton de módulo,
// deliberadamente FUERA de cualquier store de React — sobreviven al
// desmontaje del checkout (Rediseño canasta/checkout, plan §Parte 2), que es
// justo lo que los hace seguros: sin esto, un back de la canasta al checkout
// tras un timeout (que SÍ creó el pedido en el servidor) generaría una key
// nueva al reintentar y duplicaría el pedido.
//
// No van en zustand a propósito: son valores no reactivos — nada en la UI
// necesita re-renderizar cuando cambia un UUID interno — y meterlos ahí
// confunde "estado de UI" con "garantía transaccional". Reproducen fielmente
// la semántica de los refs que reemplazan (submitIdempotencyKeyRef,
// direccionCreadaIdRef, direccionIdemKeyRef, initiateCheckoutLogueadoRef).
import { nuevoUuidV4 } from "./uuid";

let submitIdempotencyKey: string | null = null;
let direccionCreadaId: number | null = null;
let direccionIdemKey: string | null = null;
let initiateCheckoutLogueado = false;

// M-CART-15: se genera UNA vez; reintentos tras timeout/error reusan la
// misma key hasta el éxito.
export function keyPedido(): string {
  if (!submitIdempotencyKey) submitIdempotencyKey = nuevoUuidV4();
  return submitIdempotencyKey;
}

// Idempotency-Key PROPIA de la dirección, nunca compartida con la del
// pedido: el middleware replay-earía la respuesta del endpoint equivocado.
export function keyDireccion(): string {
  if (!direccionIdemKey) direccionIdemKey = nuevoUuidV4();
  return direccionIdemKey;
}

export function direccionCreadaIdActual(): number | null {
  return direccionCreadaId;
}

// M-CART-18: solo una vez por intento — si ya se creó y el pedido falló, el
// reintento no la vuelve a crear.
export function marcarDireccionCreada(id: number): void {
  direccionCreadaId = id;
}

// Meta InitiateCheckout: una vez por intento. Un reintento tras un fallo no
// vuelve a dispararlo; se libera junto con el resto al éxito.
export function initiateCheckoutYaLogueado(): boolean {
  return initiateCheckoutLogueado;
}

export function marcarInitiateCheckoutLogueado(): void {
  initiateCheckoutLogueado = true;
}

// Solo en el camino de ÉXITO: el próximo pedido empieza limpio.
export function liberarIntento(): void {
  submitIdempotencyKey = null;
  direccionCreadaId = null;
  direccionIdemKey = null;
  initiateCheckoutLogueado = false;
}
