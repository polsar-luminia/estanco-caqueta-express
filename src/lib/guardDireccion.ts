// Decisión del muro de dirección inicial (bandera `direccion_obligatoria_registro`).
//
// POR QUE EXISTE UN GUARD Y NO BASTA QUITAR EL BOTON: hasta hoy la pantalla de
// dirección inicial tiene UNA sola entrada en todo el código —el `router.replace`
// de edad-confirmar— y la edad se confirma una sola vez en la vida de la cuenta.
// O sea que matar la app en esa pantalla es una salida perfectamente válida: al
// reabrir se cae en el catálogo y nadie vuelve a pedir la dirección jamás.
// Comprobado en el simulador el 20-ago-2026. Un muro con esa salida no es muro.
//
// Vive aparte y con pruebas por la misma razón que `guardEdad.ts`: la regla de la
// edad llegó a estar copiada en CUATRO archivos y cada arreglo parchaba una sola
// copia. Una decisión, un sitio.

/**
 * ¿Hay que mandar a esta persona a poner su dirección antes de dejarla seguir?
 *
 * Las tres primeras comprobaciones son las que evitan tumbar pantallas ajenas;
 * las dos últimas, las que evitan expulsar a quien no corresponde.
 *
 * `segmentos[0] !== grupo` — en expo-router los layouts NO se desmontan al
 * navegar a otro grupo y `useSegments()` es global, así que un layout de fondo
 * que redirige destruye la pantalla que está encima. Fue el bug del 17-ago, que
 * mordió dos veces el mismo día: la dirección del onboarding se escribía, la
 * persona abría el mapa (`app/ubicacion.tsx`, que vive en la raíz) y el layout de
 * `(tabs)` la expulsaba con el formulario lleno. Aquí el riesgo es idéntico y
 * peor, porque esta pantalla ES un formulario de dirección que manda al mapa.
 *
 * `tieneDireccion` llega como `cliente?.tiene_direccion`, así que vale
 * `undefined` mientras el perfil no ha cargado — que NO es lo mismo que "no
 * tiene". Se exige el `false` explícito: en la duda no se redirige. Mandar de
 * sobra a alguien que sí tiene dirección lo saca de donde esté para pedirle algo
 * que ya dio.
 *
 * `edadConfirmada !== true` — el age gate va primero. Sin esto los dos guards se
 * disputan la misma navegación y la persona rebota entre las dos pantallas.
 */
export function debeExigirDireccionInicial(
  segmentos: string[],
  grupo: string,
  isAuthenticated: boolean,
  clienteCargado: boolean,
  edadConfirmada: boolean | undefined,
  tieneDireccion: boolean | undefined,
  banderaActiva: boolean | undefined,
): boolean {
  // La bandera nace apagada: sin ella, cero cambio de comportamiento.
  if (banderaActiva !== true) return false;
  if (!isAuthenticated) return false;
  if (segmentos[0] !== grupo) return false;
  if (!clienteCargado) return false;
  // El age gate manda primero.
  if (edadConfirmada !== true) return false;
  return tieneDireccion === false;
}
