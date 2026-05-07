// Sync silencioso del carrito al server cada vez que cambia.
// Server lo usa para detectar abandono y disparar push notification 'carrito_abandonado'.
//
// Debounce 2s para evitar spam de requests cuando el usuario edita rapido
// (agregar/remover varios items o ajustar cantidades).
// Silent fail: si el sync falla (sin auth, offline, server caido) no afecta UX.

import { apiFetch } from "./api";
import type { CartItem } from "../stores/cart";

let syncTimeout: ReturnType<typeof setTimeout> | null = null;

export function debouncedSyncCart(items: CartItem[]) {
  if (syncTimeout) clearTimeout(syncTimeout);
  syncTimeout = setTimeout(() => {
    void syncCartNow(items);
  }, 2000);
}

async function syncCartNow(items: CartItem[]) {
  try {
    await apiFetch("/carritos/sync", {
      method: "POST",
      body: JSON.stringify({
        items: items.map((i) => ({
          producto_id: i.productoId,
          cantidad: i.cantidad,
          precio_unitario: i.precioUnitario,
        })),
      }),
    });
  } catch {
    // Silent fail — sync best-effort, no afecta UX.
    // Casos esperados: cliente sin auth (apiFetch responde 401), offline, server timeout.
  }
}
