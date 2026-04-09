import { useQuery } from "@tanstack/react-query";
import { getEstadoTienda } from "../lib/api";
import type { EstadoTienda } from "../lib/api";

export type { EstadoTienda };

// Fuente de verdad: el backend. Se refresca cada minuto.
export function useTiendaAbierta(): EstadoTienda {
  const { data } = useQuery({
    queryKey: ["tienda-estado"],
    queryFn: getEstadoTienda,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  // Mientras carga, asumir abierta para no bloquear la UI
  return data ?? { abierta: true, proximaApertura: "" };
}
