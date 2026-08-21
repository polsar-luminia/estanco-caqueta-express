import { useRouter } from "expo-router";
import * as Location from "expo-location";
import { useUbicacionPicker } from "../stores/ubicacionPicker";
import type { UbicacionCapturada } from "../lib/api";

// Del punto que ya se tiene solo interesan las coordenadas. Exigir el
// `UbicacionCapturada` completo obligaria a quien edita una direccion guardada a
// fabricar `metodo_ubicacion` y `precision_m` que no le constan.
type PuntoConocido = { lat?: number | null; lng?: number | null };

// Confirmación en el mapa como ÚLTIMO paso de guardar una dirección.
//
// POR QUE: de 283 pedidos, 96 (34%) no tienen ni una coordenada — no sabemos
// dónde se dejaron. La causa no es que la gente no quiera dar su ubicación: es
// que escribe la dirección, ve el botón verde de continuar justo debajo y hace
// lo obvio, sin tocar las sugerencias (que hasta hoy eran texto plano, sin nada
// que dijera "elígeme").
//
// Arreglar las sugerencias ayuda pero no alcanza: siempre habrá direcciones de
// Florencia que Google no conoce, y esa gente quedaría igual sin coordenadas. El
// mapa es lo único que funciona SIEMPRE — sin permiso, sin cobertura de Google y
// sin señal buena. Por eso el punto no se pide: se confirma.
//
// Para quien ya trae punto (GPS o sugerencia) esto es un toque: el pin abre
// puesto en el lugar correcto y solo hay que decir que sí.

// Centro de la zona de reparto: último recurso cuando no hay nada mejor. No
// pretende acertar, solo poner el mapa en Florencia en vez de en medio del mar.
export const FLORENCIA = { lat: 1.6144, lng: -75.6062 };

/**
 * Mejor punto de partida para el pin, en orden de confianza:
 *   1. el que ya tenemos (GPS o sugerencia elegida) — es el bueno;
 *   2. geocodificar el texto con el geocoder DEL SISTEMA (sin llave, sin costo
 *      y sin endpoint nuevo; si no acierta, no pasa nada);
 *   3. el centro de la zona.
 * Nunca lanza: cualquier fallo simplemente cae al siguiente escalón.
 */
export async function puntoDePartida(
  texto: string,
  conocida: PuntoConocido | null,
): Promise<{ lat: number; lng: number }> {
  if (conocida?.lat != null && conocida?.lng != null) {
    return { lat: conocida.lat, lng: conocida.lng };
  }
  const q = texto.trim();
  if (q.length >= 5) {
    try {
      const r = await Location.geocodeAsync(`${q}, Florencia, Caquetá, Colombia`);
      const p = r?.[0];
      if (p?.latitude != null && p?.longitude != null) {
        return { lat: p.latitude, lng: p.longitude };
      }
    } catch {
      // El geocoder del sistema es un lujo, no un requisito.
    }
  }
  return FLORENCIA;
}

/**
 * Devuelve `confirmar(texto, ubicacionConocida, alConfirmar)`.
 *
 * `alConfirmar` recibe la ubicación YA confirmada por la persona en el mapa, y
 * es donde el llamador guarda. Si cierra el mapa sin confirmar, no se llama y no
 * se guarda nada — que es lo correcto: sin punto confirmado no hay dirección.
 */
export function useConfirmarUbicacion() {
  const router = useRouter();
  const abrirPicker = useUbicacionPicker((s) => s.abrir);

  return async (
    texto: string,
    conocida: PuntoConocido | null,
    alConfirmar: (u: UbicacionCapturada) => void,
  ) => {
    const inicial = await puntoDePartida(texto, conocida);
    abrirPicker((u) => alConfirmar(u), inicial);
    router.push("/ubicacion");
  };
}
