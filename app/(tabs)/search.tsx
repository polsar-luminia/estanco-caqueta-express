import { useState, useCallback } from "react";
import { View, TextInput, FlatList, Text, ScrollView, Pressable } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { buscarProductos, getCategorias } from "../../src/lib/api";
import { ProductCard } from "../../src/components/ProductCard";
import { CategoryStrip } from "../../src/components/CategoryStrip";
import { ProductGridSkeleton } from "../../src/components/skeletons/ProductGridSkeleton";

const RECENT_SEARCHES = ["Aguardiente", "Heineken", "Pringles", "Ron Viejo de Caldas"];

export default function SearchScreen() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  const debounceRef = useCallback(
    (() => {
      let timeout: ReturnType<typeof setTimeout>;
      return (value: string) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => setDebouncedQuery(value), 400);
      };
    })(),
    []
  );

  const handleChange = (text: string) => {
    setQuery(text);
    debounceRef(text);
  };

  const handleRecentSearch = (term: string) => {
    setQuery(term);
    setDebouncedQuery(term);
  };

  const { data: resultados = [], isLoading } = useQuery({
    queryKey: ["buscar", debouncedQuery],
    queryFn: () => buscarProductos(debouncedQuery),
    enabled: debouncedQuery.length >= 2,
  });

  const { data: categorias = [] } = useQuery({
    queryKey: ["categorias"],
    queryFn: getCategorias,
  });

  const hasResults = debouncedQuery.length >= 2 && resultados.length > 0;
  const noResults = debouncedQuery.length >= 2 && resultados.length === 0 && !isLoading;
  const showExplore = debouncedQuery.length < 2;

  return (
    <View className="flex-1" style={{ backgroundColor: "#FFFFFF" }}>
      {/* Search Bar */}
      <View className="px-4 pt-4 pb-2">
        <View
          className="flex-row items-center rounded-xl px-4"
          style={{ backgroundColor: "rgba(226,227,223,0.5)", paddingVertical: 14, gap: 10 }}
        >
          <Feather name="search" size={20} color="#1FAF55" />
          <TextInput
            className="flex-1 text-base"
            style={{ color: "#1A1C1A" }}
            placeholder="Busca licores o snacks..."
            placeholderTextColor="#9E9E9E"
            value={query}
            onChangeText={handleChange}
            autoFocus
          />
          {query.length > 0 && (
            <Pressable onPress={() => { setQuery(""); setDebouncedQuery(""); }}>
              <Feather name="x" size={18} color="#9E9E9E" />
            </Pressable>
          )}
        </View>
      </View>

      {/* Loading */}
      {isLoading && debouncedQuery.length >= 2 && (
        <View className="px-4 pt-4">
          <ProductGridSkeleton count={4} />
        </View>
      )}

      {/* Results */}
      {hasResults && (
        <FlatList
          data={resultados}
          numColumns={2}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 90 }}
          columnWrapperStyle={{ gap: 10 }}
          keyExtractor={(item) => String(item.id)}
          ListHeaderComponent={
            <View className="flex-row justify-between items-center mb-3">
              <Text style={{ fontSize: 18, fontWeight: "800", color: "#1A1C1A", letterSpacing: -0.5 }}>
                Resultados
              </Text>
              <Text style={{ fontSize: 12, color: "#6D7B6C" }}>
                {resultados.length} productos
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <ProductCard
              product={item}
              onPress={() => router.push(`/product/${item.id}`)}
            />
          )}
        />
      )}

      {/* No Results */}
      {noResults && (
        <View className="px-4 py-12 items-center">
          <Text style={{ fontSize: 40, marginBottom: 12 }}>🔍</Text>
          <Text style={{ fontSize: 16, fontWeight: "600", color: "#6D7B6C" }}>
            No se encontraron productos
          </Text>
          <Text style={{ fontSize: 13, color: "#BCCABA", marginTop: 4 }}>
            Intenta con otro término de búsqueda
          </Text>
        </View>
      )}

      {/* Explore (when no search) */}
      {showExplore && (
        <ScrollView contentContainerStyle={{ paddingBottom: 90 }}>
          {/* Recent Searches */}
          <View className="px-4 mb-6">
            <Text style={{ fontSize: 11, fontWeight: "700", color: "#9E9E9E", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10 }}>
              Búsquedas Recientes
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {RECENT_SEARCHES.map((term) => (
                <Pressable
                  key={term}
                  onPress={() => handleRecentSearch(term)}
                  style={{ backgroundColor: "#F4F4F0", borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10 }}
                >
                  <Text style={{ fontSize: 13, fontWeight: "500", color: "#1A1C1A" }}>{term}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {/* Categories Grid */}
          <View className="px-4 mb-8">
            <Text style={{ fontSize: 18, fontWeight: "800", color: "#1A1C1A", marginBottom: 16, letterSpacing: -0.5 }}>
              Explora Categorías
            </Text>
            <View className="flex-row flex-wrap" style={{ gap: 16 }}>
              {categorias.map((cat) => (
                <Pressable
                  key={cat.id}
                  onPress={() => router.push(`/category/${cat.id}`)}
                  className="items-center"
                  style={{ width: "22%" }}
                >
                  <View
                    className="items-center justify-center overflow-hidden"
                    style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: "#F4F4F0", padding: 8 }}
                  >
                    {cat.imagen_url ? (
                      <View style={{ width: 40, height: 40 }}>
                        <View className="w-full h-full items-center justify-center">
                          <Text style={{ fontSize: 24 }}>
                            {cat.nombre === "Whisky" ? "🥃" :
                             cat.nombre === "Tequila" ? "🌵" :
                             cat.nombre === "Ron" ? "🍹" :
                             cat.nombre === "Cerveza" || cat.nombre === "Cervezas" ? "🍺" :
                             cat.nombre === "Vino" ? "🍷" :
                             cat.nombre === "Aguardiente" ? "🔥" :
                             cat.nombre === "Dulces" ? "🍬" :
                             cat.nombre === "Galletas" ? "🍪" :
                             cat.nombre === "Gaseosa" ? "🥤" :
                             cat.nombre === "Ginebra" ? "🍸" :
                             cat.nombre === "Vodka" ? "🧊" :
                             cat.nombre === "Champaña" ? "🥂" :
                             cat.nombre === "Cocteles" ? "🍹" :
                             cat.nombre === "Cremas" ? "🍶" :
                             cat.nombre.charAt(0)}
                          </Text>
                        </View>
                      </View>
                    ) : (
                      <Text style={{ fontSize: 24 }}>{cat.nombre.charAt(0)}</Text>
                    )}
                  </View>
                  <Text
                    style={{ fontSize: 10, fontWeight: "700", color: "#6D7B6C", textTransform: "uppercase", marginTop: 6, textAlign: "center" }}
                    numberOfLines={1}
                  >
                    {cat.nombre}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Suggestions */}
          <View className="px-4">
            <View className="flex-row justify-between items-center mb-4">
              <Text style={{ fontSize: 18, fontWeight: "800", color: "#1A1C1A", letterSpacing: -0.5 }}>
                Sugerencias de Hoy
              </Text>
              <Text style={{ fontSize: 12, fontWeight: "700", color: "#D33587" }}>Ver Todo</Text>
            </View>
          </View>
        </ScrollView>
      )}
    </View>
  );
}
