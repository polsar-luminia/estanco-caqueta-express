import { create } from "zustand";
import { tracker } from "../lib/tracker";

export interface CartItem {
  productoId: number;
  nombre: string;
  precioUnitario: number;
  cantidad: number;
  imagenUrl?: string;
}

interface CartState {
  items: CartItem[];
  direccion: string;
  barrio: string;
  notas: string;

  addItem: (product: Omit<CartItem, "cantidad">) => void;
  addItemWithQuantity: (product: Omit<CartItem, "cantidad">, cantidad: number) => void;
  updateQuantity: (productoId: number, cantidad: number) => void;
  removeItem: (productoId: number) => void;
  clear: () => void;
  setDireccion: (direccion: string) => void;
  setBarrio: (barrio: string) => void;
  setNotas: (notas: string) => void;

  // Computed
  getTotal: () => number;
  getItemCount: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  direccion: "",
  barrio: "",
  notas: "",

  addItem: (product) => {
    set((state) => {
      const existing = state.items.find(
        (i) => i.productoId === product.productoId
      );
      tracker.track('carrito_agregado', { producto_id: product.productoId, nombre: product.nombre, precio: product.precioUnitario });
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.productoId === product.productoId
              ? { ...i, cantidad: i.cantidad + 1 }
              : i
          ),
        };
      }
      return { items: [...state.items, { ...product, cantidad: 1 }] };
    });
  },

  addItemWithQuantity: (product, cantidad) => {
    set((state) => {
      const existing = state.items.find((i) => i.productoId === product.productoId);
      tracker.track('carrito_agregado', { producto_id: product.productoId, nombre: product.nombre, precio: product.precioUnitario, cantidad });
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.productoId === product.productoId
              ? { ...i, cantidad: i.cantidad + cantidad }
              : i
          ),
        };
      }
      return { items: [...state.items, { ...product, cantidad }] };
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
        items: state.items.map((i) =>
          i.productoId === productoId ? { ...i, cantidad } : i
        ),
      };
    });
  },

  removeItem: (productoId) => {
    tracker.track('carrito_eliminado', { producto_id: productoId });
    set((state) => ({
      items: state.items.filter((i) => i.productoId !== productoId),
    }));
  },

  clear: () => set({ items: [], notas: "", direccion: "", barrio: "" }),

  setDireccion: (direccion) => set({ direccion }),
  setBarrio: (barrio) => set({ barrio }),
  setNotas: (notas) => set({ notas }),

  getTotal: () =>
    get().items.reduce((sum, i) => sum + i.precioUnitario * i.cantidad, 0),

  getItemCount: () => get().items.reduce((sum, i) => sum + i.cantidad, 0),
}));
