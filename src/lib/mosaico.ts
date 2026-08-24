// Acomoda las categorias del inicio en una cuadricula de celdas, donde cada
// una puede ocupar varias columnas y varias filas.
//
// POR QUE ES UNA FUNCION APARTE Y NO ESTA DENTRO DEL COMPONENTE: es la unica
// parte del mosaico que se puede equivocar en silencio. Una tarjeta mal
// colocada no lanza ningun error — se pinta encima de otra, o deja un hueco, y
// eso solo se descubre mirando la pantalla en el telefono correcto. Aca se
// prueba con casos exactos y sin renderizar nada.
//
// POR QUE FLEXBOX NO ALCANZA: `flexWrap` coloca las tarjetas una tras otra y
// ajusta la altura de cada renglon a la mas alta. Con una tarjeta de dos filas
// al lado de dos de una, flexbox no sabe meter la segunda pequena debajo de la
// primera: deja el hueco. Eso es exactamente el primer diseno que pidio el
// dueno. Por eso se calculan posiciones y se pintan en absoluto.

export interface ItemMosaico {
  id: number;
  mosaico_ancho?: number | null;
  mosaico_alto?: number | null;
}

export interface Celda<T> {
  item: T;
  col: number;   // columna de inicio, base 0
  fila: number;  // fila de inicio, base 0
  ancho: number; // columnas que ocupa
  alto: number;  // filas que ocupa
}

export interface Acomodo<T> {
  celdas: Celda<T>[];
  filas: number; // alto total de la cuadricula, en filas
}

/** Encierra el valor entre 1 y el tope. Cualquier basura (null, texto, 0, 9) cae en 1. */
function normalizar(v: unknown, tope: number): number {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, tope);
}

/**
 * Coloca cada item en la primera posicion libre, de arriba hacia abajo y de
 * izquierda a derecha.
 *
 * EL ORDEN NO SE RESPETA A RAJATABLA, y es deliberado. Si una tarjeta ancha no
 * cabe en lo que queda del renglon, se baja al siguiente, y una tarjeta chica
 * posterior SI puede ocupar el hueco que dejo. O sea que una categoria puede
 * aparecer antes que otra que iba delante en la lista.
 *
 * La alternativa —respetar el orden a ciegas— deja huecos blancos en mitad de
 * la cuadricula. Un hueco se lee como un error de la app; un adelanto de una
 * posicion no lo nota nadie. Y quien quiera el orden exacto lo consigue igual:
 * poniendo tamanos que sumen renglones completos.
 */
export function acomodarMosaico<T extends ItemMosaico>(
  items: T[],
  columnas = 4,
): Acomodo<T> {
  const celdas: Celda<T>[] = [];
  // Matriz de ocupacion. Crece sola: no se puede saber cuantas filas hacen
  // falta antes de colocar, porque depende de los tamanos.
  const ocupado: boolean[][] = [];

  const filaLibre = (f: number) => {
    while (ocupado.length <= f) ocupado.push(new Array(columnas).fill(false));
    return ocupado[f];
  };

  const cabe = (fila: number, col: number, ancho: number, alto: number) => {
    if (col + ancho > columnas) return false;
    for (let f = fila; f < fila + alto; f++) {
      const r = filaLibre(f);
      for (let c = col; c < col + ancho; c++) if (r[c]) return false;
    }
    return true;
  };

  for (const item of items) {
    const ancho = normalizar(item.mosaico_ancho, columnas);
    const alto = normalizar(item.mosaico_alto, 2);

    let colocado = false;
    for (let fila = 0; !colocado; fila++) {
      for (let col = 0; col + ancho <= columnas; col++) {
        if (!cabe(fila, col, ancho, alto)) continue;
        for (let f = fila; f < fila + alto; f++) {
          const r = filaLibre(f);
          for (let c = col; c < col + ancho; c++) r[c] = true;
        }
        celdas.push({ item, col, fila, ancho, alto });
        colocado = true;
        break;
      }
    }
  }

  // El alto real es la ultima fila con algo, no `ocupado.length`: buscar sitio
  // para una tarjeta crea filas vacias de sondeo que no hay que pintar.
  let filas = 0;
  for (const c of celdas) filas = Math.max(filas, c.fila + c.alto);
  return { celdas, filas };
}

/**
 * Geometria en puntos a partir del acomodo. Se calcula con el ancho REAL de la
 * pantalla y no con una constante: la app se usa en telefonos de 320 dp y
 * tambien rotada, y un ancho congelado deja la ultima columna cortada.
 */
export function medidasCelda(
  anchoPantalla: number,
  columnas = 4,
  margen = 32,
  separacion = 10,
  altoTexto = 36,
) {
  const celda = (anchoPantalla - margen - separacion * (columnas - 1)) / columnas;
  // El paso VERTICAL no es igual al horizontal, y ahi esta la sutileza de esta
  // pantalla: el nombre de la categoria va DEBAJO de la baldosa, sobre el fondo
  // blanco, no encima de la foto. Asi que cada fila mide la baldosa mas el
  // renglon del nombre. Si el paso vertical fuera solo `celda`, los nombres se
  // montarian sobre la baldosa de la fila siguiente.
  //
  // `altoTexto` es fijo (dos renglones de 15 mas 6 de separacion) y no medido:
  // con altos variables, dos tarjetas vecinas de la misma fila arrancarian a
  // distinta altura segun cuanto ocupe su nombre. Un nombre de un solo renglon
  // deja aire de sobra; una fila descuadrada se ve rota.
  const pasoY = celda + altoTexto + separacion;
  return {
    celda,
    separacion,
    altoTexto,
    pasoY,
    // Ancho en puntos de una tarjeta que ocupa `n` columnas: las celdas que
    // abarca MAS las separaciones que se traga por dentro.
    tramo: (n: number) => celda * n + separacion * (n - 1),
    // Alto TOTAL de una tarjeta de `n` filas, nombre incluido.
    tramoY: (n: number) => pasoY * n - separacion,
    // Alto de la parte de imagen: lo mismo, menos el renglon del nombre.
    tramoImagen: (n: number) => pasoY * n - separacion - altoTexto,
    // Alto total de la cuadricula de `filas` filas.
    altoTotal: (filas: number) => (filas > 0 ? pasoY * filas - separacion : 0),
  };
}
