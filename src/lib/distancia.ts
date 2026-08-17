// Distancia entre dos puntos, en metros (fórmula del haversine).
//
// Es distancia EN LÍNEA RECTA, no por las calles: el recorrido real de una moto
// siempre es mayor. Por eso lo que se muestra al cliente dice "en línea recta" y
// nunca se convierte en un tiempo de llegada — de un dato aproximado no se puede
// sacar una promesa de minutos, y el cliente la leería como si lo fuera.

const RADIO_TIERRA_M = 6_371_000;

export function distanciaMetros(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * RADIO_TIERRA_M * Math.asin(Math.sqrt(s)));
}

/**
 * Redactado para que lo lea una persona, no un GPS.
 *
 * Por debajo de 100 m no se dan cifras: el punto tiene su propio error de unos
 * metros, así que decir "a 12 m" es precisión inventada. "Está llegando" es
 * verdad y además es lo único accionable a esa distancia.
 */
export function textoDistancia(metros: number): string {
  if (metros < 100) return "Está llegando";
  if (metros < 1000) return `A ${Math.round(metros / 10) * 10} m en línea recta`;
  return `A ${(metros / 1000).toFixed(1).replace(".", ",")} km en línea recta`;
}
