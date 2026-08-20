import { Pressable, View, Text, Image, Platform } from "react-native";
import { Redirect, Tabs, useSegments, useRouter } from "expo-router";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useAuthStore } from "../../src/stores/auth";
import { grupoDebeConfirmarEdad } from "../../src/lib/guardEdad";
import { useCartStore } from "../../src/stores/cart";
import { HomeIcon, SearchIcon, CartIcon, OrdersIcon } from "../../src/components/icons/TabIcons";


const RADIO_BARRA = 26;

// Fondo de vidrio de la barra inferior.
//
// El desenfoque es un modulo NATIVO (expo-blur): no viaja por OTA. Un binario
// que no lo traiga compilado no puede pintar esto, por eso el fondo se apoya en
// una capa de color propia y no depende del blur para verse bien.
//
// La capa clara ENCIMA del blur no es decoracion: el desenfoque solo a secas
// deja pasar demasiado color del contenido que pasa por debajo —el magenta de
// Ofertas, por ejemplo— y los iconos dejan de leerse. El velo la sostiene en un
// rango claro constante sin matar el efecto.
function FondoVidrio() {
  return (
    <View style={{ flex: 1, borderRadius: RADIO_BARRA, overflow: "hidden" }}>
      <BlurView
        intensity={Platform.OS === "ios" ? 60 : 40}
        tint="light"
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      />
      <View
        style={{
          position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: "rgba(255,255,255,0.55)",
        }}
      />
      {/* Filo superior claro: es lo que da el borde de cristal en vez de un
          rectangulo translucido plano. */}
      <View
        style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 1,
          backgroundColor: "rgba(255,255,255,0.75)",
        }}
      />
    </View>
  );
}

// Magenta de la organización (Polo & Salazar)
const MAGENTA = "#D33587";

// Botones del header del logo (Inicio): perfil (izq) + buscar (der).
// useRouter interno → sin closures frágiles. Perfil ya no es tab inferior.
function HeaderProfileBtn() {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push("/profile")}
      accessibilityRole="button"
      accessibilityLabel="Mi perfil"
      hitSlop={10}
      style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 16, paddingVertical: 8 }}
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
      accessibilityRole="button"
      accessibilityLabel="Buscar productos"
      hitSlop={10}
      style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 16, paddingVertical: 8 }}
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
      accessibilityRole="tab"
      // `selected` es lo que hace que el lector diga "pestaña 2 de 5, seleccionada".
      // El badge del carrito va en la etiqueta porque el circulo con el numero es
      // puramente visual.
      accessibilityState={{ selected: focused }}
      accessibilityLabel={badge != null && badge > 0 ? `${label}, ${badge} productos` : label}
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
            borderRadius: 9, minWidth: 18, height: 18,
            alignItems: "center", justifyContent: "center",
            paddingHorizontal: 4,
          }}>
            <Text style={{
              fontSize: 12, fontWeight: "800",
              color: focused ? "#1FAF55" : "#fff",
            }}>
              {badge > 99 ? "99+" : badge}
            </Text>
          </View>
        )}
      </View>

      {/* Label */}
      <Text style={{
        fontSize: 12,
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
  const insets = useSafeAreaInsets();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const cliente = useAuthStore((s) => s.cliente);
  // Selector inline (no método): los métodos del store no son reactivos a cambios
  // del state — el badge no se actualizaba al limpiar carrito tras crear pedido.
  const itemCount = useCartStore((s) => s.items.reduce((sum, i) => sum + i.cantidad, 0));
  const segments = useSegments();

  if (isLoading) return null;

  // Guía 5.1.1(v) — el catálogo debe ser accesible sin login.
  // profile.tsx y orders/index.tsx tienen su propio guard para
  // redirigir a login cuando se requiere autenticación.

  // Apple App Store §1.4.3 — bloquear acceso al catálogo hasta que el usuario
  // confirme explícitamente que es mayor de 18.
  //
  // Solo cuando `(tabs)` es la ruta ACTIVA: este layout queda montado debajo del
  // mapa y del onboarding, y redirigir desde el fondo tumbaba la pantalla en uso
  // (bug del 17-ago; ver grupoDebeConfirmarEdad). No abre ningún hueco: si la
  // persona vuelve al catálogo, `(tabs)` vuelve a ser la ruta activa y el guard
  // dispara antes de mostrar nada.
  if (grupoDebeConfirmarEdad(segments as string[], "(tabs)", isAuthenticated, cliente != null, cliente?.edad_confirmada)) {
    return <Redirect href="/(auth)/edad-confirmar" />;
  }

  return (
    <Tabs
      screenOptions={{
        tabBarStyle: {
          position: "absolute",
          // Separada de los bordes. Abajo se apoya en el area segura para no
          // quedar encima del indicador de inicio: con un 12 fijo, en los
          // iPhone con indicador la barra se le montaba encima.
          bottom: insets.bottom > 0 ? insets.bottom - 6 : 18,
          left: 18,
          right: 18,
          height: 64,
          borderRadius: RADIO_BARRA,
          // Transparente: el fondo lo pinta FondoVidrio (tabBarBackground). Con
          // un color aqui, el desenfoque quedaria tapado por debajo y no se
          // veria nada del efecto.
          backgroundColor: "transparent",
          borderTopWidth: 0,
          // El vidrio se recorta a las esquinas; sin esto el blur sale cuadrado
          // por debajo del radio.
          overflow: "hidden",
          paddingBottom: 8,
          paddingTop: 8,
          paddingHorizontal: 6,
          shadowColor: "#0B1F12",
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.16,
          shadowRadius: 24,
          elevation: 12,
        },
        tabBarBackground: () => <FondoVidrio />,
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
          // El Inicio ahora trae su propio header verde (ubicación + buscador + carrito),
          // definido dentro de app/(tabs)/index.tsx. Ocultamos el header del logo aquí.
          headerShown: false,
          tabBarButton: (props) => (
            <TabButton {...props} routeName="index" label="Inicio" icon={HomeIcon} />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: "Buscar",
          // Buscar tiene su propio header (la barra de búsqueda). Ocultamos el
          // header del logo para que no quede el espacio muerto duplicado arriba.
          headerShown: false,
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
