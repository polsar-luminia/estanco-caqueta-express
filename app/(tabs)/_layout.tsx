import { Redirect, Tabs } from "expo-router";
import { useAuthStore } from "../../src/stores/auth";
import { useCartStore } from "../../src/stores/cart";

export default function TabLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const itemCount = useCartStore((s) => s.getItemCount());

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#17994A",
        tabBarInactiveTintColor: "#9E9E9E",
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: "#E0E0E0",
          height: 60,
          paddingBottom: 8,
          paddingTop: 4,
        },
        tabBarLabelStyle: { fontSize: 11 },
        headerStyle: { backgroundColor: "#17994A" },
        headerTintColor: "#fff",
        headerTitleStyle: { fontWeight: "bold" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Inicio",
          headerTitle: "Estanco Caqueta Express",
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: "Buscar",
          headerTitle: "Buscar productos",
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: "Carrito",
          headerTitle: "Tu carrito",
          tabBarBadge: itemCount > 0 ? itemCount : undefined,
          tabBarBadgeStyle: { backgroundColor: "#D33587" },
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: "Pedidos",
          headerTitle: "Mis pedidos",
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Perfil",
          headerTitle: "Mi perfil",
        }}
      />
    </Tabs>
  );
}
