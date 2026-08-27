// Refetch de precio/stock/cupo del carrito. Vive en las DOS pantallas del
// checkout (Rediseño canasta/checkout, plan §Parte 2): si solo corriera en
// la canasta, el precio que se ve en el checkout divergiría del que cobra el
// servidor (el backend cobra el precio actual, así que es divergencia
// visual), y un stock viejo dejaría rebotar POST /pedidos DESPUÉS de tocar
// Confirmar. staleTime: 0 lo refresca al entrar a cada pantalla — el momento
// que importa — y el focusManager de app/_layout.tsx lo refresca al volver
// de background.
import { useEffect } from "react";
import { useQueries } from "@tanstack/react-query";
import { useCartStore } from "../stores/cart";
import { getProducto } from "../lib/api";

export function useRefrescoCarrito() {
  const items = useCartStore((s) => s.items);
  const updatePrices = useCartStore((s) => s.updatePrices);
  const updateStocks = useCartStore((s) => s.updateStocks);
  const updateLimites = useCartStore((s) => s.updateLimites);

  const productosCheck = useQueries({
    queries: items.map((i) => ({
      queryKey: ["producto", i.productoId] as const,
      queryFn: () => getProducto(i.productoId),
      staleTime: 0,
    })),
  });

  useEffect(() => {
    if (items.length === 0 || productosCheck.some((q) => q.isLoading)) return;
    const priceMap = new Map<number, number>();
    const stockMap = new Map<number, number>();
    const limitMap = new Map<number, number | null>();
    let huboCambioPrecio = false;
    let huboCambioStock = false;
    let huboCambioLimite = false;
    productosCheck.forEach((q, idx) => {
      if (q.data && items[idx]) {
        // M-CART-19: usar precio_vigente (con oferta aplicada) para no revertir
        // el precio de oferta al precio full. Fallback a precio_app si el backend
        // aún no expone el campo.
        // Number(): node-postgres devuelve los numeric como string ("19999.00"), y
        // comparar string vs number marcaría "cambió" en cada apertura del carrito.
        const nuevoPrecio = Number(q.data.precio_vigente ?? q.data.precio_app);
        const nuevoStock = Number(q.data.stock_total ?? 0);
        if (nuevoPrecio !== items[idx].precioUnitario) huboCambioPrecio = true;
        priceMap.set(items[idx].productoId, nuevoPrecio);
        const stockActual = items[idx].stockMaximo ?? Infinity;
        const cantidadActual = items[idx].cantidad;
        if (nuevoStock !== stockActual || nuevoStock < cantidadActual) huboCambioStock = true;
        stockMap.set(items[idx].productoId, nuevoStock);
        // Cupo por cliente: el refetch corre con sesión, así que trae limite_disponible.
        // Antes este dato llegaba y se botaba, y un carrito armado sin cap (p.ej. desde
        // Ofertas) nunca lo ganaba. null = el producto ya no tiene límite.
        const nuevoLimite = q.data.limite_disponible ?? q.data.max_unidades_por_cliente ?? null;
        if (nuevoLimite !== (items[idx].maxPorCliente ?? null)) huboCambioLimite = true;
        limitMap.set(items[idx].productoId, nuevoLimite);
      }
    });
    if (huboCambioPrecio) updatePrices(priceMap);
    if (huboCambioStock) updateStocks(stockMap);
    if (huboCambioLimite) updateLimites(limitMap);
    // Sin aviso. El carrito ya se refrescó solo y los precios y el stock que se ven
    // en pantalla son los nuevos: el toast no le pedía nada al cliente ni le
    // señalaba qué cambió, solo salía cada vez que se revalidaba —incluso al
    // agregar un producto, donde no había cambiado nada para el— y tapaba el
    // botón. Si algún dia hay que avisar de un cambio de precio, tiene que ser en
    // la linea del producto, no en una banda que se va sola.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productosCheck.map((q) => q.dataUpdatedAt).join(","), items.length]);
}
