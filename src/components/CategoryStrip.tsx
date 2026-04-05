import { ScrollView, Pressable, Text } from "react-native";
import type { Categoria } from "../lib/api";

interface Props {
  categorias: Categoria[];
  onSelect: (id: number) => void;
}

export function CategoryStrip({ categorias, onSelect }: Props) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      {categorias.map((cat) => (
        <Pressable
          key={cat.id}
          onPress={() => onSelect(cat.id)}
          className="bg-brand-50 border border-brand-200 rounded-xl px-4 py-2 mr-2"
        >
          <Text className="text-sm font-medium text-brand-800">
            {cat.nombre}
          </Text>
          <Text className="text-xs text-brand-600">
            {cat.cantidad_productos} productos
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
