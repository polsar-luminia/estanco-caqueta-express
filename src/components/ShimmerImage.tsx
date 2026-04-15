import { useState } from "react";
import { Image, type ImageStyle, type ImageContentFit, type ImageContentPosition } from "expo-image";

const CATEGORY_PLACEHOLDERS: Record<string, string> = {
  Whisky: "https://placehold.co/400x400/1B5E20/white?text=Whisky",
  Tequila: "https://placehold.co/400x400/FF6F00/white?text=Tequila",
  Ron: "https://placehold.co/400x400/795548/white?text=Ron",
  Vodka: "https://placehold.co/400x400/2196F3/white?text=Vodka",
  Cerveza: "https://placehold.co/400x400/FFC107/333?text=Cerveza",
  Vino: "https://placehold.co/400x400/880E4F/white?text=Vino",
};

interface Props {
  imageUrl?: string | null;
  fallbackCategory?: string;
  style?: ImageStyle;
  contentFit?: ImageContentFit;
  contentPosition?: ImageContentPosition;
}

export function ShimmerImage({ imageUrl, fallbackCategory, style, contentFit = "contain", contentPosition }: Props) {
  const [hasError, setHasError] = useState(false);

  const fallback =
    CATEGORY_PLACEHOLDERS[fallbackCategory || ""] ||
    "https://placehold.co/400x400/9E9E9E/white?text=Producto";

  const uri = hasError ? fallback : (imageUrl || fallback);

  return (
    <Image
      source={{ uri }}
      style={[{ backgroundColor: "#F3F4F6" }, style]}
      contentFit={contentFit}
      contentPosition={contentPosition}
      cachePolicy="memory-disk"
      transition={300}
      onError={() => setHasError(true)}
    />
  );
}
