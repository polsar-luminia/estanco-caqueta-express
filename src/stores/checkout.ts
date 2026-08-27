// Borrador VISIBLE del checkout: dirección nueva en progreso, cupón, frío y
// medio de pago elegidos. Fuera del componente para que sobreviva al
// desmontaje de la pantalla de checkout (Rediseño canasta/checkout, plan
// §Parte 2) — sin esto, un back de la canasta al checkout borra el pin
// recién capturado en el mapa, retira el cupón aplicado y hace reaparecer el
// modal de frío (que ya se había respondido).
//
// SIN `persist` a propósito: mismo criterio que el `partialize` de
// `cart.ts` — ninguna dirección ni cupón va a AsyncStorage sin cifrar. Este
// store vive solo en memoria; un cierre de la app lo limpia gratis.
//
// Lo que NO vive aquí (a propósito): submitIdempotencyKeyRef,
// direccionCreadaIdRef y afines. Esas son garantías TRANSACCIONALES, no
// estado de UI — meterlas en zustand dispara un re-render al escribir un
// UUID y confunde las dos cosas. Viven en `intentoPedido.ts`.
import { create } from "zustand";
import { registerLogoutHandler } from "./auth";
import type { CuponValidado, UbicacionCapturada } from "../lib/api";

interface CheckoutState {
  // --- Dirección nueva en progreso ---
  mostrarNueva: boolean;
  nuevaDireccion: string;
  nuevasNotas: string;
  nuevaUbicacion: UbicacionCapturada | null;
  permitirSinPin: boolean;
  notasOverride: string | null;

  // --- Cupón ---
  codigoCupon: string;
  cuponValidado: CuponValidado | null;
  cuponSubtotal: number | null;

  // --- Frío ---
  quiereFrio: boolean;
  // Composición de carrito (ids ordenados) para la que ya se mostró el
  // recordatorio de frío. Con el MISMO carrito, un ida-y-vuelta a la canasta
  // no debe re-mostrar el modal; si la composición cambió, sí corresponde
  // volver a ofrecerlo — hay elegibles nuevos.
  recordatorioMostradoClave: string | null;

  // --- Medio de pago ---
  medioPago: string;
  medioPagoInicializado: boolean;

  // --- Puntos ---
  usarPuntos: boolean;

  setMostrarNueva: (v: boolean) => void;
  setNuevaDireccion: (v: string) => void;
  setNuevasNotas: (v: string) => void;
  setNuevaUbicacion: (v: UbicacionCapturada | null) => void;
  setPermitirSinPin: (v: boolean) => void;
  setNotasOverride: (v: string | null) => void;
  setCodigoCupon: (v: string) => void;
  setCuponValidado: (v: CuponValidado | null) => void;
  setCuponSubtotal: (v: number | null) => void;
  setQuiereFrio: (v: boolean) => void;
  setRecordatorioMostradoClave: (v: string | null) => void;
  setMedioPago: (v: string) => void;
  setMedioPagoInicializado: (v: boolean) => void;
  setUsarPuntos: (v: boolean) => void;
  reset: () => void;
}

const ESTADO_INICIAL = {
  mostrarNueva: false,
  nuevaDireccion: "",
  nuevasNotas: "",
  nuevaUbicacion: null,
  permitirSinPin: false,
  notasOverride: null,
  codigoCupon: "",
  cuponValidado: null,
  cuponSubtotal: null,
  quiereFrio: false,
  recordatorioMostradoClave: null,
  medioPago: "",
  medioPagoInicializado: false,
  usarPuntos: false,
} as const;

export const useCheckoutStore = create<CheckoutState>((set) => ({
  ...ESTADO_INICIAL,
  setMostrarNueva: (v) => set({ mostrarNueva: v }),
  setNuevaDireccion: (v) => set({ nuevaDireccion: v }),
  setNuevasNotas: (v) => set({ nuevasNotas: v }),
  setNuevaUbicacion: (v) => set({ nuevaUbicacion: v }),
  setPermitirSinPin: (v) => set({ permitirSinPin: v }),
  setNotasOverride: (v) => set({ notasOverride: v }),
  setCodigoCupon: (v) => set({ codigoCupon: v }),
  setCuponValidado: (v) => set({ cuponValidado: v }),
  setCuponSubtotal: (v) => set({ cuponSubtotal: v }),
  setQuiereFrio: (v) => set({ quiereFrio: v }),
  setRecordatorioMostradoClave: (v) => set({ recordatorioMostradoClave: v }),
  setMedioPago: (v) => set({ medioPago: v }),
  setMedioPagoInicializado: (v) => set({ medioPagoInicializado: v }),
  setUsarPuntos: (v) => set({ usarPuntos: v }),
  // Se llama en dos sitios: junto a clear() del carrito en el éxito de
  // ejecutarPedido, y en el logout de abajo — mismo patrón que cart.ts.
  reset: () => set({ ...ESTADO_INICIAL }),
}));

// Cerrar sesión no debe dejar el borrador de un cliente visible para el
// siguiente en un dispositivo compartido (mismo criterio que cart.ts).
registerLogoutHandler(() => {
  useCheckoutStore.getState().reset();
});
