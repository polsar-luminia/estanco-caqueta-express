import { useState } from "react";
import { ScrollView, Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import type { Categoria } from "../lib/api";
import { fuentes } from "../constants/theme";

interface Props {
  categorias: Categoria[];
  onSelect: (id: number) => void;
}

function CategoryIcon({ cat }: { cat: Categoria }) {
  const [errored, setErrored] = useState(false);
  const showFallback = !cat.imagen_url || errored;

  if (showFallback) {
    return (
      <Text className="font-bold text-gray-500" style={{ fontFamily: fuentes.titulo, fontSize: 26 }}>
        {cat.nombre.charAt(0).toUpperCase()}
      </Text>
    );
  }

  return (
    <Image
      source={{ uri: cat.imagen_url! }}
      style={{ width: 58, height: 58 }}
      contentFit="contain"
      cachePolicy="memory-disk"
      transition={200}
      onError={() => setErrored(true)}
    />
  );
}

function CategoryItem({ cat, onSelect }: { cat: Categoria; onSelect: (id: number) => void }) {
  return (
    <Pressable
      onPress={() => onSelect(cat.id)}
      accessibilityRole="button"
      accessibilityLabel={`Ver productos de ${cat.nombre}`}
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
        <CategoryIcon cat={cat} />
      </View>
      <Text
        className="font-semibold text-center mt-1.5"
        style={{ fontFamily: fuentes.destacado, fontSize: 12, color: "#1A1C1A" }}
        numberOfLines={1}
      >
        {cat.nombre}
      </Text>
    </Pressable>
  );
}

export function CategoryStrip({ categorias, onSelect }: Props) {
  // 2 filas: agrupa en columnas de a 2 (fila sup = pares, inf = impares).
  // Scroll horizontal por columnas. Última columna puede tener 1 sola.
  const columnas: Categoria[][] = [];
  for (let i = 0; i < categorias.length; i += 2) {
    columnas.push(categorias.slice(i, i + 2));
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 14, paddingHorizontal: 2 }}
    >
      {columnas.map((col, idx) => (
        <View key={col[0]?.id ?? idx} style={{ gap: 16 }}>
          {col.map((cat) => (
            <CategoryItem key={cat.id} cat={cat} onSelect={onSelect} />
          ))}
        </View>
      ))}
    </ScrollView>
  );
}
