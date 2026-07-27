/**
 * Autocompletado de direcciones con Google Places API (New).
 *
 * Es el tercer camino para poner una dirección, junto a "usar mi ubicación" y
 * "seleccionar en el mapa": el cliente escribe, elige una sugerencia, y el punto
 * queda puesto sin que tenga que arrastrar nada. Para mucha gente va a ser el más
 * rápido.
 *
 * SE USA LA API NUEVA (places.googleapis.com), no la clásica
 * (maps.googleapis.com/maps/api/place). Google dejó de habilitar la clásica para
 * proyectos nuevos, así que en una cuenta creada hoy la vieja ni siquiera aparece
 * como activable. Cambian el host, el método (POST en vez de GET), la
 * autenticación (header en vez de query param) y la forma de la respuesta.
 *
 * DEGRADA SOLO: si no hay llave configurada, `placesDisponible` es false y las
 * funciones devuelven vacío. La pantalla no muestra sugerencias y los otros dos
 * caminos siguen funcionando igual.
 *
 * Se acota a Colombia y se sesga hacia Florencia para que las sugerencias sean
 * útiles: sin eso, "Carrera 10" devuelve calles de todo el país.
 */

const KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY ?? "";

export const placesDisponible = KEY.length > 0;

// Centro de Florencia. El sesgo por ubicación es lo que hace que las primeras
// sugerencias sean del barrio del cliente y no de Bogotá.
const FLORENCIA = { latitude: 1.6144, longitude: -75.6062 };
const RADIO_M = 15000;

const BASE = "https://places.googleapis.com/v1";

export interface SugerenciaDireccion {
  /** Id del lugar, necesario para pedir las coordenadas después. */
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

  try {
    const res = await fetch(`${BASE}/places:autocomplete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // La API nueva autentica por header, no por query param.
        "X-Goog-Api-Key": KEY,
      },
      body: JSON.stringify({
        input: texto.trim(),
        languageCode: "es",
        regionCode: "CO",
        includedRegionCodes: ["co"],
        locationBias: {
          circle: { center: FLORENCIA, radius: RADIO_M },
        },
        sessionToken: sesion,
      }),
      signal,
    });
    if (!res.ok) return [];
    const data = await res.json();

    return (data.suggestions || [])
      .map((s: any) => s.placePrediction)
      .filter(Boolean)
      .slice(0, 5)
      .map((p: any) => ({
        id: p.placeId,
        principal: p.structuredFormat?.mainText?.text ?? p.text?.text ?? "",
        secundaria: p.structuredFormat?.secondaryText?.text ?? "",
      }))
      .filter((s: SugerenciaDireccion) => s.id && s.principal);
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

  const params = new URLSearchParams({ languageCode: "es", sessionToken: sesion });

  try {
    const res = await fetch(`${BASE}/places/${encodeURIComponent(placeId)}?${params}`, {
      headers: {
        "X-Goog-Api-Key": KEY,
        // Obligatorio en la API nueva, y además es lo que acota el cobro: Google
        // factura por los campos que se piden. Pedir de más sale caro sin dar nada.
        "X-Goog-FieldMask": "location,formattedAddress,displayName",
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const loc = data?.location;
    if (!loc || typeof loc.latitude !== "number") return null;

    return {
      lat: loc.latitude,
      lng: loc.longitude,
      direccion: data.formattedAddress || data.displayName?.text || "",
    };
  } catch {
    return null;
  }
}
