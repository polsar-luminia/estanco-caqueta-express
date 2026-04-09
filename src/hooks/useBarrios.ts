import { useQuery } from "@tanstack/react-query";
import { getBarrios } from "../lib/api";

export function useBarrios() {
  const { data: barrios = [], isLoading } = useQuery({
    queryKey: ["barrios"],
    queryFn: getBarrios,
    staleTime: 7 * 24 * 60 * 60 * 1000, // 7 días — la lista no cambia
    gcTime: Infinity,
  });

  return { barrios, isLoading };
}
