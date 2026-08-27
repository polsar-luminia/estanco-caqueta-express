// Filtrado de "Complementa tu pedido" (Rediseño canasta/checkout, plan §Parte
// 2 · 4). Función pura y separada del componente para poder probarla sin
// montar React Native — el orden de los pasos importa y es lo que se prueba.
import { filtrarProductosIOS } from "./iosFilters";
import type { Producto } from "./api";

const MAX_SUGERENCIAS = 8;
// Con menos de esto, un carril de una sola tarjeta se ve roto: mejor no
// mostrar la sección que mostrarla huérfana.
const MINIMO_PARA_MOSTRAR = 2;

/**
 * Elige el producto SEMILLA del carrito: el de mayor `precioUnitario`, no el
 * de mayor total de línea — el unitario es mejor señal de categoría (12
 * gaseosas no deben mandar sobre un ron). Empate: el primero insertado.
 */
export function elegirSemilla<T extends { productoId: number; precioUnitario: number }>(
  items: T[]
): number | null {
  if (items.length === 0) return null;
  return items.reduce((mejor, actual) => (
    actual.precioUnitario > mejor.precioUnitario ? actual : mejor
  ), items[0]).productoId;
}

/**
 * Filtra la respuesta cruda de GET /catalogo/sugerencias/:id para el carril
 * de la canasta. Orden, en este orden:
 * 1. Apple §1.4.3 (tabaco/vape) — mismo criterio que product/[id].tsx.
 * 2. Quitar lo que ya está en el carrito — el endpoint no lo sabe.
 * 3. Quitar sin stock — una sugerencia que no se puede agregar es peor que
 *    ninguna.
 * 4. Recortar a MAX_SUGERENCIAS.
 * Devuelve [] si el resultado queda por debajo de MINIMO_PARA_MOSTRAR: eso es
 * lo que el componente lee como "no renderizar la sección".
 */
export function filtrarSugerenciasCanasta(
  sugerenciasRaw: Producto[],
  idsEnCarrito: Set<number>
): Producto[] {
  const filtradas = filtrarProductosIOS(sugerenciasRaw)
    .filter((p) => !idsEnCarrito.has(p.id))
    .filter((p) => p.stock_total > 0)
    .slice(0, MAX_SUGERENCIAS);
  return filtradas.length >= MINIMO_PARA_MOSTRAR ? filtradas : [];
}
