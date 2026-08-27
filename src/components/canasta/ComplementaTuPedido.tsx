// "Complementa tu pedido" (Rediseño canasta/checkout, plan §Parte 2 · 5).
//
// Fuente: GET /catalogo/sugerencias/:id, que YA EXISTE — sugiere por
// categoría, no por co-ocurrencia real. No se construye un endpoint de
// "comprados juntos" todavía: con ~250 pedidos históricos la señal sería
// pobre para justificar el índice nuevo sobre lineas_pedido + su caché. Se
// mide primero (complementa_mostrado + carrito_agregado{origen:'complementa_pedido'});
// si el carril convierte, ahí se construye el dato real.
//
// Sin skeleton y sin espacio reservado: CarrilProductos ya devuelve null con
// lista vacía. Un skeleton que aparece y desaparece empuja el pie de la
// canasta debajo del dedo que va hacia "Continuar". Si el endpoint falla,
// data queda undefined -> [] -> la sección simplemente no se dibuja: es una
// hoja del árbol, no puede tumbar la canasta.
import { useEffect, useMemo, useRef } from "react";
import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { getSugerencias } from "../../lib/api";
import { elegirSemilla, filtrarSugerenciasCanasta } from "../../lib/sugerenciasCanasta";
import { CarrilProductos } from "../CarrilProductos";
import { tracker } from "../../lib/tracker";
import { colors, fuentes } from "../../constants/theme";
import type { CartItem } from "../../stores/cart";

interface Props {
  items: CartItem[];
}

export function ComplementaTuPedido({ items }: Props) {
  const router = useRouter();
  const seedId = useMemo(() => elegirSemilla(items), [items]);

  // Misma queryKey que app/product/[id].tsx: si el cliente viene de esa
  // ficha, el carril pinta instantáneo desde caché.
  const { data: sugerenciasRaw } = useQuery({
    queryKey: ["sugerencias", seedId],
    queryFn: () => getSugerencias(seedId as number),
    enabled: seedId != null,
    staleTime: 5 * 60 * 1000,
    retry: 1,
    placeholderData: (prev) => prev,
  });

  const idsEnCarrito = useMemo(() => new Set(items.map((i) => i.productoId)), [items]);
  const sugerencias = useMemo(
    () => filtrarSugerenciasCanasta(sugerenciasRaw ?? [], idsEnCarrito),
    [sugerenciasRaw, idsEnCarrito]
  );

  // complementa_mostrado: una vez por seed_id por visita — no en cada render.
  const reportadoRef = useRef<number | null>(null);
  useEffect(() => {
    if (seedId == null || sugerencias.length === 0) return;
    if (reportadoRef.current === seedId) return;
    reportadoRef.current = seedId;
    tracker.track(
      'complementa_mostrado',
      { seed_id: seedId, n_sugerencias: sugerencias.length, items_count: items.length },
      'cart'
    );
  }, [seedId, sugerencias.length, items.length]);

  if (sugerencias.length === 0) return null;

  return (
    <View>
      {/* Título y subtítulo propios: CarrilProductos no tiene slot de
          subtítulo, y el copy NO puede decir "personas con tu mismo pedido
          agregaron" — el endpoint sugiere por categoría, no por
          co-ocurrencia real, y esa frase sería falsa hasta que exista el
          dato (ver cabecera del archivo). titulo={null} apaga el título
          interno de CarrilProductos para no duplicarlo. */}
      <View style={{ paddingHorizontal: 16, marginBottom: -8 }}>
        <Text style={{ fontFamily: fuentes.titulo, fontSize: 30, color: colors.ink }} numberOfLines={1}>
          Complementa tu pedido
        </Text>
        <Text style={{ fontFamily: fuentes.destacado, fontSize: 13, color: "#6D7B6C", marginTop: 2 }}>
          Suele pedirse junto a esto
        </Text>
      </View>
      <CarrilProductos
        titulo={null}
        productos={sugerencias}
        onPressProducto={(id) => router.push(`/product/${id}`)}
        origen="complementa_pedido"
        pantalla="cart"
      />
    </View>
  );
}
