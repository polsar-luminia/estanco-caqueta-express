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
  // Máximo de unidades por cliente durante la oferta activa. undefined = sin límite.
  maxPorCliente?: number;
}

// Cap efectivo de un ítem: el menor entre el stock disponible y el máximo por
// cliente (cuando aplica). Enforcea ambos límites con una sola cuenta.
// Exportada porque la UI (CartItem) necesita el MISMO número para decidir si el
// botón "+" va deshabilitado: si la UI solo mira el stock, el tap llega al store,
// el store lo clampa y el usuario ve un botón activo que no hace nada.
export const capEfectivo = (stockMaximo?: number, maxPorCliente?: number) =>
  Math.min(stockMaximo ?? Infinity, maxPorCliente ?? Infinity);

interface CartState {
  items: CartItem[];
  direccion: string;
  barrio: string;
  notas: string;
  direccionId: number | null;

  // `origen` es SOLO telemetria y por eso va como argumento aparte y no dentro
  // del producto: si viajara dentro, el spread lo guardaria en el item y quedaria
  // persistido en el carrito del telefono para siempre.
  addItem: (product: Omit<CartItem, "cantidad">, origen?: { carril: string; posicion: number }) => void;
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
  updateLimites: (map: Map<number, number | null>) => void;

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

      addItem: (product, origen) => {
        set((state) => {
          // M-CART-20: no agregar productos agotados. Defensa en el store además
          // del botón deshabilitado en la UI (evita item fantasma cantidad 0).
          if ((product.stockMaximo ?? Infinity) <= 0) return state;
          const existing = state.items.find(
            (i) => i.productoId === product.productoId
          );
          tracker.track('carrito_agregado', {
            producto_id: product.productoId,
            nombre: product.nombre,
            precio: product.precioUnitario,
            ...(origen ? { origen: origen.carril, posicion: origen.posicion } : {}),
          });
          metaLogAddToCart(product.productoId, product.precioUnitario);
          if (existing) {
            // Respetar stock y máximo por cliente si ya los conocemos
            const max = capEfectivo(existing.stockMaximo, product.maxPorCliente ?? existing.maxPorCliente);
            const nueva = Math.min(existing.cantidad + 1, max);
            return {
              items: state.items.map((i) =>
                i.productoId === product.productoId
                  ? { ...i, cantidad: nueva, stockMaximo: product.stockMaximo ?? i.stockMaximo, maxPorCliente: product.maxPorCliente ?? i.maxPorCliente }
                  : i
              ),
            };
          }
          const max = capEfectivo(product.stockMaximo, product.maxPorCliente);
          return { items: [...state.items, { ...product, cantidad: Math.min(1, max) }] };
        });
      },

      addItemWithQuantity: (product, cantidad) => {
        set((state) => {
          // M-CART-20: no agregar productos agotados (ver addItem).
          if ((product.stockMaximo ?? Infinity) <= 0) return state;
          const existing = state.items.find((i) => i.productoId === product.productoId);
          tracker.track('carrito_agregado', { producto_id: product.productoId, nombre: product.nombre, precio: product.precioUnitario, cantidad });
          metaLogAddToCart(product.productoId, product.precioUnitario);
          if (existing) {
            const max = capEfectivo(product.stockMaximo ?? existing.stockMaximo, product.maxPorCliente ?? existing.maxPorCliente);
            const nueva = Math.min(existing.cantidad + cantidad, max);
            return {
              items: state.items.map((i) =>
                i.productoId === product.productoId
                  ? { ...i, cantidad: nueva, stockMaximo: product.stockMaximo ?? i.stockMaximo, maxPorCliente: product.maxPorCliente ?? i.maxPorCliente }
                  : i
              ),
            };
          }
          const max = capEfectivo(product.stockMaximo, product.maxPorCliente);
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
              const max = capEfectivo(i.stockMaximo, i.maxPorCliente);
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

      // Refresca el cupo por cliente de los ítems del carrito y re-clampa la cantidad.
      // El carrito se persiste en AsyncStorage y puede haberse armado desde una pantalla
      // que no conocía el cupo (o antes de que el cliente gastara parte de él), así que
      // sin esto un ítem podía quedar con una cantidad que el checkout va a rechazar.
      // `null` en el mapa = el producto ya no tiene límite (se le quitó desde el admin).
      updateLimites: (map) =>
        set((state) => ({
          items: state.items.flatMap((i) => {
            if (!map.has(i.productoId)) return [i];
            const nuevoMax = map.get(i.productoId) ?? undefined;
            const nuevaCantidad = Math.min(i.cantidad, capEfectivo(i.stockMaximo, nuevoMax));
            // Cupo agotado: el ítem no puede ir en este pedido. Se saca del carrito,
            // igual que hace updateStocks con un producto sin stock.
            if (nuevaCantidad <= 0) return [];
            if (nuevaCantidad === i.cantidad && i.maxPorCliente === nuevoMax) return [i];
            return [{ ...i, cantidad: nuevaCantidad, maxPorCliente: nuevoMax }];
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
