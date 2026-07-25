import { useQuery } from "@tanstack/react-query";
import { getMisLimites, getConfigApp } from "../lib/api";
import { useAuthStore } from "../stores/auth";

// Ventana por defecto si la config aún no cargó. El backend manda la real en
// /configuracion-app (configurable desde el admin); esto solo evita textos vacíos.
const VENTANA_FALLBACK = 7;

/**
 * Cupo restante del cliente para los productos con máximo por cliente.
 *
 * Los listados (inicio, buscar, categoría, ofertas) exponen el tope del producto pero
 * NO cuánto lleva ya el cliente — eso solo lo sabe la ficha. Sin este hook, un cliente
 * que ya agotó su cupo podía agregar al carrito desde cualquier card y solo se enteraba
 * del rechazo al tocar "Confirmar pedido".
 *
 * Una sola query compartida por todas las cards (React Query dedupea por queryKey).
 * Solo corre con sesión iniciada: sin cliente no hay consumo que consultar.
 */
export function useLimitesCliente() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const { data: limites } = useQuery({
    queryKey: ["mis-limites"],
    queryFn: getMisLimites,
    enabled: isAuthenticated,
    staleTime: 60_000,
  });

  const { data: config } = useQuery({
    queryKey: ["config-app"],
    queryFn: getConfigApp,
    staleTime: 5 * 60 * 1000,
  });

  return {
    /**
     * Unidades que el cliente todavía puede llevar de este producto, o `undefined`
     * si no lo sabemos (sin sesión, aún cargando, o el producto no tiene tope).
     * `undefined` = no aplicar cap por cupo; el tope del producto sigue vigente.
     */
    cupoDe: (productoId: number): number | undefined =>
      limites?.find((l) => l.producto_id === productoId)?.disponible,
    ventanaDias: config?.limite_ventana_dias ?? VENTANA_FALLBACK,
  };
}
