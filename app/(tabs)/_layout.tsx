import { Redirect, Tabs } from "expo-router";
import { View, Text } from "react-native";
import { useAuthStore } from "../../src/stores/auth";
import { useCartStore } from "../../src/stores/cart";
import { HomeIcon, SearchIcon, CartIcon, OrdersIcon, ProfileIcon } from "../../src/components/icons/TabIcons";

export default function TabLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const itemCount = useCartStore((s) => s.getItemCount());

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#1FAF55",
        tabBarInactiveTintColor: "#9E9E9E",
        tabBarStyle: {
          position: "absolute",
          bottom: 12,
          left: 16,
          right: 16,
          height: 64,
          borderRadius: 32,
          backgroundColor: "rgba(255,255,255,0.95)",
          borderTopWidth: 0,
          paddingBottom: 0,
          paddingTop: 4,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.08,
          shadowRadius: 16,
          elevation: 12,
        },
        tabBarLabelStyle: {
          fontSize: 9,
          fontWeight: "700",
          textTransform: "uppercase",
          letterSpacing: 0.5,
          marginTop: -2,
        },
        headerStyle: { backgroundColor: "#fff", elevation: 2, shadowOpacity: 0.05 },
        headerTintColor: "#1A1C1A",
        headerTitle: () => (
          <View className="flex-row items-center">
            <Text style={{ fontStyle: "italic", fontWeight: "900", fontSize: 18, color: "#D33587" }}>
              Estanco
            </Text>
            <Text style={{ fontStyle: "italic", fontWeight: "900", fontSize: 18, color: "#1FAF55", marginLeft: 4 }}>
              Caquetá
            </Text>
            <Text style={{ fontStyle: "italic", fontWeight: "900", fontSize: 14, color: "#D33587", marginLeft: 4, textTransform: "uppercase" }}>
              EXPRESS
            </Text>
          </View>
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Inicio",
          tabBarIcon: ({ color, size }) => <HomeIcon color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: "Buscar",
          tabBarIcon: ({ color, size }) => <SearchIcon color={color} size={size} />,
          tabBarItemStyle: {
            backgroundColor: "rgba(31,175,85,0.1)",
            borderRadius: 20,
            marginHorizontal: 4,
          },
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: "Carrito",
          tabBarBadge: itemCount > 0 ? itemCount : undefined,
          tabBarBadgeStyle: { backgroundColor: "#D33587", fontSize: 10 },
          tabBarIcon: ({ color, size }) => <CartIcon color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: "Pedidos",
          headerShown: false,
          tabBarIcon: ({ color, size }) => <OrdersIcon color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Perfil",
          tabBarIcon: ({ color, size }) => <ProfileIcon color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
