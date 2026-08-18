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
import { colors, radii, shadows, fuentes } from "../constants/theme";
import { tracker } from "../lib/tracker";
import type { CategoriaGrande } from "../lib/api";

interface Props {
  categorias: CategoriaGrande[];
  onSelect: (id: number) => void;
  pantalla: string;
}

export function CuadriculaCategorias({ categorias, onSelect, pantalla }: Props) {
  const { width } = useWindowDimensions();
  // Cuatro columnas, como el borrador. Se calcula con el ancho real y no con una
  // constante de modulo: la app se usa en telefonos de 320 dp y tambien rotada,
  // y un ancho congelado al importar el archivo deja la ultima columna cortada.
  const COLUMNAS = 4;
  const SEPARACION = 10;
  const ancho = (width - 32 - SEPARACION * (COLUMNAS - 1)) / COLUMNAS;

  if (categorias.length === 0) return null;

  const abrir = (c: CategoriaGrande) => {
    tracker.track('categoria_grande_abierta', { categoria_id: c.id, nombre: c.nombre }, pantalla);
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
          <View
            style={{
              width: "100%",
              aspectRatio: 1,
              borderRadius: radii.tile,
              overflow: "hidden",
              backgroundColor: colors.surface,
              alignItems: "center",
              justifyContent: "center",
              ...shadows.soft,
            }}
          >
            {(c.imagen_url_thumb || c.imagen_url) ? (
              <ShimmerImage
                imageUrl={c.imagen_url_thumb || c.imagen_url}
                style={{ width: "100%", height: "100%" }}
                contentFit="cover"
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
