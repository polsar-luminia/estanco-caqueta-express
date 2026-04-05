import { useRef, useEffect, useState } from "react";
import { View, FlatList, Pressable, Dimensions } from "react-native";
import { useRouter } from "expo-router";
import { ShimmerImage } from "./ShimmerImage";
import type { Patrocinado } from "../lib/api";

const { width } = Dimensions.get("window");

interface Props {
  banners: Patrocinado[];
}

export function BannerCarousel({ banners }: Props) {
  const router = useRouter();
  const flatListRef = useRef<FlatList>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (banners.length <= 1) return;
    const interval = setInterval(() => {
      const next = (activeIndex + 1) % banners.length;
      flatListRef.current?.scrollToIndex({ index: next, animated: true });
      setActiveIndex(next);
    }, 3000);
    return () => clearInterval(interval);
  }, [activeIndex, banners.length]);

  if (banners.length === 0) return null;

  return (
    <View>
      <FlatList
        ref={flatListRef}
        data={banners}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => String(item.id)}
        onMomentumScrollEnd={(e) => {
          setActiveIndex(Math.round(e.nativeEvent.contentOffset.x / width));
        }}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => {
              if (item.producto_id) router.push(`/product/${item.producto_id}`);
            }}
          >
            <ShimmerImage
              imageUrl={item.imagen_url}
              style={{ width, height: width * 0.45 }}
              contentFit="cover"
            />
          </Pressable>
        )}
      />
      {banners.length > 1 && (
        <View className="flex-row justify-center py-2" style={{ gap: 6 }}>
          {banners.map((_, i) => (
            <View
              key={i}
              style={{ width: activeIndex === i ? 20 : 6, height: 6, borderRadius: 3 }}
              className={activeIndex === i ? "bg-brand-700" : "bg-gray-300"}
            />
          ))}
        </View>
      )}
    </View>
  );
}
