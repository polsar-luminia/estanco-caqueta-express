import { useState, useCallback, useEffect } from "react";
import { View, TextInput, FlatList, Text, ScrollView, Pressable, Dimensions } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { buscarProductos, getCategorias, getDestacados, type Categoria } from "../../src/lib/api";
import { tracker } from "../../src/lib/tracker";
import { getCatVisuals } from "../../src/lib/catVisuals";
import { ProductCard } from "../../src/components/ProductCard";
import { ProductGridSkeleton } from "../../src/components/skeletons/ProductGridSkeleton";
import { ErrorState } from "../../src/components/ErrorState";
import { SearchIcon, CloseIcon, ClockIcon } from "../../src/components/icons/AppIcons";

const RECENT_SEARCHES = ["Jack Daniel's", "Olmeca Reposado", "Something Special", "Absolut", "Bacardi", "Casillero del Diablo"];
const SCREEN_WIDTH = Dimensions.get("window").width;
const COL_WIDTH = (SCREEN_WIDTH - 32 - 12) / 2; // px-4 padding + 1 gap de 12

function CategoryGridItem({ cat, onPress }: { cat: Categoria; onPress: () => void }) {
  const [imageErrored, setImageErrored] = useState(false);
  const { gradient, emoji } = getCatVisuals(cat.nombre);

  return (
    <Pressable
      onPress={onPress}
      style={{
        width: COL_WIDTH,
        marginBottom: 12,
        borderRadius: 14,
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 14,
        paddingVertical: 13,
        gap: 10,
        backgroundColor: "#F4F4F0",
        overflow: "hidden",
      }}
    >
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          width: 48, height: 48, borderRadius: 24,
          alignItems: "center", justifyContent: "center",
        }}
      >
        {cat.imagen_url && !imageErrored ? (
          <Image
            source={{ uri: cat.imagen_url }}
            style={{ width: 30, height: 30 }}
            contentFit="contain"
            onError={() => setImageErrored(true)}
          />
        ) : emoji ? (
          <Text style={{ fontSize: 22, opacity: 0.85 }}>{emoji}</Text>
        ) : (
          <Text style={{ fontSize: 20, fontWeight: "800", color: "rgba(255,255,255,0.6)" }}>
            {cat.nombre.charAt(0)}
          </Text>
        )}
      </LinearGradient>

      <Text
        style={{ flex: 1, fontSize: 12, fontWeight: "700", color: "#1A1C1A" }}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {cat.nombre}
      </Text>
    </Pressable>
  );
}

export default function SearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [focused, setFocused] = useState(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- debouncer IIFE con closure intencional
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

  const { data: resultados = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["buscar", debouncedQuery],
    queryFn: () => buscarProductos(debouncedQuery),
    enabled: debouncedQuery.length >= 2,
  });

  const hasResults = debouncedQuery.length >= 2 && resultados.length > 0 && !isError;
  const noResults = debouncedQuery.length >= 2 && resultados.length === 0 && !isLoading && !isError;
  const showExplore = debouncedQuery.length < 2;

  const { data: categorias = [] } = useQuery({
    queryKey: ["categorias"],
    queryFn: getCategorias,
  });

  const { data: destacados = [] } = useQuery({
    queryKey: ["destacados"],
    queryFn: getDestacados,
    enabled: showExplore,
  });

  useEffect(() => {
    if (debouncedQuery.length >= 2 && !isLoading) {
      if (resultados.length === 0) {
        tracker.track("busqueda_sin_resultado", { q: debouncedQuery }, "search");
      } else {
        tracker.track("busqueda", { q: debouncedQuery, resultados: resultados.length }, "search");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resultados.length se lee vía isLoading=false gate
  }, [debouncedQuery, isLoading]);

  return (
    <View style={{ flex: 1, backgroundColor: "#FAFAF6" }}>
      {/* Search Bar — con sombra y estados animados */}
      <View
        style={{
          backgroundColor: "#FFFFFF",
          paddingTop: insets.top + 8,
          paddingHorizontal: 16,
          paddingBottom: 12,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 4,
          elevation: 2,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            backgroundColor: focused ? "#FFFFFF" : "#F4F4F0",
            borderRadius: 14,
            paddingHorizontal: 16,
            paddingVertical: 13,
            borderWidth: 1.5,
            borderColor: focused ? "#1FAF55" : "transparent",
            shadowColor: focused ? "#1FAF55" : "transparent",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: focused ? 0.10 : 0,
            shadowRadius: 16,
            elevation: focused ? 4 : 0,
          }}
        >
          <SearchIcon color={focused ? "#1FAF55" : "#9E9E9E"} size={18} />
          <TextInput
            style={{ flex: 1, fontSize: 15, color: "#1A1C1A" }}
            placeholder="Busca licores o snacks..."
            placeholderTextColor="#9E9E9E"
            value={query}
            onChangeText={handleChange}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            autoFocus={false}
          />
          {query.length > 0 && (
            <Pressable
              onPress={() => {
                setQuery("");
                setDebouncedQuery("");
              }}
            >
              <CloseIcon color="#9E9E9E" size={16} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Loading */}
      {isLoading && debouncedQuery.length >= 2 && (
        <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
          <ProductGridSkeleton count={4} />
        </View>
      )}

      {/* Results */}
      {hasResults && (
        <FlatList
          key="resultados-grid"
          data={resultados}
          numColumns={2}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 102 }}
          columnWrapperStyle={{ gap: 10 }}
          keyExtractor={(item) => String(item.id)}
          ListHeaderComponent={
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <Text style={{ fontSize: 18, fontWeight: "800", color: "#1A1C1A" }}>Resultados</Text>
              <Text style={{ fontSize: 12, color: "#6D7B6C" }}>{resultados.length} productos</Text>
            </View>
          }
          renderItem={({ item }) => (
            <ProductCard product={item} onPress={() => router.push(`/product/${item.id}`)} />
          )}
        />
      )}

      {/* Error al buscar */}
      {isError && debouncedQuery.length >= 2 && (
        <View style={{ paddingTop: 40 }}>
          <ErrorState mensaje="Error al buscar" onRetry={() => refetch()} />
        </View>
      )}

      {/* No Results */}
      {noResults && (
        <View style={{ alignItems: "center", paddingTop: 60 }}>
          <View style={{
            width: 72, height: 72, borderRadius: 36,
            backgroundColor: "#F4F4F0",
            alignItems: "center", justifyContent: "center",
            marginBottom: 12,
          }}>
            <SearchIcon color="#BCCABA" size={32} />
          </View>
          <Text style={{ fontSize: 16, fontWeight: "700", color: "#6D7B6C" }}>
            Sin resultados para &quot;{debouncedQuery}&quot;
          </Text>
          <Text style={{ fontSize: 12, color: "#BCCABA", marginTop: 4 }}>
            Intenta con otro término
          </Text>
        </View>
      )}

      {/* Explore */}
      {showExplore && (
        <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
          {/* Recent Searches */}
          <View style={{ paddingHorizontal: 16, marginBottom: 20, paddingTop: 16 }}>
            <Text style={{ fontSize: 10, fontWeight: "700", color: "#9E9E9E", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10 }}>
              Búsquedas Recientes
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {RECENT_SEARCHES.map((term) => (
                <Pressable
                  key={term}
                  onPress={() => handleRecentSearch(term)}
                  style={{
                    backgroundColor: "#FFFFFF",
                    borderRadius: 9999,
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderWidth: 1,
                    borderColor: "#E2E3DF",
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <ClockIcon color="#BCCABA" size={13} />
                  <Text style={{ fontSize: 12, fontWeight: "500", color: "#1A1C1A" }}>{term}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {/* Categories Grid — 2 columns */}
          <View style={{ paddingHorizontal: 16, marginBottom: 24 }}>
            <Text style={{ fontSize: 18, fontWeight: "800", color: "#1A1C1A", marginBottom: 16 }}>
              Explora Categorías
            </Text>
            <FlatList
              key="categorias-grid"
              data={categorias}
              numColumns={2}
              scrollEnabled={false}
              keyExtractor={(item) => String(item.id)}
              columnWrapperStyle={{ gap: 12 }}
              renderItem={({ item }) => (
                <CategoryGridItem cat={item} onPress={() => router.push(`/category/${item.id}`)} />
              )}
            />
          </View>

          {/* Suggestions */}
          {destacados.length > 0 && (
            <View style={{ paddingHorizontal: 16 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <Text style={{ fontSize: 18, fontWeight: "800", color: "#1A1C1A" }}>Sugerencias de Hoy</Text>
                <Pressable onPress={() => router.push("/(tabs)/")}>
                  <Text style={{ fontSize: 12, fontWeight: "700", color: "#D33587" }}>Ver Todo</Text>
                </Pressable>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 16 }}>
                {destacados.map((item) => (
                  <View key={item.id} style={{ width: COL_WIDTH }}>
                    <ProductCard product={item} onPress={() => router.push(`/product/${item.id}`)} />
                  </View>
                ))}
              </ScrollView>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}
