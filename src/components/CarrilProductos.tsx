// Carril horizontal de productos con "Mostrar mas".
//
// ES LA PIEZA NUEVA MAS IMPORTANTE DEL REDISENO. No existia ningun carril
// reusable en la app: el inicio tenia uno escrito a mano en el JSX para los
// combos, con su propia tarjeta, su propio formato de precio y su propio manejo
// de imagen — y sin carrito, sin limites por cliente y sin estado agotado. Cada
// vez que hacia falta otro carril, se copiaba. Aqui hay UNO y usa ProductCard,
// asi que todo eso lo hereda gratis.
//
// TAMPOCO EXISTIA NINGUN "Mostrar mas" en toda la app (busqueda exhaustiva: 0
// resultados). Habia un "Ver todas" en Categorias y nada mas.

import { View, Text, Pressable, FlatList } from "react-native";
import { Feather } from "@expo/vector-icons";
import { ProductCard } from "./ProductCard";
import { colors, medidas } from "../constants/theme";
import { tracker } from "../lib/tracker";
import type { ProductoEnCarril } from "../lib/api";

interface Props {
  titulo: string | null;
  productos: ProductoEnCarril[];
  // Que se hace al tocar "Mostrar mas". Sin esto no se dibuja el boton: un
  // boton que no lleva a ningun lado es peor que no tenerlo.
  onVerMas?: () => void;
  onPressProducto: (id: number) => void;
  // Identifica el carril en la telemetria (titulo o tipo de seccion).
  origen: string;
  // Para el evento de "Mostrar mas". Opcional: los carriles de la pantalla de
  // categoria no vienen de una fila de secciones_inicio.
  seccionId?: number;
  destinoVerMas?: string;
  pantalla: string;
}

export function CarrilProductos({
  titulo, productos, onVerMas, onPressProducto, origen, seccionId, destinoVerMas, pantalla,
}: Props) {
  // Un carril vacio no se dibuja. El servidor ya descarta las secciones sin
  // items, pero la pantalla de categoria arma carriles por su cuenta y ahi el
  // filtro de iOS puede vaciar uno despues de recibirlo.
  if (productos.length === 0) return null;

  const verMas = () => {
    tracker.track('carril_mostrar_mas', {
      ...(seccionId != null ? { seccion_id: seccionId } : {}),
      titulo: titulo ?? origen,
      ...(destinoVerMas ? { destino: destinoVerMas } : {}),
    }, pantalla);
    onVerMas?.();
  };

  return (
    <View style={{ paddingTop: 18 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, marginBottom: 10 }}>
        {titulo ? (
          <Text style={{ fontSize: 17, fontWeight: "800", color: colors.ink, letterSpacing: -0.2, flex: 1 }} numberOfLines={1}>
            {titulo}
          </Text>
        ) : <View style={{ flex: 1 }} />}

        {onVerMas && (
          <Pressable
            onPress={verMas}
            accessibilityRole="button"
            accessibilityLabel={`Mostrar mas de ${titulo ?? "esta seccion"}`}
            hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
            style={{ flexDirection: "row", alignItems: "center", gap: 2 }}
          >
            <Text style={{ fontSize: 12.5, fontWeight: "800", color: colors.greenInk }}>Mostrar más</Text>
            <Feather name="chevron-right" size={15} color={colors.greenInk} />
          </Pressable>
        )}
      </View>

      <FlatList
        data={productos}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: medidas.gapCarril }}
        keyExtractor={(item) => String(item.id)}
        // Telefonos baratos: no montar 20 tarjetas de golpe para que se vean 2.
        initialNumToRender={4}
        maxToRenderPerBatch={4}
        windowSize={5}
        // NO se mide el deslizamiento (onScroll): la regla del proyecto es medir
        // intencion, no friccion fisica. Arrastrar no responde ninguna pregunta
        // y gastaria bateria y datos en una cola que ya viaja apretada.
        renderItem={({ item, index }) => (
          // ProductCard usa flex: 1 porque nacio para rejillas de dos columnas;
          // dentro de un carril hay que envolverla en un ancho fijo.
          <View style={{ width: medidas.cardCarril }}>
            <ProductCard
              product={item}
              onPress={() => onPressProducto(item.id)}
              badge={item.badge || undefined}
              badgeTexto={item.badge_texto}
              badgeColor={item.badge_color}
              oferta={item.oferta}
              priority={index < 4 ? "high" : "normal"}
              origen={origen}
              posicion={index}
            />
          </View>
        )}
      />
    </View>
  );
}
