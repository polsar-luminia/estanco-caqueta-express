import { create } from "zustand";
import type { UbicacionCapturada } from "../lib/api";

// Store efímero (no persistido) para pasar el resultado de la pantalla de mapa
// (app/ubicacion.tsx) de vuelta al formulario que la abrió, sin serializar
// objetos por params de router. El que abre registra un callback; el mapa lo
// invoca al confirmar el pin.
//
// `motivo` distingue el pin confirmado de la salida "fuera de zona, guardar
// sin el punto" (Direcciones 1.3.2): la segunda entrega `u: null` a propósito,
// y el llamador decide si eso habilita guardar sin ubicación. `reset()` sigue
// sin invocar el callback — es la salida honesta "volví sin tocar nada".

export type MotivoUbicacion = "confirmado" | "fuera_zona";
type PickCb = (u: UbicacionCapturada | null, ctx: { motivo: MotivoUbicacion }) => void;

interface UbicacionPickerState {
  onPick: PickCb | null;
  inicial: { lat: number; lng: number } | null;
  /** Solo para telemetría: qué pantalla abrió el mapa. */
  origen: string | null;
  abrir: (cb: PickCb, inicial?: { lat: number; lng: number } | null, origen?: string) => void;
  confirmar: (u: UbicacionCapturada | null, motivo: MotivoUbicacion) => void;
  reset: () => void;
}

export const useUbicacionPicker = create<UbicacionPickerState>((set, get) => ({
  onPick: null,
  inicial: null,
  origen: null,
  abrir: (cb, inicial = null, origen) => set({ onPick: cb, inicial, origen: origen ?? null }),
  confirmar: (u, motivo) => {
    const cb = get().onPick;
    set({ onPick: null, inicial: null, origen: null });
    cb?.(u, { motivo });
  },
  reset: () => set({ onPick: null, inicial: null, origen: null }),
}));
