import { useState, useEffect } from "react";
import { View, Text } from "react-native";
import { Image, type ImageStyle, type ImageContentFit, type ImageContentPosition } from "expo-image";
import { fuentes } from "../constants/theme";

interface Props {
  imageUrl?: string | null;
  /** Texto/etiqueta de fallback cuando no hay imagen (ej. categoría o nombre del producto). Se muestra la inicial. */
  fallbackCategory?: string;
  style?: ImageStyle;
  contentFit?: ImageContentFit;
  contentPosition?: ImageContentPosition;
  priority?: "low" | "normal" | "high";
}

export function ShimmerImage({ imageUrl, fallbackCategory, style, contentFit = "contain", contentPosition, priority = "normal" }: Props) {
  const [hasError, setHasError] = useState(false);

  // Cuando cambia la URL (p.ej. FlatList reutiliza la celda con otro producto),
  // resetear el error para que expo-image intente cargar la nueva imagen.
  useEffect(() => {
    setHasError(false);
  }, [imageUrl]);

  // Sin URL o falló la carga: placeholder local neutro (evita placehold.co y
  // los rectángulos verdes con texto "Whisky" que se ven peor que estar vacío).
  if (!imageUrl || hasError) {
    const initial = (fallbackCategory ?? "").trim().charAt(0).toUpperCase();
    return (
      <View
        style={[
          { backgroundColor: "#F4F4F0", alignItems: "center", justifyContent: "center" },
          style,
        ]}
      >
        {initial ? (
          <Text style={{ fontSize: 32, fontFamily: fuentes.titulo, color: "#C9C9C2" }}>
            {initial}
          </Text>
        ) : null}
      </View>
    );
  }

  return (
    <Image
      source={{ uri: imageUrl }}
      // Fondo TRANSPARENTE, no un gris propio. Con contentFit="contain" en una
      // caja cuadrada, una botella alta deja franjas a los lados, y ese gris se
      // veia de forma permanente —no solo mientras carga— recuadrando cada
      // producto sobre la tarjeta blanca. Transparente deja pasar el color de
      // quien la monta: blanco en las tarjetas, verde de marca en el hero. Asi
      // el componente no inventa un color que su contenedor no pidio.
      style={[{ backgroundColor: "transparent" }, style]}
      contentFit={contentFit}
      contentPosition={contentPosition}
      cachePolicy="memory-disk"
      recyclingKey={imageUrl}
      priority={priority}
      transition={300}
      onError={() => setHasError(true)}
    />
  );
}
