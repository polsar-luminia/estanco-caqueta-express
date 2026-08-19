// Pantalla de categoria — rediseno del catalogo 1.3.0.
//
// DOS FORMAS, SEGUN LO QUE TENGA LA CATEGORIA:
//
//   - con subcategorias (Licores, Snacks, Bebidas sin Alcohol, Dulces):
//     imagen arriba, buscador, y un carril horizontal por subcategoria con su
//     "Mostrar mas". Todo llega en UNA peticion.
//   - sin subcategorias (Hielo y Fiesta, o cualquier hoja como Whisky):
//     la rejilla con scroll infinito de siempre, intacta.
//
// LO QUE SE ARREGLO DE PASO: el nombre de la categoria se deducia DEL PRIMER
// PRODUCTO de la primera pagina. Alcanzaba mientras la pantalla fuera una sola
// rejilla, pero significaba que una categoria sin resultados se quedaba hasta
// sin titulo, y que el titulo aparecia tarde. Ahora viene del servidor.

import { View, Text, FlatList, Pressable, ActivityIndicator, ScrollView } from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Feather } from "@expo/vector-icons";
import Svg, { Path } from "react-native-svg";
import { getProductos, getCategoriaCarriles, type Producto } from "../../src/lib/api";
import { esCategoriaProhibidaIOS, filtrarProductosIOS, filtrarCategoriasIOS } from "../../src/lib/iosFilters";
import { colors, shadows, radii } from "../../src/constants/theme";

type GridItem = Producto | { id: number; _spacer: true };
import { tracker } from "../../src/lib/tracker";
import { ProductCard } from "../../src/components/ProductCard";
import { CarrilProductos } from "../../src/components/CarrilProductos";
import { ShimmerImage } from "../../src/components/ShimmerImage";
import { ProductGridSkeleton } from "../../src/components/skeletons/ProductGridSkeleton";
import { ErrorState } from "../../src/components/ErrorState";
import { CartFloatingBar } from "../../src/components/CartFloatingBar";
import { useCartStore } from "../../src/stores/cart";

const PANTALLA = "category/[id]";

function ChevronLeftIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M15 18l-6-6 6-6" stroke="#1A1C1A" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export default function CategoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const cartCount = useCartStore((s) => s.items.reduce((n, i) => n + i.cantidad, 0));
  const categoriaId = id && id.trim() ? Number(id) : NaN;
  const habilitada = Number.isFinite(categoriaId) && categoriaId > 0;

  const PAGE_SIZE = 20;

  // Una sola peticion trae la categoria y sus carriles. Si no tiene hijas,
  // `carriles` llega vacio y usamos la consulta paginada de abajo.
  const {
    data: cat,
    isLoading: cargandoCat,
    isError: errorCat,
    refetch: recargarCat,
  } = useQuery({
    queryKey: ["categoria", categoriaId],
    queryFn: () => getCategoriaCarriles(categoriaId),
    enabled: habilitada,
  });

  // filtrarCategoriasIOS se aplica a la lista QUE SE PINTA, no solo a un conteo.
  // Antes su resultado se tiraba (solo se usaba el .length para decidir si habia
  // carriles) y el render recorria la lista sin filtrar por nombre: en iOS, una
  // subcategoria de tabaco cuyos productos no cayeran en el filtro por producto
  // seguia mostrando su titulo. Nada fallaba; se colaba justo lo de la §1.4.3.
  const carriles = filtrarCategoriasIOS(
    (cat?.carriles ?? []).map((c) => ({ ...c, items: filtrarProductosIOS(c.items) })),
  );
  const tieneCarriles = carriles.length > 0;

  const {
    data,
    isLoading: cargandoProds,
    isError: errorProds,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["productos", "categoria", categoriaId],
    queryFn: ({ pageParam }) =>
      getProductos({ categoria: categoriaId, pagina: pageParam, limite: PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.paginas > allPages.length ? allPages.length + 1 : undefined,
    // Solo se pide cuando de verdad hace falta: con carriles, esta consulta
    // traeria los mismos productos otra vez y por la red del cliente.
    enabled: habilitada && cat != null && !tieneCarriles,
  });

  // Apple §1.4.3 — defensa cliente en iOS: si por error llega un producto
  // de tabaco/vape, lo filtramos. El backend ya bloquea por X-Platform.
  // Apple 2.1a — `p?.productos ?? []` evita TypeError si una página llega
  // sin `productos` (null/ausente).
  const productos = filtrarProductosIOS(
    data?.pages.flatMap((p) => p?.productos ?? []) ?? [],
  );
  const nombreCategoria = cat?.categoria?.nombre ?? "Categoría";
  const categoriaBloqueada = esCategoriaProhibidaIOS(nombreCategoria);

  useEffect(() => {
    if (!cat?.categoria) return;
    const esGrande = cat.categoria.categoria_padre_id === null;
    // Dos eventos distintos y no uno con bandera: la pregunta de negocio es
    // distinta. "Que categoria grande abren" dice si la cuadricula funciona;
    // "que subcategoria abren" dice si el carril de esa categoria vende.
    tracker.track(
      esGrande ? 'categoria_grande_abierta' : 'subcategoria_abierta',
      esGrande
        ? { categoria_id: cat.categoria.id, nombre: cat.categoria.nombre }
        : { categoria_id: cat.categoria.id, nombre: cat.categoria.nombre, categoria_padre_id: cat.categoria.categoria_padre_id },
      PANTALLA,
    );
    // El evento viejo se mantiene: los embudos historicos lo usan y perderlo
    // cortaria la serie justo en el cambio de diseno, que es cuando hay que
    // poder comparar.
    tracker.track('categoria_abierta', { categoria_id: cat.categoria.id, nombre: cat.categoria.nombre }, PANTALLA);
  }, [cat?.categoria?.id]);

  // "No encontrada" es una afirmacion sobre el catalogo: el id no existe, o es
  // una categoria bloqueada en la tienda. Un fallo de RED no es eso, y decirselo
  // al cliente lo manda a buscar el producto a otra parte cuando lo unico que
  // pasa es que se le cayo la senal. Por eso son dos pantallas distintas y la de
  // red ofrece reintentar.
  if (!habilitada || categoriaBloqueada) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
        <Text style={{ fontSize: 48, marginBottom: 12 }}>😕</Text>
        <Text style={{ fontSize: 18, fontWeight: "600", color: "#1F1F1F", textAlign: "center" }}>
          Categoría no encontrada
        </Text>
      </View>
    );
  }

  if (errorCat && !cargandoCat) {
    return (
      <View style={{ flex: 1, justifyContent: "center", backgroundColor: colors.bg }}>
        <ErrorState mensaje="No pudimos cargar esta categoría" onRetry={recargarCat} />
      </View>
    );
  }

  const Cabecera = (
    <View>
      {/* Imagen de la categoria. Sale de categorias.imagen_url, no de un mapa
          indexado por el nombre en español: las categorias nuevas no estarian
          en ese mapa y saldrian todas grises. */}
      {(cat?.categoria?.banner_url || cat?.categoria?.imagen_url_thumb || cat?.categoria?.imagen_url) ? (
        <View style={{ marginHorizontal: 16, height: 120, borderRadius: radii.card, overflow: "hidden", backgroundColor: colors.surface }}>
          {/* El banner manda cuando existe: viene apaisado (1170x360) y esta
              franja es casi la misma proporcion, asi que `cover` casi no
              recorta. Sin banner se cae a la miniatura cuadrada, que es lo que
              habia antes — se recorta feo, pero es preferible a una cabecera
              vacia mientras las categorias no tengan su banner.

              La miniatura sigue primero que la original entre los respaldos:
              una franja de 120 dp no justifica 700 KB. */}
          <ShimmerImage
            imageUrl={cat.categoria.banner_url || cat.categoria.imagen_url_thumb || cat.categoria.imagen_url}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
          />
        </View>
      ) : null}

      <Pressable
        onPress={() => router.push("/(tabs)/search")}
        style={{
          flexDirection: "row", alignItems: "center", gap: 8,
          marginHorizontal: 16, marginTop: 12,
          backgroundColor: colors.surface, borderRadius: radii.input,
          paddingHorizontal: 13, paddingVertical: 11,
          ...shadows.soft,
        }}
        accessibilityLabel="Buscar productos"
        accessibilityRole="search"
        hitSlop={4}
      >
        <Feather name="search" size={16} color={colors.faint} />
        <Text style={{ fontSize: 12.5, color: colors.faint, fontWeight: "500" }}>Encuentra tus productos</Text>
      </Pressable>
    </View>
  );

  return (
    <View className="flex-1" style={{ backgroundColor: colors.bg }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header propio (Vibrante): botón back redondeado + título */}
      <View
        style={{
          flexDirection: "row", alignItems: "center", gap: 10,
          paddingTop: insets.top + 10, paddingBottom: 12, paddingHorizontal: 14,
          backgroundColor: colors.bg,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Volver a la pantalla anterior"
          hitSlop={3}
          style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", ...shadows.soft }}
        >
          <ChevronLeftIcon />
        </Pressable>
        <Text
          style={{ flex: 1, fontSize: 18, fontWeight: "800", color: colors.ink, letterSpacing: -0.2 }}
          numberOfLines={1}
        >
          {cargandoCat ? "" : nombreCategoria}
        </Text>
      </View>

      {cargandoCat ? (
        <View className="p-4">
          <ProductGridSkeleton count={8} />
        </View>
      ) : tieneCarriles ? (
        <ScrollView contentContainerStyle={{ paddingBottom: cartCount > 0 ? 96 + insets.bottom : 24 }}>
          {Cabecera}
          {carriles.map((c) => (
            <CarrilProductos
              key={c.id}
              titulo={c.nombre}
              productos={c.items}
              origen={c.nombre}
              destinoVerMas="categoria"
              onVerMas={() => router.push(`/category/${c.id}`)}
              onPressProducto={(pid) => router.push(`/product/${pid}`)}
              pantalla={PANTALLA}
            />
          ))}
        </ScrollView>
      ) : errorProds ? (
        <View style={{ flex: 1, justifyContent: "center" }}>
          <ErrorState mensaje="No pudimos cargar esta categoría" onRetry={refetch} />
        </View>
      ) : cargandoProds ? (
        <View className="p-4">
          <ProductGridSkeleton count={8} />
        </View>
      ) : (
        <FlatList<GridItem>
          data={(() => {
            const gridData: GridItem[] =
              productos.length % 2 !== 0
                ? [...productos, { id: -1, _spacer: true }]
                : productos;
            return gridData;
          })()}
          numColumns={2}
          ListHeaderComponent={<View style={{ marginHorizontal: -16, marginBottom: 4 }}>{Cabecera}</View>}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: cartCount > 0 ? 96 + insets.bottom : 16 }}
          columnWrapperStyle={{ gap: 12 }}
          keyExtractor={(item) => String(item.id)}
          initialNumToRender={8}
          maxToRenderPerBatch={4}
          windowSize={5}
          onEndReachedThreshold={0.5}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) fetchNextPage();
          }}
          ListFooterComponent={
            isFetchingNextPage ? (
              <View style={{ paddingVertical: 16, alignItems: "center" }}>
                <ActivityIndicator color={colors.green} />
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View className="items-center py-8">
              <Text style={{ color: "#9CA3AF" }}>No hay productos en esta categoría</Text>
            </View>
          }
          renderItem={({ item, index }) => {
            if ("_spacer" in item) return <View style={{ flex: 1 }} />;
            return (
              <ProductCard
                product={item}
                onPress={() => router.push(`/product/${item.id}`)}
                priority={index < 8 ? "high" : "normal"}
                origen={`categoria:${nombreCategoria}`}
                posicion={index}
              />
            );
          }}
        />
      )}

      {/* Banda flotante "Ver carrito" — pantalla empujada sin tab bar, va abajo */}
      <CartFloatingBar bottomOffset={24 + insets.bottom} />
    </View>
  );
}
