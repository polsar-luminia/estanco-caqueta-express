import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { getCoberturaZona, evaluarZonasCliente } from "../lib/api";

// Zona de reparto para validar puntos capturados FUERA del mapa: el buscador de
// Google y el botón de GPS ponían el pin sin mirar la zona, y por ahí entraron
// pedidos a 12 y 521 km (el mapa sí valida desde Fase 2 — app/ubicacion.tsx).
//
// Mismo queryKey que la pantalla del mapa: una sola descarga por sesión.
//
// Falla abierto a propósito: sin zona descargada (offline, servidor caído) no se
// bloquea nada, igual que hace el mapa. El servidor sigue siendo la autoridad y
// marca `fuera_zona` al guardar.
export function useZonaEntrega() {
  const { data: zona } = useQuery({
    queryKey: ["cobertura-zona"],
    queryFn: getCoberturaZona,
    staleTime: Infinity,
  });

  const fueraDeZona = useCallback(
    (lat: number, lng: number) => !evaluarZonasCliente(lat, lng, zona),
    [zona],
  );

  return { fueraDeZona };
}
