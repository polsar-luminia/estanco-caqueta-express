/**
 * Identificador anónimo de instalación.
 *
 * Existe para poder medir el tramo que hoy es invisible: instaló → abrió →
 * navegó → se registró. Hasta ahora el backend exigía sesión para aceptar
 * eventos, así que todo el uso previo al registro se perdía.
 *
 * No es un identificador de dispositivo ni el IDFA/AAID: se genera aquí, vive en
 * AsyncStorage y desaparece al desinstalar. No requiere ATT en iOS, pero sí debe
 * estar declarado en la política de privacidad como identificador de analítica.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { nuevoUuidV4 } from './uuid';

const CLAVE = 'polo_device_id';

let cache: string | null = null;
let enVuelo: Promise<string> | null = null;

/**
 * Devuelve el id de instalación, creándolo la primera vez.
 * Las llamadas concurrentes comparten la misma promesa: sin esto, dos pantallas
 * arrancando a la vez generarían dos UUID y el segundo pisaría al primero.
 */
export async function obtenerDeviceId(): Promise<string> {
  if (cache) return cache;
  if (enVuelo) return enVuelo;

  enVuelo = (async () => {
    try {
      let id = await AsyncStorage.getItem(CLAVE);
      if (!id) {
        id = nuevoUuidV4();
        await AsyncStorage.setItem(CLAVE, id);
      }
      cache = id;
      return id;
    } catch {
      // Si el almacenamiento falla, se usa un id en memoria: se pierde al cerrar
      // la app, pero es preferible a quedarse sin poder reportar nada.
      cache = nuevoUuidV4();
      return cache;
    } finally {
      enVuelo = null;
    }
  })();

  return enVuelo;
}

/** Id ya cargado, o null si todavía no se ha resuelto. Para usos síncronos. */
export function deviceIdEnCache(): string | null {
  return cache;
}
