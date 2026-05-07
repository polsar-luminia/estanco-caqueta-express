import { View, Text, FlatList, Pressable } from "react-native";
import { Stack, useRouter, Redirect } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import Svg, { Path } from "react-native-svg";
import { getOfertas, type Oferta } from "../src/lib/api";
import { ProductCard } from "../src/components/ProductCard";
import { ProductGridSkeleton } from "../src/components/skeletons/ProductGridSkeleton";
import { ErrorState } from "../src/components/ErrorState";
import { useAuthStore } from "../src/stores/auth";

function ChevronLeftIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M15 18l-6-6 6-6"
        stroke="#1A1C1A"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function OfertasScreen() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isAuthLoading = useAuthStore((s) => s.isLoading);
  const cliente = useAuthStore((s) => s.cliente);

  if (isAuthLoading) return null;
  if (!isAuthenticated) return <Redirect href="/(auth)/login" />;
  if (cliente && !cliente.edad_confirmada) return <Redirect href="/(auth)/edad-confirmar" />;

  const router = useRouter();

  const { data: ofertas = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["ofertas"],
    queryFn: getOfertas,
    staleTime: 2 * 60 * 1000,
  });

  return (
    <View style={{ flex: 1, backgroundColor: "#FAFAF6" }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingTop: 56,
          paddingBottom: 16,
          paddingHorizontal: 16,
          backgroundColor: "#FAFAF6",
          borderBottomWidth: 1,
          borderBottomColor: "#EFEFEB",
        }}
      >
        <Pressable
          onPress={() => router.back()}
          style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingRight: 16 }}
        >
          <ChevronLeftIcon />
          <Text style={{ fontSize: 15, fontWeight: "600", color: "#1A1C1A" }}>
            Volver
          </Text>
        </Pressable>

        <View style={{ flex: 1, alignItems: "center", marginRight: 60 }}>
          <Text
            style={{ fontSize: 17, fontWeight: "800", color: "#1A1C1A" }}
            numberOfLines={1}
          >
            Ofertas de hoy
          </Text>
          {!isLoading && ofertas.length > 0 && (
            <Text style={{ fontSize: 11, color: "#6D7B6C", marginTop: 1 }}>
              {ofertas.length} producto{ofertas.length !== 1 ? "s" : ""}
            </Text>
          )}
        </View>
      </View>

      {/* Body */}
      {isLoading ? (
        <View style={{ padding: 16 }}>
          <ProductGridSkeleton count={4} />
        </View>
      ) : isError ? (
        <View style={{ flex: 1, justifyContent: "center" }}>
          <ErrorState
            mensaje="No pudimos cargar las ofertas"
            onRetry={refetch}
          />
        </View>
      ) : (
        <FlatList<Oferta>
          data={ofertas}
          keyExtractor={(item) => String(item.id)}
          numColumns={2}
          columnWrapperStyle={{ gap: 10 }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          contentContainerStyle={{
            paddingBottom: 120,
            paddingHorizontal: 12,
            paddingTop: 12,
          }}
          ListEmptyComponent={
            <View style={{ flex: 1, alignItems: "center", paddingTop: 48 }}>
              <Text style={{ fontSize: 16, color: "#9CA3AF" }}>
                No hay ofertas activas ahora
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <ProductCard
              product={item.producto}
              oferta={{ titulo: item.titulo, precio_oferta: item.precio_oferta }}
              onPress={() => router.push(`/product/${item.producto.id}`)}
            />
          )}
        />
      )}
    </View>
  );
}
