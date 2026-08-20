// Carril horizontal de productos con "VER MÁS".
//
// ES LA PIEZA NUEVA MAS IMPORTANTE DEL REDISENO. No existia ningun carril
// reusable en la app: el inicio tenia uno escrito a mano en el JSX para los
// combos, con su propia tarjeta, su propio formato de precio y su propio manejo
// de imagen — y sin carrito, sin limites por cliente y sin estado agotado. Cada
// vez que hacia falta otro carril, se copiaba. Aqui hay UNO y usa ProductCard,
// asi que todo eso lo hereda gratis.
//
// TAMPOCO EXISTIA NINGUN "ver mas" en toda la app (busqueda exhaustiva: 0
// resultados). Habia un "Ver todas" en Categorias y nada mas.
//
// El color del texto lo manda la seccion: sobre la banda magenta el titulo va
// blanco, sobre el fondo de la pantalla va oscuro. Sin eso, el titulo se pierde
// contra su propio fondo — no falla, simplemente no se lee.

import { memo, useCallback } from "react";
import { View, Text, Pressable, FlatList, Platform } from "react-native";
import { ProductCard } from "./ProductCard";
import { colors, medidas, fuentes } from "../constants/theme";
import { tracker } from "../lib/tracker";
import type { ProductoEnCarril } from "../lib/api";

interface Props {
  titulo: string | null;
  productos: ProductoEnCarril[];
  // Que se hace al tocar "VER MÁS". Sin esto no se dibuja el boton: uno que no
  // lleva a ningun lado es peor que no tenerlo.
  onVerMas?: () => void;
  onPressProducto: (id: number) => void;
  // Identifica el carril en la telemetria (titulo o tipo de seccion).
  origen: string;
  seccionId?: number;
  destinoVerMas?: string;
  colorTexto?: string | null;
  pantalla: string;
}


// Ancho de tarjeta + separacion. Se calcula una vez y no por fotograma.
const PASO_CARRIL = medidas.cardCarril + medidas.gapCarril;

// Celda memoizada. ProductCard NO esta memoizada y la usan seis pantallas, asi
// que cambiarle la firma para poder memoizarla arrastraria regresiones a
// rejillas que hoy funcionan. Envolverla aqui deja el arreglo contenido: la
// celda solo se vuelve a dibujar si cambia SU producto, no cuando se redibuja
// el carril entero.
//
// `onAbrir` recibe el id y se queda estable; con el patron anterior
// (`onPress={() => onPressProducto(item.id)}`) nacia una funcion nueva por
// tarjeta en cada render y cualquier memoizacion se caia sola.
const CeldaCarril = memo(function CeldaCarril({
  item, index, onAbrir, origen,
}: {
  item: ProductoEnCarril;
  index: number;
  onAbrir: (id: number) => void;
  origen: string;
}) {
  const abrir = useCallback(() => onAbrir(item.id), [onAbrir, item.id]);
  return (
    // ProductCard usa flex: 1 porque nacio para rejillas de dos columnas;
    // dentro de un carril hay que envolverla en un ancho fijo.
    <View style={{ width: medidas.cardCarril }}>
      <ProductCard
        product={item}
        onPress={abrir}
        badge={item.badge || undefined}
        badgeTexto={item.badge_texto}
        badgeColor={item.badge_color}
        oferta={item.oferta}
        priority={index < 4 ? "high" : "normal"}
        origen={origen}
        posicion={index}
      />
    </View>
  );
});

export function CarrilProductos({
  titulo, productos, onVerMas, onPressProducto, origen, seccionId, destinoVerMas,
  colorTexto, pantalla,
}: Props) {
  // Un carril vacio no se dibuja. El servidor ya descarta las secciones sin
  // items, pero la pantalla de categoria arma carriles por su cuenta y ahi el
  // filtro de iOS puede vaciar uno despues de recibirlo.
  if (productos.length === 0) return null;

  const tinta = colorTexto || colors.ink;

  const verMas = () => {
    tracker.track('carril_mostrar_mas', {
      ...(seccionId != null ? { seccion_id: seccionId } : {}),
      titulo: titulo ?? origen,
      ...(destinoVerMas ? { destino: destinoVerMas } : {}),
    }, pantalla);
    onVerMas?.();
  };

  return (
    // paddingTop corto: dentro de una seccion con fondo propio, encima ya esta
    // la franja de la curva (29 pt). Con 18 mas, el titulo quedaba flotando
    // demasiado abajo del borde de color y el carril se despegaba del bloque.
    <View style={{ paddingTop: 8, paddingBottom: 4 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", paddingHorizontal: 16, marginBottom: 12 }}>
        {titulo ? (
          // fontWeight NO se combina con fontFamily: Archivo Black tiene un solo peso, y
          // pedirle negrita hace que Android busque una variante que no existe y
          // caiga a la tipografia del sistema. El texto sale, con otra fuente.
          <Text style={{ fontFamily: fuentes.titulo, fontSize: 30, color: tinta, flex: 1 }} numberOfLines={1}>
            {titulo}
          </Text>
        ) : <View style={{ flex: 1 }} />}

        {onVerMas && (
          <Pressable
            onPress={verMas}
            accessibilityRole="button"
            accessibilityLabel={`Ver más de ${titulo ?? "esta sección"}`}
            hitSlop={{ top: 12, bottom: 12, left: 10, right: 10 }}
            style={{ paddingBottom: 3 }}
          >
            <Text
              style={{
                fontFamily: fuentes.destacado,
                fontSize: 14,
                letterSpacing: 0.5,
                color: tinta,
                textDecorationLine: "underline",
              }}
            >
              VER MÁS
            </Text>
          </Pressable>
        )}
      </View>

      <FlatList
        data={productos}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: medidas.gapCarril, paddingBottom: 16 }}
        keyExtractor={(item) => String(item.id)}
        // Telefonos baratos: no montar 20 tarjetas de golpe para que se vean 2.
        initialNumToRender={4}
        maxToRenderPerBatch={4}
        windowSize={5}
        // NO se mide el deslizamiento (onScroll): la regla del proyecto es medir
        // intencion, no friccion fisica. Arrastrar no responde ninguna pregunta
        // y gastaria bateria y datos en una cola que ya viaja apretada.
        // Todas las tarjetas miden lo mismo (medidas.cardCarril), asi que la
        // posicion de cada una se puede calcular en vez de medirse. Sin esto,
        // FlatList monta cada celda, espera su onLayout y recalcula — en mitad
        // del deslizamiento, que es justo cuando se siente el tiron.
        getItemLayout={(_, index) => ({
          length: medidas.cardCarril,
          offset: PASO_CARRIL * index,
          index,
        })}
        // Solo Android: en iOS desmontar vistas fuera de pantalla puede dejar
        // celdas en blanco al volver.
        removeClippedSubviews={Platform.OS === "android"}
        renderItem={({ item, index }) => (
          <CeldaCarril item={item} index={index} onAbrir={onPressProducto} origen={origen} />
        )}
      />
    </View>
  );
}
