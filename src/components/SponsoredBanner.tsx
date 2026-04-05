import { View, Pressable, Dimensions } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import type { Patrocinado } from "../lib/api";

const { width } = Dimensions.get("window");

interface Props {
  banners: Patrocinado[];
}

export function SponsoredBanner({ banners }: Props) {
  const router = useRouter();
  const banner = banners[0]; // MVP: mostrar solo el primero

  if (!banner?.imagen_url) return null;

  return (
    <Pressable
      onPress={() => {
        if (banner.producto_id) {
          router.push(`/product/${banner.producto_id}`);
        }
      }}
    >
      <Image
        source={{ uri: banner.imagen_url }}
        style={{ width, height: width * 0.45 }}
        contentFit="cover"
      />
    </Pressable>
  );
}
