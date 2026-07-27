import "../global.css";
import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { Stack, useRouter, useSegments, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClientProvider, focusManager } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import NetInfo from "@react-native-community/netinfo";
import Toast from "react-native-toast-message";
import * as Sentry from "@sentry/react-native";
import { queryClient } from "../src/lib/query-client";
import { getToken } from "../src/lib/api";
import { useAuthStore } from "../src/stores/auth";
import { usePushNotifications } from "../src/hooks/usePushNotifications";
import { tracker } from "../src/lib/tracker";
import { initMetaAnalytics } from "../src/lib/metaEvents";
import { toastConfig } from "../src/components/ToastConfig";
import { OfflineBanner } from "../src/components/OfflineBanner";
import { Interstitial } from "../src/components/Interstitial";
import { SplashBranded } from "../src/components/SplashBranded";
import { PantallaActualizar } from "../src/components/PantallaActualizar";
import { debeBloquear } from "../src/lib/bloqueoVersion";
import { APP_VERSION } from "../src/lib/appVersion";
import { getConfigApp } from "../src/lib/api";
import { useQuery } from "@tanstack/react-query";

// Rutas exentas del age gate (autenticación pública). Todo lo demás requiere edad confirmada.
const RUTAS_EXENTAS_EDAD = ["(auth)"];

// Apple §5.1.1(v) — el catálogo debe ser navegable sin login (guest browsing).
// Por eso usamos blacklist (rutas que SÍ exigen sesión) en vez de whitelist:
// product/[id], category/[id], ofertas, support y (tabs) son públicos.
// cart/orders/profile dentro de (tabs) hacen su propio Redirect a /login.
const RUTAS_REQUIEREN_AUTH = ["profile"];

if (process.env.EXPO_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.1,
    enableAutoSessionTracking: true,
    sessionTrackingIntervalMillis: 30000,
    beforeSend: (event) => {
      if (event.request?.headers) {
        delete (event.request.headers as Record<string, unknown>)['Authorization'];
        delete (event.request.headers as Record<string, unknown>)['Cookie'];
      }
      if (event.request?.data) {
        delete event.request.data;
      }
      return event;
    },
  });
} else if (!__DEV__) {
  // En un build de producción sin DSN la cobertura de Sentry es cero y nadie se entera.
  console.warn('[sentry] EXPO_PUBLIC_SENTRY_DSN no configurado — monitoreo deshabilitado');
}

/**
 * Bloqueo de versión (bloque G). Envuelve toda la app.
 *
 * Nace DORMIDO: el servidor devuelve `version_minima: '1.0.0'` mientras nadie lo
 * suba, y toda versión instalada cumple ese mínimo. Para que bloquee a alguien hay
 * que subir ese número a mano en el backend — no hay forma de que se active solo.
 *
 * Y ante la duda no bloquea: si la consulta falla, si todavía está cargando, o si
 * alguna de las dos versiones no se puede leer, la app sigue funcionando normal.
 * `debeBloquear` sólo devuelve true con dos versiones bien formadas y la instalada
 * estrictamente por debajo.
 */
function GuardVersion({ children }: { children: React.ReactNode }) {
  const { data: config } = useQuery({
    queryKey: ["config-app"],
    queryFn: getConfigApp,
    staleTime: 5 * 60 * 1000,
    // Sin reintentos agresivos: mientras no haya respuesta, no se bloquea a nadie.
    retry: 1,
  });

  if (config && debeBloquear(APP_VERSION, config.version_minima)) {
    return <PantallaActualizar mensaje={config.version_minima_mensaje} />;
  }
  return <>{children}</>;
}

export default Sentry.wrap(function RootLayout() {
  const [interstitialDone, setInterstitialDone] = useState(false);
  const hydrate = useAuthStore((s) => s.hydrate);
  const clearHydrateError = useAuthStore((s) => s.clearHydrateError);
  const isLoading = useAuthStore((s) => s.isLoading);
  const lastHydrateError = useAuthStore((s) => s.lastHydrateError);
  const edadConfirmada = useAuthStore((s) => s.cliente?.edad_confirmada);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const router = useRouter();
  const segments = useSegments();
  const pathname = usePathname();

  useEffect(() => {
    hydrate();
    tracker.track('app_abierta');
    // Init del SDK de Meta + prompt ATT (iOS) una sola vez, con la UI ya montada.
    initMetaAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate es un selector estable de Zustand
  }, []);

  // A.2 — pantalla_vista: responde qué pantallas se usan y cuáles no. Un solo
  // listener aquí en vez de un track por pantalla: así ninguna se queda sin medir
  // al agregarla. Los ids de las rutas dinámicas (product/123) se normalizan a
  // product/[id] para poder agrupar, y de paso no dejar ids sueltos en la tabla.
  useEffect(() => {
    if (!pathname) return;
    const ruta = pathname
      .split('/')
      .map((seg) => (/^\d+$/.test(seg) ? '[id]' : seg))
      .join('/');
    tracker.track('pantalla_vista', undefined, ruta.slice(0, 128));
  }, [pathname]);

  // Toast de red diferido: el provider de Toast no está montado durante hydrate
  // (el componente retorna null mientras isLoading=true). Se dispara aquí,
  // después del primer render con Toast disponible.
  useEffect(() => {
    if (!isLoading && lastHydrateError === 'network') {
      Toast.show({
        type: 'error',
        text1: 'Sin conexión',
        text2: 'Vuelve a ingresar cuando tengas señal',
      });
      clearHydrateError();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, lastHydrateError]);

  // Guard auth + edad — Apple §5.1.1(v) compliant:
  //   - Sin sesión: solo bloquea rutas en RUTAS_REQUIEREN_AUTH (profile).
  //     El catálogo, ofertas, product/[id], category/[id] y support son
  //     accesibles como invitado. Cart/orders hacen su propio Redirect interno.
  //   - Con sesión y sin edad confirmada (Apple §1.4.3): salta a /edad-confirmar
  //     excepto si ya está en (auth).
  useEffect(() => {
    if (isLoading) return;
    const rutaActual = segments[0] as string | undefined;

    if (!isAuthenticated) {
      if (rutaActual && RUTAS_REQUIEREN_AUTH.includes(rutaActual)) {
        router.replace("/(auth)/login");
      }
      return;
    }

    if (!edadConfirmada) {
      if (rutaActual && !RUTAS_EXENTAS_EDAD.includes(rutaActual)) {
        router.replace("/(auth)/edad-confirmar");
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edadConfirmada, isAuthenticated, isLoading, segments]);

  // M-PERS-16: si hydrate() falló por red (app abierta sin señal), el token
  // sigue en SecureStore pero el usuario queda como invitado hasta reabrir la
  // app. Al volver la conexión, reintentamos hydrate() en silencio.
  useEffect(() => {
    const unsub = NetInfo.addEventListener(async (state) => {
      const online = state.isConnected === true && state.isInternetReachable !== false;
      if (!online) return;
      const st = useAuthStore.getState();
      if (st.lastHydrateError === 'network' && !st.isAuthenticated) {
        if (await getToken()) st.hydrate();
      }
    });
    return () => unsub();
  }, []);

  // Sincronizar React Query con AppState para refetch al volver de background
  useEffect(() => {
    focusManager.setEventListener((handleFocus) => {
      const sub = AppState.addEventListener('change', (state) => {
        handleFocus(state === 'active');
      });
      return () => sub.remove();
    });
  }, []);

  usePushNotifications();

  if (isLoading) {
    return <SplashBranded />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="light" />
        <GuardVersion>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="product/[id]"
            options={{
              headerShown: true,
              headerTitle: "",
              headerTransparent: true,
              headerTintColor: "#17994A",
            }}
          />
          <Stack.Screen
            name="category/[id]"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="ubicacion"
            options={{
              headerShown: false,
              presentation: "modal",
              // gestureEnabled:false → el swipe-para-cerrar del modal ya no se roba
              // el arrastre vertical del mapa (si no, el mapa se siente "congelado").
              // Se cierra con la flecha atrás o "Escribir dirección manualmente".
              gestureEnabled: false,
            }}
          />
          <Stack.Screen
            name="support/help"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="support/terms"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="support/privacy"
            options={{ headerShown: false }}
          />
        </Stack>
        <Toast config={toastConfig} position="bottom" bottomOffset={100} />
        <OfflineBanner />
        {!interstitialDone && (
          <Interstitial onFinish={() => setInterstitialDone(true)} />
        )}
        </GuardVersion>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
});
