import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { fuentes } from "../../../src/constants/theme";

export default function OrdersLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: "#17994A" },
          headerTintColor: "#fff",
          headerTitleStyle: { fontFamily: fuentes.destacado },
        }}
      >
        <Stack.Screen name="index" options={{ title: "Mis pedidos" }} />
        <Stack.Screen name="[id]" options={{ title: "Detalle del pedido" }} />
      </Stack>
    </>
  );
}
