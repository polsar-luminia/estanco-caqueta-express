import { ScrollView, Pressable, Text, View } from "react-native";
import type { Categoria } from "../lib/api";

interface Props {
  categorias: Categoria[];
  onSelect: (id: number) => void;
}

const CATEGORY_EMOJI: Record<string, string> = {
  Whisky: "🥃",
  Tequila: "🌵",
  Ron: "🍹",
  Vodka: "🧊",
  Cerveza: "🍺",
  Vino: "🍷",
  Licor: "🍸",
  Aguardiente: "🔥",
};

function getCategoryIcon(nombre: string): string {
  return CATEGORY_EMOJI[nombre] || nombre.charAt(0).toUpperCase();
}

export function CategoryStrip({ categorias, onSelect }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 16, paddingHorizontal: 4 }}
    >
      {categorias.map((cat) => {
        const icon = getCategoryIcon(cat.nombre);
        const isEmoji = CATEGORY_EMOJI[cat.nombre] !== undefined;

        return (
          <Pressable
            key={cat.id}
            onPress={() => onSelect(cat.id)}
            className="items-center"
            style={{ width: 72 }}
          >
            <View
              className="items-center justify-center rounded-2xl"
              style={{
                width: 64,
                height: 64,
                backgroundColor: "#F4F4F0",
              }}
            >
              <Text
                style={{ fontSize: isEmoji ? 28 : 24 }}
                className={isEmoji ? "" : "font-bold text-gray-600"}
              >
                {icon}
              </Text>
            </View>
            <Text
              className="font-bold uppercase tracking-wider text-center mt-2 text-gray-700"
              style={{ fontSize: 11 }}
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
