import {
  View, Text, ScrollView, Pressable, StyleSheet,
} from "react-native";
import { Stack, useRouter, Redirect } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
import Toast from "react-native-toast-message";
import { getOfertas, type Oferta } from "../src/lib/api";
import { ProductCard } from "../src/components/ProductCard";
import { CountdownChip } from "../src/components/CountdownChip";
import { ProductGridSkeleton } from "../src/components/skeletons/ProductGridSkeleton";
import { ErrorState } from "../src/components/ErrorState";
import { useAuthStore } from "../src/stores/auth";
import { useCartStore } from "../src/stores/cart";
import { formatCOP } from "../src/lib/format";
import { getCatVisuals } from "../src/lib/catVisuals";

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

// Card oscura para la sección Relámpago (fondo rojo) — NO usa ProductCard
function FlashCard({ oferta }: { oferta: Oferta }) {
  const addItem = useCartStore((s) => s.addItem);
  const { gradient, emoji } = getCatVisuals(oferta.producto.categoria);
  const precioOferta = oferta.precio_oferta ?? oferta.producto.precio_app;
  const saving = oferta.producto.precio_app - precioOferta;

  const handleAdd = () => {
    if ((oferta.producto.stock_total ?? 0) <= 0) return;
    addItem({
      productoId: oferta.producto.id,
      nombre: oferta.producto.nombre,
      precioUnitario: precioOferta,
      imagenUrl: oferta.producto.imagen_url || undefined,
      stockMaximo: oferta.producto.stock_total,
    });
    Toast.show({
      type: "success",
      text1: "Agregado al carrito",
      text2: oferta.producto.nombre,
      visibilityTime: 1500,
    });
  };

  const agotado = (oferta.producto.stock_total ?? 0) <= 0;

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "rgba(255,255,255,0.10)",
        borderRadius: 14,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.14)",
      }}
    >
      {/* Imagen con gradiente de categoría */}
      <View style={{ height: 92 }}>
        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.87, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]}>
          <Text style={{ fontSize: 38, opacity: 0.28 }}>{emoji}</Text>
        </View>
        {/* Badge de ahorro */}
        {saving > 0 && (
          <View
            style={{
              position: "absolute",
              bottom: 6,
              right: 6,
              backgroundColor: "#1FAF55",
              borderRadius: 6,
              paddingHorizontal: 7,
              paddingVertical: 3,
            }}
          >
            <Text style={{ fontSize: 9, fontWeight: "800", color: "#fff" }}>
              -{formatCOP(saving)}
            </Text>
          </View>
        )}
      </View>

      {/* Contenido */}
      <View style={{ padding: 10 }}>
        <Text
          style={{ fontSize: 11, fontWeight: "700", color: "#fff", lineHeight: 15, marginBottom: 6 }}
          numberOfLines={2}
        >
          {oferta.producto.nombre}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View>
            <Text style={{ fontSize: 9, color: "rgba(255,255,255,0.40)", textDecorationLine: "line-through" }}>
              {formatCOP(oferta.producto.precio_app)}
            </Text>
            <Text style={{ fontSize: 17, fontWeight: "800", color: "#fff" }}>
              {formatCOP(precioOferta)}
            </Text>
          </View>
          <Pressable
            onPress={handleAdd}
            disabled={agotado}
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: agotado ? "rgba(255,255,255,0.30)" : "rgba(255,255,255,0.95)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 20, fontWeight: "700", color: "#DC2626", marginTop: -1 }}>+</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export default function OfertasScreen() {
  // Guards de auth + edad (Apple §1.4.3 + Ley 124) — deben estar al tope del componente
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isAuthLoading = useAuthStore((s) => s.isLoading);
  const cliente = useAuthStore((s) => s.cliente);

  if (isAuthLoading) return null;
  if (!isAuthenticated) return <Redirect href="/(auth)/login" />;
  if (cliente && !cliente.edad_confirmada) return <Redirect href="/(auth)/edad-confirmar" />;

  const router = useRouter();

  // Selectores inline (patrón obligatorio — los métodos del store no son reactivos)
  const itemCount = useCartStore((s) => s.items.reduce((sum, i) => sum + i.cantidad, 0));
  const total = useCartStore((s) => s.items.reduce((sum, i) => sum + i.cantidad * i.precioUnitario, 0));

  const { data: ofertas = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["ofertas"],
    queryFn: getOfertas,
    staleTime: 2 * 60 * 1000,
  });

  // Separar flash vs regulares
  const flash = ofertas.filter((o) => o.tipo === "oferta_relampago");
  const regular = ofertas.filter((o) => o.tipo !== "oferta_relampago");

  // Fecha de expiración más próxima entre las flash → para el chip del header rojo
  const proxFin = flash.reduce<string | null>(
    (acc, o) => (o.fecha_fin && (!acc || o.fecha_fin < acc) ? o.fecha_fin : acc),
    null
  );

  // Filas de 2 columnas para la sección Relámpago (ScrollView no soporta FlatList anidado)
  const flashRows: Oferta[][] = [];
  for (let i = 0; i < flash.length; i += 2) {
    flashRows.push(flash.slice(i, i + 2));
  }

  // Filas de 2 columnas para la sección regular
  const regularRows: Oferta[][] = [];
  for (let i = 0; i < regular.length; i += 2) {
    regularRows.push(regular.slice(i, i + 2));
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#FAFAF6" }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── Header blanco ── */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingTop: 56,
          paddingBottom: 14,
          paddingHorizontal: 16,
          backgroundColor: "#FFFFFF",
          borderBottomWidth: 1,
          borderBottomColor: "#E2E3DF",
          gap: 8,
        }}
      >
        <Pressable onPress={() => router.back()} style={{ paddingRight: 8 }}>
          <ChevronLeftIcon />
        </Pressable>
        <Text style={{ fontSize: 17, fontWeight: "800", color: "#1A1C1A" }}>Ofertas de hoy</Text>
        {!isLoading && ofertas.length > 0 && (
          <View
            style={{
              marginLeft: "auto",
              backgroundColor: "rgba(31,175,85,0.10)",
              borderRadius: 8,
              paddingHorizontal: 10,
              paddingVertical: 4,
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: "700", color: "#1FAF55" }}>
              {ofertas.length} activas
            </Text>
          </View>
        )}
      </View>

      {/* ── Body ── */}
      {isLoading ? (
        <View style={{ padding: 16 }}>
          <ProductGridSkeleton count={4} />
        </View>
      ) : isError ? (
        <View style={{ flex: 1, justifyContent: "center" }}>
          <ErrorState mensaje="No pudimos cargar las ofertas" onRetry={refetch} />
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 132 }}
        >
          {/* ── Sección Relámpago (solo si hay flash) ── */}
          {flash.length > 0 && (
            <View
              style={{
                backgroundColor: "#DC2626",
                paddingHorizontal: 14,
                paddingTop: 14,
                paddingBottom: 18,
              }}
            >
              {/* Encabezado */}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <Text style={{ fontSize: 18 }}>⚡</Text>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "900",
                      color: "#fff",
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                    }}
                  >
                    Ofertas Relámpago
                  </Text>
                  <Text style={{ fontSize: 10, color: "rgba(255,255,255,0.65)", marginTop: 1 }}>
                    Solo por tiempo limitado
                  </Text>
                </View>
                <CountdownChip expiresAt={proxFin} color="rgba(0,0,0,0.20)" />
              </View>

              {/* Grid 2 columnas */}
              <View style={{ gap: 10 }}>
                {flashRows.map((row, rowIdx) => (
                  <View key={rowIdx} style={{ flexDirection: "row", gap: 10 }}>
                    {row.map((oferta) => (
                      <FlashCard key={oferta.id} oferta={oferta} />
                    ))}
                    {/* Filler para fila impar */}
                    {row.length === 1 && <View style={{ flex: 1 }} />}
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* ── Divider "Todas las ofertas" (solo si hay ambas secciones) ── */}
          {flash.length > 0 && regular.length > 0 && (
            <View
              style={{
                paddingHorizontal: 16,
                paddingTop: 16,
                marginBottom: 14,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View style={{ flex: 1, height: 1, backgroundColor: "#E2E3DF" }} />
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "700",
                    color: "#6D7B6C",
                    textTransform: "uppercase",
                    letterSpacing: 1,
                    paddingHorizontal: 10,
                  }}
                >
                  Todas las ofertas
                </Text>
                <View style={{ flex: 1, height: 1, backgroundColor: "#E2E3DF" }} />
              </View>
            </View>
          )}

          {/* ── Sección regular (ProductCard existente) ── */}
          {regular.length > 0 && (
            <View style={{ paddingHorizontal: 12, paddingTop: flash.length === 0 ? 12 : 0, gap: 10 }}>
              {regularRows.map((row, rowIdx) => (
                <View key={rowIdx} style={{ flexDirection: "row", gap: 10 }}>
                  {row.map((oferta) => (
                    <ProductCard
                      key={oferta.id}
                      product={oferta.producto}
                      oferta={{ titulo: oferta.titulo, precio_oferta: oferta.precio_oferta }}
                      onPress={() => router.push(`/product/${oferta.producto.id}`)}
                    />
                  ))}
                  {/* Filler para fila impar */}
                  {row.length === 1 && <View style={{ flex: 1 }} />}
                </View>
              ))}
            </View>
          )}

          {/* ── Estado vacío ── */}
          {ofertas.length === 0 && (
            <View style={{ flex: 1, alignItems: "center", paddingTop: 48 }}>
              <Text style={{ fontSize: 16, color: "#9CA3AF" }}>
                No hay ofertas activas ahora
              </Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* ── Floating Cart Bar ── */}
      {itemCount > 0 && (
        <Pressable
          onPress={() => router.push("/(tabs)/cart")}
          style={{
            position: "absolute",
            left: 16,
            right: 16,
            bottom: 80,
            backgroundColor: "rgba(255,255,255,0.92)",
            borderRadius: 16,
            padding: 14,
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.12,
            shadowRadius: 16,
            elevation: 10,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: "#1FAF55",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "800", fontSize: 13 }}>{itemCount}</Text>
            </View>
            <View style={{ marginLeft: 12 }}>
              <Text style={{ fontSize: 9, fontWeight: "700", color: "#9E9E9E", textTransform: "uppercase", letterSpacing: 0.5 }}>
                Tu Pedido
              </Text>
              <Text style={{ fontSize: 14, fontWeight: "800", color: "#1A1C1A" }}>
                {formatCOP(total)}
              </Text>
            </View>
          </View>
          <View style={{ paddingHorizontal: 20, paddingVertical: 8, borderRadius: 8, backgroundColor: "#D33587" }}>
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Ver Carrito
            </Text>
          </View>
        </Pressable>
      )}
    </View>
  );
}
