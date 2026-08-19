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
import type { CategoriaGrande } from "../lib/api";

interface Props {
  categorias: CategoriaGrande[];
  onSelect: (id: number) => void;
}

export function CuadriculaCategorias({ categorias, onSelect }: Props) {
  const { width } = useWindowDimensions();
  // Cuatro columnas, como el borrador. Se calcula con el ancho real y no con una
  // constante de modulo: la app se usa en telefonos de 320 dp y tambien rotada,
  // y un ancho congelado al importar el archivo deja la ultima columna cortada.
  const COLUMNAS = 4;
  const SEPARACION = 10;
  const ancho = (width - 32 - SEPARACION * (COLUMNAS - 1)) / COLUMNAS;

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

  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, paddingHorizontal: 16, paddingTop: 4 }}>
      {categorias.map((c) => (
        <Pressable
          key={c.id}
          onPress={() => abrir(c)}
          accessibilityRole="button"
          accessibilityLabel={`${c.nombre}, ${c.cantidad_productos} productos`}
          style={{ width: ancho }}
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
              marco visible alrededor del producto. */}
          <View
            style={{
              width: "100%",
              aspectRatio: 1,
              borderRadius: radii.tile,
              overflow: "hidden",
              backgroundColor: colors.baldosa,
              alignItems: "center",
              justifyContent: "center",
              padding: 8,
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
                <Text style={{ fontFamily: fuentes.titulo, fontSize: 20, color: colors.greenInk }}>
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
