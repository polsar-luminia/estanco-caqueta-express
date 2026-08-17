import { Redirect, Stack, useSegments } from "expo-router";
import { useAuthStore } from "../../src/stores/auth";
import { decidirAuthLayout } from "../../src/lib/guardEdad";

export default function AuthLayout() {
  const isLoading = useAuthStore((s) => s.isLoading);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const cliente = useAuthStore((s) => s.cliente);
  const segments = useSegments();


  // Guard defensivo: el root layout ya retorna null durante isLoading,
  // pero si por alguna razón el subtree se renderiza antes de que hidrate,
  // devolvemos el Stack vacío en lugar de redirigir con estado parcial.
  if (isLoading) {
    return <Stack screenOptions={{ headerShown: false }} />;
  }

  // La decisión vive en `decidirAuthLayout` (probada en guardEdad.test.ts) para
  // que no vuelva a existir una segunda copia de la regla de edad: el bug del
  // 17-ago fue justo eso — el arreglo del 08-ago parchó el guard de la raíz y
  // esta copia se quedó atrás, expulsando del mapa a quien acababa de
  // registrarse y matando el formulario de dirección a medio llenar.
  const salida = decidirAuthLayout(segments as string[], isAuthenticated, cliente?.edad_confirmada);
  if (salida === "edad") return <Redirect href="/(auth)/edad-confirmar" />;
  if (salida === "tabs") return <Redirect href="/(tabs)" />;

  return (
    <Stack screenOptions={{ headerShown: false }} />
  );
}
