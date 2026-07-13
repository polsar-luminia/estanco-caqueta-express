import { useState, useCallback, useEffect, useRef } from "react";
import { View, TextInput, FlatList, Text, ScrollView, Pressable, Dimensions, ActivityIndicator } from "react-native";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { buscarProductos, getCategorias, getDestacados, type Categoria } from "../../src/lib/api";
import { filtrarCategoriasIOS, filtrarProductosIOS } from "../../src/lib/iosFilters";
import { tracker } from "../../src/lib/tracker";
import { getCatVisuals } from "../../src/lib/catVisuals";
import { ProductCard } from "../../src/components/ProductCard";
import { ProductGridSkeleton } from "../../src/components/skeletons/ProductGridSkeleton";
import { ErrorState } from "../../src/components/ErrorState";
import { SearchIcon, CloseIcon, ClockIcon } from "../../src/components/icons/AppIcons";
import { colors } from "../../src/constants/theme";

// Sugerencias visibles antes de que el usuario escriba — son recomendaciones
// fijas, no historial real. El header lo nombra "Búsquedas populares" para
// no engañar (Apple §1.1.6: no false/misleading information).
const SUGERENCIAS_BUSQUEDA = ["Jack Daniel's", "Olmeca Reposado", "Something Special", "Absolut", "Bacardi", "Casillero del Diablo"];
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
        backgroundColor: colors.lowfill,
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
        style={{ flex: 1, fontSize: 12, fontWeight: "700", color: colors.ink }}
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
  const inputRef = useRef<TextInput>(null);

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

  const SEARCH_PAGE_SIZE = 20;

  const {
    data: searchData,
    isLoading,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["buscar", debouncedQuery],
    queryFn: ({ pageParam }) =>
      buscarProductos(debouncedQuery, { pagina: pageParam, limite: SEARCH_PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.paginas > allPages.length ? allPages.length + 1 : undefined,
    enabled: debouncedQuery.length >= 2,
  });

  // Apple §1.4.3 — defensa cliente en iOS contra resultados de tabaco.
  // Apple 2.1a — `p?.productos ?? []` evita TypeError si el backend devuelve
  // una página sin `productos` (null/ausente) tras filtrar tabaco en /buscar.
  const resultados = filtrarProductosIOS(
    searchData?.pages.flatMap((p) => p?.productos ?? []) ?? [],
  );
  const totalResultados = searchData?.pages[0]?.total ?? 0;

  const hasResults = debouncedQuery.length >= 2 && resultados.length > 0 && !isError;
  const noResults = debouncedQuery.length >= 2 && resultados.length === 0 && !isLoading && !isError;
  const showExplore = debouncedQuery.length < 2;

  const { data: categoriasRaw = [] } = useQuery({
    queryKey: ["categorias"],
    queryFn: getCategorias,
  });
  // Apple §1.4.3 — filtro centralizado de tabaco/vape para iOS.
  const categorias = filtrarCategoriasIOS(categoriasRaw);

  const { data: destacadosRaw = [] } = useQuery({
    queryKey: ["destacados"],
    queryFn: getDestacados,
    enabled: showExplore,
  });
  const destacados = filtrarProductosIOS(destacadosRaw);

  useEffect(() => {
    if (debouncedQuery.length >= 2 && !isLoading) {
      if (totalResultados === 0) {
        tracker.track("busqueda_sin_resultado", { q: debouncedQuery }, "search");
      } else {
        tracker.track("busqueda", { q: debouncedQuery, resultados: totalResultados }, "search");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- totalResultados de primera página, gate isLoading
  }, [debouncedQuery, isLoading]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
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
        <Pressable
          onPress={() => inputRef.current?.focus()}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            backgroundColor: focused ? "#FFFFFF" : colors.lowfill,
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
          <SearchIcon color={focused ? "#1FAF55" : colors.faint} size={18} />
          <TextInput
            ref={inputRef}
            style={{ flex: 1, fontSize: 15, color: colors.ink }}
            placeholder="Busca licores o snacks..."
            placeholderTextColor={colors.faint}
            value={query}
            onChangeText={handleChange}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            autoFocus={false}
            blurOnSubmit={false}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <Pressable
              onPress={() => {
                setQuery("");
                setDebouncedQuery("");
              }}
              hitSlop={8}
            >
              <CloseIcon color={colors.faint} size={16} />
            </Pressable>
          )}
        </Pressable>
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
          keyboardShouldPersistTaps="handled"
          keyExtractor={(item) => String(item.id)}
          onEndReachedThreshold={0.5}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) fetchNextPage();
          }}
          ListFooterComponent={
            isFetchingNextPage ? (
              <View style={{ paddingVertical: 16, alignItems: "center" }}>
                <ActivityIndicator color="#1FAF55" />
              </View>
            ) : null
          }
          ListHeaderComponent={
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <Text style={{ fontSize: 18, fontWeight: "800", color: colors.ink }}>Resultados</Text>
              <Text style={{ fontSize: 12, color: colors.muted }}>{totalResultados} productos</Text>
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
            backgroundColor: colors.lowfill,
            alignItems: "center", justifyContent: "center",
            marginBottom: 12,
          }}>
            <SearchIcon color={colors.faint} size={32} />
          </View>
          <Text style={{ fontSize: 16, fontWeight: "700", color: colors.muted }}>
            Sin resultados para &quot;{debouncedQuery}&quot;
          </Text>
          <Text style={{ fontSize: 12, color: colors.faint, marginTop: 4 }}>
            Intenta con otro término
          </Text>
        </View>
      )}

      {/* Explore */}
      {showExplore && (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 120 }}>
          {/* Recent Searches */}
          <View style={{ paddingHorizontal: 16, marginBottom: 20, paddingTop: 16 }}>
            <Text style={{ fontSize: 10, fontWeight: "700", color: colors.faint, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10 }}>
              Búsquedas Populares
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {SUGERENCIAS_BUSQUEDA.map((term) => (
                <Pressable
                  key={term}
                  onPress={() => handleRecentSearch(term)}
                  style={{
                    backgroundColor: "#FFFFFF",
                    borderRadius: 9999,
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderWidth: 1,
                    borderColor: colors.line,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <ClockIcon color={colors.faint} size={13} />
                  <Text style={{ fontSize: 12, fontWeight: "500", color: colors.ink }}>{term}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {/* Categories Grid — 2 columns */}
          <View style={{ paddingHorizontal: 16, marginBottom: 24 }}>
            <Text style={{ fontSize: 18, fontWeight: "800", color: colors.ink, marginBottom: 16 }}>
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
                <Text style={{ fontSize: 18, fontWeight: "800", color: colors.ink }}>Sugerencias de Hoy</Text>
                <Pressable onPress={() => router.push("/(tabs)/")}>
                  <Text style={{ fontSize: 12, fontWeight: "700", color: colors.greenInk }}>Ver Todo</Text>
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
