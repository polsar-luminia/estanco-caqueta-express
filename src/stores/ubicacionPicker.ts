import { create } from "zustand";
import type { UbicacionCapturada } from "../lib/api";

// Store efímero (no persistido) para pasar el resultado de la pantalla de mapa
// (app/ubicacion.tsx) de vuelta al formulario que la abrió, sin serializar
// objetos por params de router. El que abre registra un callback; el mapa lo
// invoca al confirmar el pin.

type PickCb = (u: UbicacionCapturada) => void;

interface UbicacionPickerState {
  onPick: PickCb | null;
  inicial: { lat: number; lng: number } | null;
  abrir: (cb: PickCb, inicial?: { lat: number; lng: number } | null) => void;
  confirmar: (u: UbicacionCapturada) => void;
  reset: () => void;
}

export const useUbicacionPicker = create<UbicacionPickerState>((set, get) => ({
  onPick: null,
  inicial: null,
  abrir: (cb, inicial = null) => set({ onPick: cb, inicial }),
  confirmar: (u) => {
    const cb = get().onPick;
    set({ onPick: null, inicial: null });
    cb?.(u);
  },
  reset: () => set({ onPick: null, inicial: null }),
}));
