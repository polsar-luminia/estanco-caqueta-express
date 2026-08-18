// Pantalla de inicio — rediseno del catalogo 1.3.0.
//
// LA PORTADA YA NO SE DECIDE AQUI. Antes este archivo tenia el orden quemado en
// el JSX: categorias, ofertas, hero, combos, destacados y una franja rosada de
// "Servicio Express" con su color y sus textos escritos a mano. Cambiar
// cualquiera de esas cosas era una version nueva en las tiendas. Ahora la lista
// de secciones llega de GET /catalogo/inicio y esta pantalla solo la dibuja.
//
// EL BANNER VA PRIMERO, y eso invierte a proposito una decision que llevaba
// meses escrita justo aqui: "Ofertas primero: los precios especiales son plata
// concreta para el cliente, el banner es marketing". El diseno nuevo pone el
// banner arriba del todo. Es un cambio consciente y ya no vive en el codigo: hoy
// es el campo `orden` de una fila, y volver atras no exige publicar nada.
//
// La cabecera verde se queda encima de las secciones porque tiene el buscador y
// los accesos a perfil y carrito, que no son contenido de la portada. Lo que si
// se le quito es la direccion de entrega: ahora es su propia seccion, en una
// tarjeta redondeada que monta sobre el banner.

import { View, Text, ScrollView, RefreshControl, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { colors, radii, fuentes } from "../../src/constants/theme";
import { getInicio, getDirecciones } from "../../src/lib/api";
import { useCartStore } from "../../src/stores/cart";
import { useAuthStore } from "../../src/stores/auth";
import { useTiendaAbierta } from "../../src/hooks/useTiendaAbierta";
import { BandaCerrado } from "../../src/components/BandaCerrado";
import { BannerResena } from "../../src/components/BannerResena";
import { CartFloatingBar } from "../../src/components/CartFloatingBar";
import { ProductGridSkeleton } from "../../src/components/skeletons/ProductGridSkeleton";
import { CategoryStripSkeleton } from "../../src/components/skeletons/CategoryStripSkeleton";
import { SkeletonBox } from "../../src/components/skeletons/SkeletonBox";
import { ErrorState } from "../../src/components/ErrorState";
import { Seccion } from "../../src/components/secciones/RegistroSecciones";

// Cabecera verde: avatar + buscador. Ya no lleva la direccion (ahora es su propia
// seccion, en la tarjeta redondeada que monta sobre el banner) ni el carrito: el
// carrito tiene su pestana abajo y ademas la banda flotante aparece sola apenas
// hay algo dentro, asi que el icono de arriba era un tercer camino al mismo sitio
// quitandole ancho al buscador.
function HomeHeader({
  insets, router,
}: {
  insets: { top: number };
  router: ReturnType<typeof useRouter>;
}) {
  const iconBtn = {
    width: 40, height: 40, borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center" as const, justifyContent: "center" as const,
  };
  return (
    <View
      style={{
        backgroundColor: colors.green,
        paddingTop: insets.top + 8,
        paddingHorizontal: 16,
        paddingBottom: 16,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
        shadowColor: colors.greenDeep,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.35,
        shadowRadius: 18,
        elevation: 8,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Pressable onPress={() => router.push("/profile")} style={iconBtn} accessibilityLabel="Abrir mi perfil" accessibilityRole="button" hitSlop={3}>
          <Feather name="user" size={19} color="#fff" />
        </Pressable>
        <Pressable
          onPress={() => router.push("/(tabs)/search")}
          style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#fff", borderRadius: radii.pill, paddingHorizontal: 16, paddingVertical: 11 }}
          accessibilityLabel="Buscar productos"
          accessibilityRole="search"
          hitSlop={4}
        >
          <Text style={{ fontFamily: fuentes.destacado, fontSize: 13.5, color: colors.faint }}>Encuentra tus productos</Text>
          <Feather name="search" size={17} color={colors.pink} />
        </Pressable>
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const cliente = useAuthStore((s) => s.cliente);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  // Selectores inline (no metodos): los metodos del store no son reactivos a
  // cambios del state — el banner inferior no desaparecia al limpiar carrito.
  const itemCount = useCartStore((s) => s.items.reduce((sum, i) => sum + i.cantidad, 0));

  const tienda = useTiendaAbierta();

  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: ["inicio"],
    queryFn: getInicio,
  });

  // Mismo queryKey que cart.tsx → cache compartida, sin fetch extra.
  // enabled gateado: invitado no dispara /clientes/direcciones (evita 401).
  const { data: direcciones = [] } = useQuery({
    queryKey: ["direcciones"],
    queryFn: getDirecciones,
    enabled: isAuthenticated,
    staleTime: 60 * 1000,
  });
  const dirPred = direcciones.find((d) => d.predeterminada) || direcciones[0];
  const dirActiva = dirPred?.direccion ?? cliente?.direccion ?? null;

  const secciones = data?.secciones ?? [];

  // onRefresh invalida TODO lo que alimenta esta pantalla. La version anterior
  // se dejaba fuera combos y hero-modo, asi que tirar para refrescar no los
  // actualizaba y no habia forma de notarlo.
  const onRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["inicio"] });
    queryClient.invalidateQueries({ queryKey: ["direcciones"] });
  };

  return (
    <View className="flex-1" style={{ backgroundColor: colors.bg }}>
      <HomeHeader insets={insets} router={router} />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: itemCount > 0 ? 172 : 102 }}
        refreshControl={
          <RefreshControl refreshing={!isLoading && isFetching} onRefresh={onRefresh} colors={[colors.green]} />
        }
      >
        {isLoading ? (
          <View className="px-4 pt-4" style={{ gap: 16 }}>
            <SkeletonBox style={{ height: 180 }} className="rounded-xl" />
            <SkeletonBox style={{ height: 56 }} className="rounded-xl" />
            <CategoryStripSkeleton />
            <ProductGridSkeleton count={4} />
          </View>
        ) : isError || secciones.length === 0 ? (
          <View style={{ flex: 1, paddingTop: 80 }}>
            <ErrorState mensaje="No pudimos cargar el catálogo" onRetry={onRefresh} />
          </View>
        ) : (
          <>
            {/* Banda de tienda cerrada — motivo/estilo lo decide el backend */}
            <BandaCerrado tienda={tienda} style={{ marginHorizontal: 16, marginTop: 12 }} />

            {/* Segunda oportunidad para calificar: el push llega una vez y muchas
                veces se descarta sin leer. Solo sale si hay un pedido entregado
                reciente sin reseña, y se puede quitar para siempre. */}
            <BannerResena habilitado={isAuthenticated} />

            {secciones.map((seccion, i) => (
              <Seccion
                key={seccion.id}
                seccion={seccion}
                ctx={{
                  router,
                  direccion: dirActiva,
                  autenticado: isAuthenticated,
                  trasBanner: secciones[i - 1]?.tipo === "banner",
                }}
              />
            ))}
          </>
        )}
      </ScrollView>

      {/* Antes esta barra estaba duplicada en linea aqui y en ofertas.tsx, con
          su propio markup. Ahora es el componente compartido. */}
      <CartFloatingBar bottomOffset={80} />
    </View>
  );
}
