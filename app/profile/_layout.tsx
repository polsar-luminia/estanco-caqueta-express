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
  // A REGISTRO y no a login: mismo criterio que el resto de la app.
  if (!isAuthenticated) return <Redirect href="/(auth)/register" />;
  if (grupoDebeConfirmarEdad(segments as string[], "profile", isAuthenticated, cliente != null, cliente?.edad_confirmada)) {
    return <Redirect href="/(auth)/edad-confirmar" />;
  }

  return (
    <Stack screenOptions={{ headerShown: true, headerTintColor: "#17994A" }}>
      <Stack.Screen
        name="metodos-pago/nueva"
        options={{
          headerShown: false,
          // fullScreenModal y no "modal": mismo motivo que "ubicacion" en el
          // _layout raíz (el pageSheet de iOS trae su propio gesto de
          // deslizar para cerrar) pero aquí pesa más todavía — un swipe hacia
          // abajo a mitad de un challenge 3DS abandona la autenticación del
          // banco. Se registra ACÁ (no en el _layout raíz, como "ubicacion")
          // porque "nueva.tsx" vive dentro del grupo profile/ y el Stack que
          // de verdad lo presenta es este, no el de app/_layout.tsx.
          presentation: "fullScreenModal",
          gestureEnabled: false,
        }}
      />
    </Stack>
  );
}
