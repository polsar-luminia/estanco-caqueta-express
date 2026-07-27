/**
 * Bloqueo de versión — decisión pura (bloque G).
 *
 * REGLA ÚNICA, Y NO ES NEGOCIABLE: ante cualquier duda, NO se bloquea.
 *
 * Este es el único mecanismo de la app que puede dejar a alguien sin poder pedir.
 * Un falso positivo aquí no es un bug menor: es un cliente con la app inutilizada,
 * que además no tiene forma de reportarlo porque no puede pasar de esa pantalla.
 * Por eso cada rama ambigua devuelve `false`:
 *
 *   - no se pudo leer la configuración del servidor  → no bloquea
 *   - `version_minima` viene vacía o mal formada     → no bloquea
 *   - no se pudo leer la versión instalada           → no bloquea
 *   - la versión instalada no tiene forma x.y.z      → no bloquea
 *
 * Solo se bloquea cuando las dos versiones se leyeron bien Y la instalada es
 * estrictamente menor que el mínimo. Nada más.
 *
 * Nace dormido: el servidor devuelve '1.0.0' por defecto, que toda versión
 * instalada cumple. Activarlo es subir ese número a mano, y solo tiene sentido
 * cuando la versión nueva ya está viva en las dos tiendas — antes, la persona
 * vería la pantalla de "actualiza" sin tener a dónde actualizar.
 */

export function parseVersion(valor: unknown): [number, number, number] | null {
  if (typeof valor !== 'string') return null;
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(valor.trim());
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/**
 * ¿La versión instalada se quedó por debajo del mínimo exigido?
 *
 * @param instalada  Updates.runtimeVersion — sale del binario, no se puede falsear por OTA
 * @param minima     version_minima del servidor
 */
export function debeBloquear(instalada: unknown, minima: unknown): boolean {
  const vi = parseVersion(instalada);
  const vm = parseVersion(minima);
  // Cualquiera de las dos ilegible: no se bloquea. Es el caso de Expo Go, de un
  // servidor caído, y de cualquier cosa que no previmos.
  if (!vi || !vm) return false;

  for (let i = 0; i < 3; i++) {
    if (vi[i] > vm[i]) return false;
    if (vi[i] < vm[i]) return true;
  }
  // Iguales: la versión instalada cumple el mínimo.
  return false;
}
