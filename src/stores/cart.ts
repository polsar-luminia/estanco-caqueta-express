import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { tracker } from "../lib/tracker";
import { metaLogAddToCart } from "../lib/metaEvents";
import { debouncedSyncCart } from "../lib/cartSync";
import { registerLogoutHandler } from "./auth";

export interface CartItem {
  productoId: number;
  nombre: string;
  precioUnitario: number;
  cantidad: number;
  imagenUrl?: string;
  stockMaximo?: number;
}

interface CartState {
  items: CartItem[];
  direccion: string;
  barrio: string;
  notas: string;
  direccionId: number | null;

  addItem: (product: Omit<CartItem, "cantidad">) => void;
  addItemWithQuantity: (product: Omit<CartItem, "cantidad">, cantidad: number) => void;
  updateQuantity: (productoId: number, cantidad: number) => void;
  removeItem: (productoId: number) => void;
  clear: () => void;
  setDireccion: (direccion: string) => void;
  setBarrio: (barrio: string) => void;
  setNotas: (notas: string) => void;
  setDireccionId: (id: number | null) => void;
  updatePrices: (map: Map<number, number>) => void;
  updateStocks: (map: Map<number, number>) => void;

  // Computed
  getTotal: () => number;
  getItemCount: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      direccion: "",
      barrio: "",
      notas: "",
      direccionId: null,

      addItem: (product) => {
        set((state) => {
          const existing = state.items.find(
            (i) => i.productoId === product.productoId
          );
          tracker.track('carrito_agregado', { producto_id: product.productoId, nombre: product.nombre, precio: product.precioUnitario });
          metaLogAddToCart(product.productoId, product.precioUnitario);
          if (existing) {
            // Respetar stockMaximo si ya lo conocemos
            const max = existing.stockMaximo ?? Infinity;
            const nueva = Math.min(existing.cantidad + 1, max);
            return {
              items: state.items.map((i) =>
                i.productoId === product.productoId
                  ? { ...i, cantidad: nueva, stockMaximo: product.stockMaximo ?? i.stockMaximo }
                  : i
              ),
            };
          }
          const max = product.stockMaximo ?? Infinity;
          return { items: [...state.items, { ...product, cantidad: Math.min(1, max) }] };
        });
      },

      addItemWithQuantity: (product, cantidad) => {
        set((state) => {
          const existing = state.items.find((i) => i.productoId === product.productoId);
          tracker.track('carrito_agregado', { producto_id: product.productoId, nombre: product.nombre, precio: product.precioUnitario, cantidad });
          metaLogAddToCart(product.productoId, product.precioUnitario);
          if (existing) {
            const max = existing.stockMaximo ?? product.stockMaximo ?? Infinity;
            const nueva = Math.min(existing.cantidad + cantidad, max);
            return {
              items: state.items.map((i) =>
                i.productoId === product.productoId
                  ? { ...i, cantidad: nueva, stockMaximo: product.stockMaximo ?? i.stockMaximo }
                  : i
              ),
            };
          }
          const max = product.stockMaximo ?? Infinity;
          return { items: [...state.items, { ...product, cantidad: Math.min(cantidad, max) }] };
        });
      },

      updateQuantity: (productoId, cantidad) => {
        set((state) => {
          if (cantidad <= 0) {
            tracker.track('carrito_eliminado', { producto_id: productoId });
            return { items: state.items.filter((i) => i.productoId !== productoId) };
          }
          tracker.track('carrito_cantidad_cambiada', { producto_id: productoId, cantidad_nueva: cantidad });
          return {
            items: state.items.map((i) => {
              if (i.productoId !== productoId) return i;
              const max = i.stockMaximo ?? Infinity;
              return { ...i, cantidad: Math.min(cantidad, max) };
            }),
          };
        });
      },

      removeItem: (productoId) => {
        tracker.track('carrito_eliminado', { producto_id: productoId });
        set((state) => ({
          items: state.items.filter((i) => i.productoId !== productoId),
        }));
      },

      clear: () => set({ items: [], notas: "", direccion: "", barrio: "", direccionId: null }),

      setDireccion: (direccion) => set({ direccion }),
      setBarrio: (barrio) => set({ barrio }),
      setNotas: (notas) => set({ notas }),
      setDireccionId: (id) => set({ direccionId: id }),

      updatePrices: (map) =>
        set((state) => ({
          items: state.items.map((i) => {
            const nuevo = map.get(i.productoId);
            return nuevo != null && nuevo !== i.precioUnitario ? { ...i, precioUnitario: nuevo } : i;
          }),
        })),

      updateStocks: (map) =>
        set((state) => ({
          items: state.items.flatMap((i) => {
            const nuevoStock = map.get(i.productoId);
            if (nuevoStock == null) return [i];
            if (nuevoStock <= 0) return [];
            const nuevaCantidad = Math.min(i.cantidad, nuevoStock);
            if (nuevaCantidad === i.cantidad && i.stockMaximo === nuevoStock) return [i];
            return [{ ...i, cantidad: nuevaCantidad, stockMaximo: nuevoStock }];
          }),
        })),

      getTotal: () =>
        get().items.reduce((sum, i) => sum + i.precioUnitario * i.cantidad, 0),

      getItemCount: () => get().items.reduce((sum, i) => sum + i.cantidad, 0),
    }),
    {
      name: "cart-storage",
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      migrate: (persistedState) => persistedState,
      // Solo persistir items — direccion y direccionId no se persisten para evitar
      // PII en AsyncStorage sin cifrar. El cliente reselecciona la dirección al abrir checkout.
      partialize: (state) => ({ items: state.items }),
    }
  )
);

// Sync silencioso al server cada vez que items cambia. Debounce 2s en cartSync.
// Si el cliente no tiene auth, apiFetch dispara el handler 401 (silent fail interno).
// Listener registrado al import del store — vive durante toda la sesion.
let _prevItemsRef: ReadonlyArray<CartItem> | null = null;
useCartStore.subscribe((state) => {
  if (state.items === _prevItemsRef) return;
  _prevItemsRef = state.items;
  debouncedSyncCart(state.items);
});

// Limpiar carrito en cualquier logout (manual o por 401) para evitar que
// el carrito de un usuario quede visible al siguiente en dispositivos compartidos.
registerLogoutHandler(() => {
  useCartStore.getState().clear();
});
