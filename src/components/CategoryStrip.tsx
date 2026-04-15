import { ScrollView, Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import type { Categoria } from "../lib/api";

interface Props {
  categorias: Categoria[];
  onSelect: (id: number) => void;
}

export function CategoryStrip({ categorias, onSelect }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 14, paddingHorizontal: 2 }}
    >
      {categorias.map((cat) => (
        <Pressable
          key={cat.id}
          onPress={() => onSelect(cat.id)}
          className="items-center"
          style={{ minWidth: 72 }}
        >
          <View
            className="items-center justify-center overflow-hidden"
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: "#E8E8E5",
              padding: 10,
            }}
          >
            {cat.imagen_url ? (
              <Image
                source={{ uri: cat.imagen_url }}
                style={{ width: 58, height: 58 }}
                contentFit="contain"
                cachePolicy="memory-disk"
                transition={200}
              />
            ) : (
              <Text className="font-bold text-gray-500" style={{ fontSize: 26 }}>
                {cat.nombre.charAt(0)}
              </Text>
            )}
          </View>
          <Text
            className="font-semibold text-center mt-1.5"
            style={{ fontSize: 11, color: "#1A1C1A" }}
            numberOfLines={1}
          >
            {cat.nombre}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
