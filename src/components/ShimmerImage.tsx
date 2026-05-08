import { useState, useEffect } from "react";
import { View, Text } from "react-native";
import { Image, type ImageStyle, type ImageContentFit, type ImageContentPosition } from "expo-image";

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
          <Text style={{ fontSize: 32, fontWeight: "700", color: "#C9C9C2" }}>
            {initial}
          </Text>
        ) : null}
      </View>
    );
  }

  return (
    <Image
      source={{ uri: imageUrl }}
      style={[{ backgroundColor: "#F3F4F6" }, style]}
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
