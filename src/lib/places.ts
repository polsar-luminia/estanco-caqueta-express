/**
 * Autocompletado de direcciones con Google Places.
 *
 * Es el tercer camino para poner una dirección, junto a "usar mi ubicación" y
 * "seleccionar en el mapa": el cliente escribe, elige una sugerencia, y el punto
 * queda puesto sin que tenga que arrastrar nada. Para mucha gente va a ser el más
 * rápido.
 *
 * DEGRADA SOLO: si no hay llave configurada, `placesDisponible` es false y las
 * funciones devuelven vacío. La pantalla simplemente no muestra sugerencias y los
 * otros dos caminos siguen funcionando igual. Así el código puede viajar en el
 * binario antes de que exista la llave, y se activa poniéndola sin recompilar
 * nada... salvo que la llave se lee del bundle, así que sí requiere build. Lo que
 * NO requiere es tocar código.
 *
 * Se acota a Colombia y se sesga hacia Florencia para que las sugerencias sean
 * útiles: sin eso, "Carrera 10" devuelve calles de todo el país.
 */

const KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY ?? "";

export const placesDisponible = KEY.length > 0;

// Centro de Florencia. El sesgo por ubicación es lo que hace que las primeras
// sugerencias sean del barrio del cliente y no de Bogotá.
const FLORENCIA = { lat: 1.6144, lng: -75.6062 };
const RADIO_M = 15000;

export interface SugerenciaDireccion {
  /** place_id de Google, necesario para pedir las coordenadas después. */
  id: string;
  /** "Carrera 10a C" */
  principal: string;
  /** "Florencia, Caquetá, Colombia" */
  secundaria: string;
}

/**
 * Busca direcciones que empiecen por lo que el cliente escribió.
 *
 * `sesion` agrupa las pulsaciones de una misma búsqueda con el detalle final;
 * Google cobra por sesión y no por tecla, así que sin esto el costo se dispara.
 */
export async function buscarDirecciones(
  texto: string,
  sesion: string,
  signal?: AbortSignal,
): Promise<SugerenciaDireccion[]> {
  if (!placesDisponible || texto.trim().length < 3) return [];

  const params = new URLSearchParams({
    input: texto.trim(),
    key: KEY,
    language: "es",
    components: "country:co",
    location: `${FLORENCIA.lat},${FLORENCIA.lng}`,
    radius: String(RADIO_M),
    sessiontoken: sesion,
  });

  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params}`,
      { signal },
    );
    const data = await res.json();
    if (data.status !== "OK") return [];
    return (data.predictions || []).slice(0, 5).map((p: any) => ({
      id: p.place_id,
      principal: p.structured_formatting?.main_text ?? p.description,
      secundaria: p.structured_formatting?.secondary_text ?? "",
    }));
  } catch {
    // Sin red o petición cancelada: no es un error que valga la pena mostrar.
    // El cliente puede seguir escribiendo o usar el mapa.
    return [];
  }
}

export interface DireccionResuelta {
  lat: number;
  lng: number;
  direccion: string;
}

/** Coordenadas de una sugerencia. Es lo que permite poner el pin sin arrastrar. */
export async function resolverDireccion(
  placeId: string,
  sesion: string,
): Promise<DireccionResuelta | null> {
  if (!placesDisponible) return null;

  const params = new URLSearchParams({
    place_id: placeId,
    key: KEY,
    language: "es",
    // Solo lo que se necesita: Google cobra por campo pedido.
    fields: "geometry/location,formatted_address,name",
    sessiontoken: sesion,
  });

  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?${params}`,
      {},
    );
    const data = await res.json();
    const loc = data?.result?.geometry?.location;
    if (data.status !== "OK" || !loc) return null;
    return {
      lat: loc.lat,
      lng: loc.lng,
      direccion: data.result.formatted_address || data.result.name || "",
    };
  } catch {
    return null;
  }
}
