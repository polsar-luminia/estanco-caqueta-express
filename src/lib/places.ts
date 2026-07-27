/**
 * Autocompletado de direcciones.
 *
 * Es el tercer camino para poner el punto de entrega, junto a "usar mi ubicación"
 * y "seleccionar en el mapa": el cliente escribe, elige una sugerencia, y el pin
 * queda puesto sin arrastrar nada.
 *
 * LA LLAVE DE GOOGLE NO VIVE AQUÍ. Estas funciones llaman a nuestro propio
 * backend, que es quien habla con Google Places. La razón es de plata: una llave
 * de Places puesta en la app viaja dentro del binario en texto plano, y cualquiera
 * que descargue el apk o el ipa puede sacarla y gastar contra la cuenta. Peor:
 * Google solo admite UN tipo de restricción de aplicación por llave (o Android, o
 * iOS, o IPs), así que una llave usada desde las dos plataformas no se puede
 * restringir de ninguna forma. En el servidor sí — por IP del VPS.
 *
 * DEGRADA SOLO: si el backend no tiene llave configurada devuelve listas vacías.
 * La pantalla no muestra sugerencias, no da errores, y los otros dos caminos
 * siguen funcionando igual.
 */

import { apiFetch } from "./api";

export interface SugerenciaDireccion {
  /** Id del lugar, necesario para pedir las coordenadas después. */
  id: string;
  /** "Carrera 10a C" */
  principal: string;
  /** "Florencia, Caquetá" */
  secundaria: string;
}

/**
 * Busca direcciones que empiecen por lo que el cliente escribió.
 *
 * `sesion` agrupa las pulsaciones de una misma búsqueda con el detalle final:
 * Google cobra por sesión y no por tecla. El servidor la reenvía tal cual.
 */
export async function buscarDirecciones(
  texto: string,
  sesion: string,
  signal?: AbortSignal,
): Promise<SugerenciaDireccion[]> {
  const q = texto.trim();
  if (q.length < 3) return [];

  try {
    const qs = new URLSearchParams({ q, sesion });
    const r = await apiFetch<{ sugerencias: SugerenciaDireccion[] }>(
      `/places/autocomplete?${qs}`,
      { signal },
    );
    return r.sugerencias ?? [];
  } catch {
    // Sin red, sesión caída o petición cancelada: no vale la pena molestar al
    // cliente. Puede seguir escribiendo o usar el mapa.
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
  try {
    const qs = new URLSearchParams({ sesion });
    const r = await apiFetch<{ lugar: DireccionResuelta | null }>(
      `/places/detalle/${encodeURIComponent(placeId)}?${qs}`,
    );
    return r.lugar ?? null;
  } catch {
    return null;
  }
}
