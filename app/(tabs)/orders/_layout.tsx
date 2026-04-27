import { Stack } from "expo-router";

export default function OrdersLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#17994A" },
        headerTintColor: "#fff",
        headerTitleStyle: { fontWeight: "bold" },
        // Edge-to-edge: aseguramos íconos claros del status bar y que el header
        // del native-stack consuma correctamente el safe area top, evitando que
        // el título del header se renderice sobre el reloj/batería del sistema.
        statusBarStyle: "light",
      }}
    >
      <Stack.Screen name="index" options={{ title: "Mis pedidos" }} />
      <Stack.Screen name="[id]" options={{ title: "Detalle del pedido" }} />
    </Stack>
  );
}
