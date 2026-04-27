import { Redirect, Tabs } from "expo-router";
import { View, Image } from "react-native";
import { useAuthStore } from "../../src/stores/auth";
import { useCartStore } from "../../src/stores/cart";
import { HomeIcon, SearchIcon, CartIcon, OrdersIcon, ProfileIcon } from "../../src/components/icons/TabIcons";

export default function TabLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const itemCount = useCartStore((s) => s.getItemCount());

  if (isLoading) return null;

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        // Verde de marca en lugar de #fff: el label vivía debajo del círculo verde
        // sobre el fondo blanco translúcido, así que blanco lo volvía invisible.
        tabBarActiveTintColor: "#1FAF55",
        tabBarInactiveTintColor: "rgba(26,28,26,0.5)",
        tabBarStyle: {
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 72,
          backgroundColor: "rgba(255,255,255,0.92)",
          borderTopWidth: 0,
          paddingBottom: 12,
          paddingTop: 8,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.06,
          shadowRadius: 12,
          elevation: 10,
        },
        tabBarLabelStyle: {
          fontSize: 9,
          fontWeight: "600",
          marginTop: 2,
        },
        tabBarActiveBackgroundColor: "transparent",
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
          tabBarIcon: ({ focused, size }) => (
            <View
              style={focused ? {
                width: 44, height: 44, borderRadius: 22,
                backgroundColor: "#1FAF55",
                alignItems: "center", justifyContent: "center",
                marginTop: -4,
              } : undefined}
            >
              <HomeIcon color={focused ? "#fff" : "rgba(26,28,26,0.5)"} size={focused ? 22 : size} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: "Buscar",
          tabBarIcon: ({ focused, size }) => (
            <View
              style={focused ? {
                width: 44, height: 44, borderRadius: 22,
                backgroundColor: "#1FAF55",
                alignItems: "center", justifyContent: "center",
                marginTop: -4,
              } : undefined}
            >
              <SearchIcon color={focused ? "#fff" : "rgba(26,28,26,0.5)"} size={focused ? 22 : size} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: "Carrito",
          tabBarBadge: itemCount > 0 ? itemCount : undefined,
          tabBarBadgeStyle: { backgroundColor: "#D33587", fontSize: 9 },
          tabBarIcon: ({ focused, size }) => (
            <View
              style={focused ? {
                width: 44, height: 44, borderRadius: 22,
                backgroundColor: "#1FAF55",
                alignItems: "center", justifyContent: "center",
                marginTop: -4,
              } : undefined}
            >
              <CartIcon color={focused ? "#fff" : "rgba(26,28,26,0.5)"} size={focused ? 22 : size} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: "Pedidos",
          headerShown: false,
          tabBarIcon: ({ focused, size }) => (
            <View
              style={focused ? {
                width: 44, height: 44, borderRadius: 22,
                backgroundColor: "#1FAF55",
                alignItems: "center", justifyContent: "center",
                marginTop: -4,
              } : undefined}
            >
              <OrdersIcon color={focused ? "#fff" : "rgba(26,28,26,0.5)"} size={focused ? 22 : size} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Perfil",
          tabBarIcon: ({ focused, size }) => (
            <View
              style={focused ? {
                width: 44, height: 44, borderRadius: 22,
                backgroundColor: "#1FAF55",
                alignItems: "center", justifyContent: "center",
                marginTop: -4,
              } : undefined}
            >
              <ProfileIcon color={focused ? "#fff" : "rgba(26,28,26,0.5)"} size={focused ? 22 : size} />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}
