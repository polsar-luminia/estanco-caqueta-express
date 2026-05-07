import { Redirect, Stack, useSegments } from "expo-router";
import { useAuthStore } from "../../src/stores/auth";

export default function AuthLayout() {
  const isLoading = useAuthStore((s) => s.isLoading);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const cliente = useAuthStore((s) => s.cliente);
  const segments = useSegments();

  // `edad-confirmar` se renderiza dentro de (auth) PERO requiere usuario
  // autenticado (necesitamos JWT para POST /me/confirmar-edad). Por eso
  // no se redirige fuera aunque isAuthenticated sea true.
  const enEdadConfirmar = segments[segments.length - 1] === "edad-confirmar";

  // Guard defensivo: el root layout ya retorna null durante isLoading,
  // pero si por alguna razón el subtree se renderiza antes de que hidrate,
  // devolvemos el Stack vacío en lugar de redirigir con estado parcial.
  if (isLoading) {
    return <Stack screenOptions={{ headerShown: false }} />;
  }

  if (isAuthenticated) {
    if (enEdadConfirmar) {
      // Permitir renderizar la pantalla de confirmación
      return <Stack screenOptions={{ headerShown: false }} />;
    }
    // Si está autenticado y aún NO confirmó edad, forzar a confirmar antes
    // de entrar al catálogo. El (tabs)/_layout también enforza, pero hacerlo
    // aquí evita un flash de la home.
    if (cliente && !cliente.edad_confirmada) {
      return <Redirect href="/(auth)/edad-confirmar" />;
    }
    return <Redirect href="/(tabs)" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }} />
  );
}
