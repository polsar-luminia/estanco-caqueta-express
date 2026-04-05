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
      contentContainerStyle={{ gap: 16, paddingHorizontal: 4 }}
    >
      {categorias.map((cat) => (
        <Pressable
          key={cat.id}
          onPress={() => onSelect(cat.id)}
          className="items-center"
          style={{ width: 72 }}
        >
          <View
            className="items-center justify-center rounded-2xl overflow-hidden"
            style={{
              width: 64,
              height: 64,
              backgroundColor: "#F4F4F0",
            }}
          >
            {cat.imagen_url ? (
              <Image
                source={{ uri: cat.imagen_url }}
                style={{ width: 64, height: 64 }}
                contentFit="cover"
                transition={200}
              />
            ) : (
              <Text className="font-bold text-gray-600 text-2xl">
                {cat.nombre.charAt(0)}
              </Text>
            )}
          </View>
          <Text
            className="font-bold uppercase tracking-wider text-center mt-2 text-gray-700"
            style={{ fontSize: 11 }}
            numberOfLines={1}
          >
            {cat.nombre}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
