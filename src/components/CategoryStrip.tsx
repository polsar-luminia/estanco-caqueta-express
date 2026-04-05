import { ScrollView, Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import type { Categoria } from "../lib/api";

interface Props {
  categorias: Categoria[];
  onSelect: (id: number) => void;
}

const CATEGORY_ICON: Record<string, string> = {
  Whisky: "🥃",
  Tequila: "🌵",
  Ron: "🍹",
  Vodka: "🧊",
  Cerveza: "🍺",
  Cervezas: "🍺",
  Vino: "🍷",
  Ginebra: "🍸",
  Aguardiente: "🔥",
  Champaña: "🥂",
  "Champana": "🥂",
  Cocteles: "🍹",
  Cremas: "🍶",
  Dulces: "🍬",
  Galletas: "🍪",
  Gaseosa: "🥤",
  "Bebidas Sin Alcohol": "🧃",
  Vapes: "💨",
};

export function CategoryStrip({ categorias, onSelect }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 16, paddingHorizontal: 4 }}
    >
      {categorias.map((cat) => {
        const icon = CATEGORY_ICON[cat.nombre] || cat.nombre.charAt(0);
        const hasImage = !!cat.imagen_url;

        return (
          <Pressable
            key={cat.id}
            onPress={() => onSelect(cat.id)}
            className="items-center"
            style={{ width: 72 }}
          >
            <View
              className="items-center justify-center rounded-2xl overflow-hidden"
              style={{
                width: 56,
                height: 56,
                backgroundColor: "#F4F4F0",
              }}
            >
              {hasImage ? (
                <Image
                  source={{ uri: cat.imagen_url }}
                  style={{ width: 56, height: 56 }}
                  contentFit="cover"
                  transition={200}
                />
              ) : (
                <Text style={{ fontSize: 24 }}>{icon}</Text>
              )}
            </View>
            <Text
              className="font-bold uppercase text-center mt-1.5 text-gray-700"
              style={{ fontSize: 9, letterSpacing: 0.5 }}
              numberOfLines={1}
            >
              {cat.nombre}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
