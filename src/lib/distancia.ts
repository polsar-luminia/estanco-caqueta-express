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

/**
 * Rumbo de `a` hacia `b`, en grados de brújula (0 = norte, 90 = este).
 *
 * Es el azimut inicial del gran círculo. A escala de ciudad la diferencia con
 * una recta plana es despreciable, pero la fórmula correcta cuesta lo mismo.
 */
export function rumboGrados(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLng = rad(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(rad(b.lat));
  const x =
    Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) -
    Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(dLng);
  return (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360;
}

/**
 * Hacia dónde apunta la moto DIBUJADA, en la imagen sin rotar (0 = arriba).
 *
 * El render es en perspectiva 3/4, así que no hay un valor exacto: 340° salió de
 * medir el eje de la silueta y contrastarlo mirando la imagen rotada contra una
 * flecha vertical. Si en el mapa se ve torcida, este es el único número que hay
 * que mover.
 */
export const MOTO_APUNTA_A = 340;

/** Cuánto rotar la imagen para que la moto mire hacia `rumbo`. */
export function rotacionMoto(rumbo: number): number {
  return (rumbo - MOTO_APUNTA_A + 360) % 360;
}

/**
 * Rumbo nuevo solo si de verdad se movió.
 *
 * Con puntos cada pocos segundos y el error normal del GPS, dos lecturas casi
 * iguales producen un rumbo aleatorio: la moto giraría sola en un semáforo. Por
 * debajo del umbral se conserva el rumbo anterior, que es lo que se ve natural.
 */
export const MOVIMIENTO_MINIMO_M = 15;

export function rumboSiSeMovio(
  anterior: { lat: number; lng: number } | null,
  actual: { lat: number; lng: number },
  rumboPrevio: number | null,
  destino: { lat: number; lng: number } | null,
): number | null {
  if (anterior && distanciaMetros(anterior, actual) >= MOVIMIENTO_MINIMO_M) {
    return rumboGrados(anterior, actual);
  }
  if (rumboPrevio != null) return rumboPrevio;
  // Todavía no hay recorrido del cual deducir el rumbo: se apunta hacia la casa,
  // que es la mejor conjetura y nunca se ve arbitrario.
  return destino ? rumboGrados(actual, destino) : null;
}
