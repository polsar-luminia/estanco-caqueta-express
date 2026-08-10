// Decisión del age gate (Apple §1.4.3), extraída del layout para poder probarla.
//
// Existe por un bug real (08-ago-2026): de 93 aperturas del mapa de ubicación,
// 34 terminaron con el usuario expulsado a /edad-confirmar — los 34 dentro de
// los 30 minutos siguientes a registrarse. El mapa solo entrega el punto al
// tocar "Confirmar", así que cada expulsión botaba el pin en silencio y el
// pedido salía sin coordenadas.

// Rutas exentas del age gate.
//
// `(auth)` es el grupo de autenticación (login, registro, confirmar edad, y la
// dirección del onboarding). `ubicacion` va aparte porque el mapa vive en la
// raíz (`app/ubicacion.tsx`), no dentro del grupo: al abrirlo desde el
// onboarding, `segments[0]` deja de ser "(auth)" y el guard lo alcanzaba.
//
// Dejarlo pasar no abre ningún hueco de la §1.4.3: el mapa no muestra producto,
// no tiene precios y no permite comprar. Es una pantalla de dirección.
export const RUTAS_EXENTAS_EDAD = ["(auth)", "ubicacion"];

/**
 * ¿Hay que mandar a esta persona a confirmar su edad?
 *
 * `edadConfirmada` llega como `cliente?.edad_confirmada`, así que vale
 * `undefined` cuando el cliente TODAVÍA NO CARGÓ — no solo cuando la edad está
 * sin confirmar. La versión vieja usaba `!edadConfirmada` y trataba los dos
 * casos igual: durante cualquier hueco en que `cliente` fuera null (el registro
 * recién hecho, un `hydrate` que falla por red) el guard expulsaba a quien sí
 * había confirmado.
 *
 * Por eso se exige el `false` explícito: en la duda NO se redirige. El riesgo
 * de esperar es que alguien vea el catálogo un instante de más; el de redirigir
 * de sobra es echar a un usuario legítimo de una pantalla a medio llenar.
 */
export function debeConfirmarEdad(
  rutaActual: string | undefined,
  edadConfirmada: boolean | undefined,
): boolean {
  if (edadConfirmada !== false) return false;
  if (!rutaActual) return false;
  return !RUTAS_EXENTAS_EDAD.includes(rutaActual);
}
