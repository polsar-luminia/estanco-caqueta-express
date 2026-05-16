import { Pressable, View, Text, Image } from "react-native";
import { Redirect, Tabs, useSegments, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useAuthStore } from "../../src/stores/auth";
import { useCartStore } from "../../src/stores/cart";
import { HomeIcon, SearchIcon, CartIcon, OrdersIcon } from "../../src/components/icons/TabIcons";

// Magenta de la organización (Polo & Salazar)
const MAGENTA = "#D33587";

// Botones del header del logo (Inicio): perfil (izq) + buscar (der).
// useRouter interno → sin closures frágiles. Perfil ya no es tab inferior.
function HeaderProfileBtn() {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push("/profile")}
      hitSlop={10}
      style={{ paddingHorizontal: 16, paddingVertical: 8 }}
    >
      <Feather name="user" size={22} color={MAGENTA} />
    </Pressable>
  );
}

function HeaderSearchBtn() {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push("/(tabs)/search")}
      hitSlop={10}
      style={{ paddingHorizontal: 16, paddingVertical: 8 }}
    >
      <SearchIcon color={MAGENTA} size={22} />
    </Pressable>
  );
}

// ── Tab button flotante con chip verde ────────────────────────────────────────

interface TabButtonProps {
  children?: React.ReactNode;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onPress?: (...args: any[]) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onLongPress?: ((...args: any[]) => void) | null;
  accessibilityState?: { selected?: boolean };
  label: string;
  icon: React.ComponentType<{ color: string; size: number }>;
  badge?: number;
  /** Ruta del Tabs.Screen — usada para detectar focus via useSegments. */
  routeName: string;
}

function TabButton({ onPress, onLongPress, accessibilityState, label, icon: Icon, badge, routeName }: TabButtonProps) {
  // Doble fuente para detectar focus:
  // 1. accessibilityState.selected — funciona en algunos casos de React Navigation
  // 2. useSegments — fallback 100% reliable en Expo Router
  // El "index" (Inicio) es ruta default cuando no hay segmento adicional.
  const segments = useSegments();
  const lastSegment = segments[segments.length - 1];
  const onTabsRoot = segments[0] === "(tabs)";
  const focusedBySegment =
    routeName === "index"
      ? onTabsRoot && (lastSegment === "(tabs)" || lastSegment === "index")
      : lastSegment === routeName || segments.includes(routeName);
  const focused = (accessibilityState?.selected ?? false) || focusedBySegment;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      android_ripple={null}
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 14,
        backgroundColor: focused ? "#1FAF55" : "transparent",
        paddingVertical: 7,
        paddingHorizontal: 10,
        marginHorizontal: 2,
      }}
    >
      {/* Ícono con badge opcional */}
      <View style={{ position: "relative" }}>
        <Icon
          color={focused ? "#fff" : "rgba(26,28,26,0.38)"}
          size={20}
        />
        {(badge != null && badge > 0) && (
          <View style={{
            position: "absolute", top: -4, right: -6,
            backgroundColor: focused ? "#fff" : "#D33587",
            borderRadius: 8, minWidth: 15, height: 15,
            alignItems: "center", justifyContent: "center",
            paddingHorizontal: 3,
          }}>
            <Text style={{
              fontSize: 8, fontWeight: "800",
              color: focused ? "#1FAF55" : "#fff",
            }}>
              {badge > 99 ? "99+" : badge}
            </Text>
          </View>
        )}
      </View>

      {/* Label */}
      <Text style={{
        fontSize: 8.5,
        fontWeight: focused ? "700" : "500",
        color: focused ? "#fff" : "rgba(26,28,26,0.38)",
        marginTop: 3,
      }}>
        {label}
      </Text>
    </Pressable>
  );
}

// ── Layout principal ──────────────────────────────────────────────────────────

export default function TabLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const cliente = useAuthStore((s) => s.cliente);
  // Selector inline (no método): los métodos del store no son reactivos a cambios
  // del state — el badge no se actualizaba al limpiar carrito tras crear pedido.
  const itemCount = useCartStore((s) => s.items.reduce((sum, i) => sum + i.cantidad, 0));

  if (isLoading) return null;

  // Guía 5.1.1(v) — el catálogo debe ser accesible sin login.
  // profile.tsx y orders/index.tsx tienen su propio guard para
  // redirigir a login cuando se requiere autenticación.

  // Apple App Store §1.4.3 — bloquear acceso al catálogo hasta que el
  // usuario confirme explícitamente que es mayor de 18. Se usa !falsy
  // para cubrir false, null y undefined (respuesta de API que omite el campo).
  if (isAuthenticated && cliente && !cliente.edad_confirmada) {
    return <Redirect href="/(auth)/edad-confirmar" />;
  }

  return (
    <Tabs
      screenOptions={{
        tabBarStyle: {
          position: "absolute",
          bottom: 12,
          left: 12,
          right: 12,
          height: 64,
          borderRadius: 22,
          backgroundColor: "rgba(255,255,255,0.96)",
          borderTopWidth: 0,
          paddingBottom: 8,
          paddingTop: 8,
          paddingHorizontal: 6,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.13,
          shadowRadius: 32,
          elevation: 12,
        },
        tabBarActiveBackgroundColor: "transparent",
        // Ocultar labels y íconos nativos — los maneja TabButton
        tabBarShowLabel: false,
        headerStyle: { backgroundColor: "#fff", elevation: 1, shadowOpacity: 0.03, height: 100 },
        headerTintColor: "#1A1C1A",
        headerTitle: () => (
          <Image
            source={require("../../assets/logo-estanco.png")}
            style={{ width: 240, height: 54 }}
            resizeMode="contain"
          />
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Inicio",
          headerLeft: () => <HeaderProfileBtn />,
          headerRight: () => <HeaderSearchBtn />,
          tabBarButton: (props) => (
            <TabButton {...props} routeName="index" label="Inicio" icon={HomeIcon} />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: "Buscar",
          tabBarButton: (props) => (
            <TabButton {...props} routeName="search" label="Buscar" icon={SearchIcon} />
          ),
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: "Carrito",
          tabBarButton: (props) => (
            <TabButton {...props} routeName="cart" label="Carrito" icon={CartIcon} badge={itemCount} />
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: "Pedidos",
          headerShown: false,
          tabBarButton: (props) => (
            <TabButton {...props} routeName="orders" label="Pedidos" icon={OrdersIcon} />
          ),
        }}
      />
      {/* Perfil ya NO es tab inferior — se accede desde el botón del header
          (izq del logo). href:null lo saca del tab bar sin borrar la ruta;
          /profile sigue navegable vía router.push. */}
      <Tabs.Screen
        name="profile"
        options={{
          href: null,
          headerShown: false,
        }}
      />
    </Tabs>
  );
}
