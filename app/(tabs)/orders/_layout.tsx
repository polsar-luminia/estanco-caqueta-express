import { Stack } from "expo-router";

export default function OrdersLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#17994A" },
        headerTintColor: "#fff",
        headerTitleStyle: { fontWeight: "bold" },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Mis pedidos" }} />
      <Stack.Screen name="[id]" options={{ title: "Detalle del pedido" }} />
    </Stack>
  );
}
