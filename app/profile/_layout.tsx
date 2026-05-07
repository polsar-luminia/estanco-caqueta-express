import { Redirect, Stack } from "expo-router";
import { useAuthStore } from "../../src/stores/auth";

export default function ProfileLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const cliente = useAuthStore((s) => s.cliente);

  if (isLoading) return null;
  if (!isAuthenticated) return <Redirect href="/(auth)/login" />;
  if (cliente && !cliente.edad_confirmada) return <Redirect href="/(auth)/edad-confirmar" />;

  return <Stack screenOptions={{ headerShown: true, headerTintColor: "#17994A" }} />;
}
