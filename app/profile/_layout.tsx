import { Redirect, Stack, useSegments } from "expo-router";
import { useAuthStore } from "../../src/stores/auth";
import { grupoDebeConfirmarEdad } from "../../src/lib/guardEdad";

export default function ProfileLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const cliente = useAuthStore((s) => s.cliente);
  const segments = useSegments();

  if (isLoading) return null;
  // El redirect a login se mantiene tal cual: `profile` solo se renderiza si es
  // la ruta activa o queda debajo, y mandar a login sin sesion no destruye nada
  // a medio llenar. El de edad si se limita al grupo activo (ver (tabs)).
  if (!isAuthenticated) return <Redirect href="/(auth)/login" />;
  if (grupoDebeConfirmarEdad(segments as string[], "profile", isAuthenticated, cliente != null, cliente?.edad_confirmada)) {
    return <Redirect href="/(auth)/edad-confirmar" />;
  }

  return <Stack screenOptions={{ headerShown: true, headerTintColor: "#17994A" }} />;
}
