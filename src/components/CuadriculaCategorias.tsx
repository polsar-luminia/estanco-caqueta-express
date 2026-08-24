// Cuadricula de categorias grandes, con imagen.
//
// LA IMAGEN SALE DE LA BASE (categorias.imagen_url), NO de un mapa indexado por
// el nombre en español. Eso ultimo es lo que hace hoy catVisuals.ts con
// CAT_GRADIENTS y CAT_EMOJI, y muerde justo con este rediseno: "Licores",
// "Snacks", "Dulces" y "Bebidas sin Alcohol" son categorias nuevas, asi que
// TODAS caerian al gradiente gris por defecto. Una cuadricula gris no falla:
// simplemente se ve rota, y el arreglo seria publicar una version.
//
// El respaldo cuando no hay imagen es un bloque de marca, no un emoji adivinado
// por nombre: se ve intencional y no depende de que alguien escriba la categoria
// exactamente igual que en un diccionario del cliente.

import { View, Text, Pressable, useWindowDimensions } from "react-native";
import { ShimmerImage } from "./ShimmerImage";
import { colors, radii, fuentes } from "../constants/theme";
import { acomodarMosaico, medidasCelda } from "../lib/mosaico";
import type { CategoriaGrande } from "../lib/api";

interface Props {
  categorias: CategoriaGrande[];
  onSelect: (id: number) => void;
}

export function CuadriculaCategorias({ categorias, onSelect }: Props) {
  const { width } = useWindowDimensions();
  // Cuatro columnas. Se calcula con el ancho real y no con una constante de
  // modulo: la app se usa en telefonos de 320 dp y tambien rotada, y un ancho
  // congelado al importar el archivo deja la ultima columna cortada.
  const COLUMNAS = 4;
  const m = medidasCelda(width, COLUMNAS);

  // El tamano de cada categoria lo manda el BACKEND (096, `mosaico_ancho` y
  // `mosaico_alto`), no la app. Es lo que permite darle mas peso a Mercado o a
  // Farmacia sin publicar una version en las tiendas.
  //
  // Sin nada configurado todas valen 1x1 y esto pinta exactamente la cuadricula
  // de cuatro columnas iguales de antes.
  const { celdas, filas } = acomodarMosaico(categorias, COLUMNAS);

  if (categorias.length === 0) return null;

  // Esta cuadricula NO emite `categoria_grande_abierta`, a proposito.
  //
  // Lo hacia, y como /category/[id] tambien lo emite al montar, abrir una
  // categoria desde aqui contaba DOS veces mientras que abrirla desde el buscador
  // o desde un "Ver mas" contaba una. Nada fallaba: la cifra existia, era
  // plausible, y estaba inflada justo en la via mas usada — que es precisamente
  // la que el evento existe para medir ("?funciona la cuadricula?").
  //
  // El disparo vive en la pantalla de destino porque ahi cubre TODAS las vias de
  // entrada. Si algun dia esta cuadricula navega a otro lado, ese destino es el
  // que debe emitirlo.
  const abrir = (c: CategoriaGrande) => {
    onSelect(c.id);
  };

  // Posicion absoluta y no flexbox: una tarjeta de dos filas al lado de dos de
  // una sola no se puede expresar con `flexWrap` — dejaria el hueco. El alto
  // del contenedor se declara porque un padre de hijos absolutos mide cero.
  return (
    <View
      style={{
        paddingHorizontal: 16,
        paddingTop: 4,
        height: m.altoTotal(filas),
        position: "relative",
      }}
    >
      {celdas.map(({ item: c, col, fila, ancho, alto }) => (
        <Pressable
          key={c.id}
          onPress={() => abrir(c)}
          accessibilityRole="button"
          accessibilityLabel={`${c.nombre}, ${c.cantidad_productos} productos`}
          style={{
            position: "absolute",
            left: 16 + col * (m.celda + m.separacion),
            top: 4 + fila * m.pasoY,
            width: m.tramo(ancho),
            height: m.tramoY(alto),
          }}
        >
          {/* La baldosa gris es lo que dice "esto se toca". Era blanca sobre
              fondo blanco, asi que no habia boton: solo una foto flotando.
              El gris es el mismo de la 1.2.3.

              SIN SOMBRA, a proposito. La separacion entre baldosas es de 10 pt y
              `shadows.soft` tiene 14 de radio: dos vecinas se cruzarian y
              sumarian justo en el hueco, que es el mismo defecto que hubo que
              corregir en las tarjetas de producto. Con el relleno gris la sombra
              ya no hace falta para separar del fondo.

              `contain` y no `cover`: con `cover` la foto tapa la baldosa entera y
              el gris no se ve por ningun lado. El padding es lo que deja el
              marco visible alrededor del producto.

              El alto sale de `tramoImagen` y ya no de `aspectRatio: 1`: una
              tarjeta ancha con aspecto cuadrado seria altisima y se comeria la
              pantalla. */}
          <View
            style={{
              width: "100%",
              height: m.tramoImagen(alto),
              borderRadius: radii.tile,
              overflow: "hidden",
              backgroundColor: colors.baldosa,
              alignItems: "center",
              justifyContent: "center",
              // Una baldosa grande con el mismo margen de 8 deja la foto
              // flotando en un marco enorme. Crece con el tamano, no con el
              // gusto: la proporcion del marco se mantiene.
              padding: 8 * Math.max(ancho, alto),
            }}
          >
            {(c.imagen_url_thumb || c.imagen_url) ? (
              <ShimmerImage
                imageUrl={c.imagen_url_thumb || c.imagen_url}
                style={{ width: "100%", height: "100%" }}
                contentFit="contain"
              />
            ) : (
              <View style={{ width: "100%", height: "100%", backgroundColor: colors.greenTint, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontFamily: fuentes.titulo, fontSize: 20 * Math.max(ancho, alto), color: colors.greenInk }}>
                  {c.nombre.slice(0, 1).toUpperCase()}
                </Text>
              </View>
            )}
          </View>
          <Text
            style={{ marginTop: 6, fontFamily: fuentes.destacado, fontSize: 13, color: colors.ink, textAlign: "center", lineHeight: 15 }}
            numberOfLines={2}
          >
            {c.nombre}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
