// Filtros defensivos de contenido para iOS — Apple App Store Review §1.4.3.
//
// Apple no permite venta ni promoción de tabaco/vapes en su tienda. El backend
// debe filtrar primero (con el header X-Platform), pero estos helpers funcionan
// como segunda capa de defensa por si la respuesta del backend incluye un item
// prohibido por error (cache vencido, regresión, etc).
//
// Cualquier punto que renderice productos/categorías recibidos del backend
// debe usar `filtrarProductosIOS` / `filtrarCategoriasIOS` antes de pintar.
//
// ROBUSTEZ (Apple 2.1a — crash en búsqueda, build 6): toda función acepta
// null/undefined y arrays con items null sin lanzar. El crash de iPad fue un
// TypeError no capturado al desreferenciar un item null que llegó vía
// `pages.flatMap((p) => p.productos)` cuando el backend devolvió `productos`
// nulo/ausente para una página. Default-safe: entrada inválida → [].

import { Platform } from "react-native";

const PALABRAS_BLOQUEADAS_IOS = ["cigarr", "vape", "tabac", "cigarro"] as const;

export function esCategoriaProhibidaIOS(nombre: string | null | undefined): boolean {
  if (Platform.OS !== "ios") return false;
  if (!nombre || typeof nombre !== "string") return false;
  const low = nombre.toLowerCase();
  return PALABRAS_BLOQUEADAS_IOS.some((p) => low.includes(p));
}

export function filtrarCategoriasIOS<T extends { nombre?: string | null }>(
  items: T[] | null | undefined,
): T[] {
  if (!Array.isArray(items)) return [];
  if (Platform.OS !== "ios") return items;
  return items.filter((c) => c != null && !esCategoriaProhibidaIOS(c.nombre));
}

export function filtrarProductosIOS<T extends { categoria?: string | null; nombre?: string | null }>(
  items: T[] | null | undefined,
): T[] {
  if (!Array.isArray(items)) return [];
  if (Platform.OS !== "ios") return items;
  return items.filter(
    (p) =>
      p != null &&
      !esCategoriaProhibidaIOS(p.categoria ?? null) &&
      !esCategoriaProhibidaIOS(p.nombre ?? null),
  );
}

// Para ofertas/patrocinados/combos que envuelven un producto en {producto: {...}}
export function filtrarConProductoIOS<
  T extends { producto?: { categoria?: string | null; nombre?: string | null } | null },
>(items: T[] | null | undefined): T[] {
  if (!Array.isArray(items)) return [];
  if (Platform.OS !== "ios") return items;
  return items.filter((item) => {
    if (item == null) return false;
    const cat = item.producto?.categoria ?? null;
    const nom = item.producto?.nombre ?? null;
    return !esCategoriaProhibidaIOS(cat) && !esCategoriaProhibidaIOS(nom);
  });
}
