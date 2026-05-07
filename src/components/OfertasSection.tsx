// Sección horizontal de ofertas en home. Si la lista está vacía, no renderiza nada.
// Cada item es un ProductCard con prop `oferta` para que muestre badge magenta y
// (si aplica) precio tachado.

import { View, Text, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { ProductCard } from "./ProductCard";
import type { Oferta } from "../lib/api";

interface Props {
  ofertas: Oferta[];
}

export function OfertasSection({ ofertas }: Props) {
  const router = useRouter();

  if (!ofertas || ofertas.length === 0) {
    return null;
  }

  return (
    <View style={{ marginTop: 24 }}>
      <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", paddingHorizontal: 16, marginBottom: 12 }}>
        <Text style={{ fontSize: 22, fontWeight: "800", color: "#1A1C1A" }}>
          Ofertas
        </Text>
        <Text style={{ fontSize: 12, color: "#6D7B6C" }}>
          {ofertas.length} {ofertas.length === 1 ? "producto" : "productos"}
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
      >
        {ofertas.map((oferta) => (
          <View key={oferta.id} style={{ width: 170 }}>
            <ProductCard
              product={oferta.producto}
              onPress={() => router.push(`/product/${oferta.producto.id}`)}
              oferta={{ titulo: oferta.titulo, precio_oferta: oferta.precio_oferta }}
            />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
