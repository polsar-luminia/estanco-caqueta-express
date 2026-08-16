/**
 * Allowlist de deep links de push (M-NAV-18) — la regresión que este archivo
 * fija: la query se valida APARTE del path. Dos veces se pegó un parámetro al
 * patrón del path y el tap del push murió en silencio (`?calificar=1` primero,
 * `?chat=1` después, commit 4826737).
 */
import { describe, it, expect, vi } from "vitest";

// El módulo del hook importa medio Expo; para probar la función pura basta
// stubbear lo que toca a nivel de módulo.
vi.mock("expo-notifications", () => ({
  setNotificationHandler: vi.fn(),
  getPermissionsAsync: vi.fn(),
  requestPermissionsAsync: vi.fn(),
  getExpoPushTokenAsync: vi.fn(),
  setNotificationChannelAsync: vi.fn(),
  addNotificationResponseReceivedListener: vi.fn(),
  addNotificationReceivedListener: vi.fn(),
  AndroidImportance: { HIGH: 4 },
}));
vi.mock("expo-device", () => ({ isDevice: false }));
vi.mock("expo-constants", () => ({ default: { expoConfig: { extra: {} } } }));
vi.mock("expo-router", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@sentry/react-native", () => ({ captureException: vi.fn(), addBreadcrumb: vi.fn() }));
vi.mock("@react-native-community/netinfo", () => ({ default: { addEventListener: vi.fn() } }));
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: { getItem: vi.fn(), setItem: vi.fn() },
}));
vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
vi.mock("../../lib/api", () => ({ registrarPushToken: vi.fn(), registrarPushTokenAnonimo: vi.fn() }));
vi.mock("../../lib/tracker", () => ({ tracker: { track: vi.fn() } }));
vi.mock("../../lib/query-client", () => ({ queryClient: { invalidateQueries: vi.fn() } }));
vi.mock("../../stores/auth", () => ({
  useAuthStore: { getState: () => ({ isAuthenticated: true }) },
  registerLogoutHandler: vi.fn(),
}));

import { deepLinkNavegable } from "../usePushNotifications";

describe("deepLinkNavegable — con sesión", () => {
  it("acepta el detalle del pedido con y sin parámetros conocidos", () => {
    expect(deepLinkNavegable("/(tabs)/orders/123", true)).toBe(true);
    expect(deepLinkNavegable("/(tabs)/orders/123?calificar=1", true)).toBe(true);
    // LA regresión del chat: el push de mensaje del domiciliario navega.
    expect(deepLinkNavegable("/(tabs)/orders/123?chat=1", true)).toBe(true);
  });

  it("acepta carrito, inicio y producto", () => {
    expect(deepLinkNavegable("/(tabs)/cart", true)).toBe(true);
    expect(deepLinkNavegable("/(tabs)/index", true)).toBe(true);
    expect(deepLinkNavegable("/product/45", true)).toBe(true);
  });

  it("rechaza paths fuera de la allowlist y parámetros desconocidos", () => {
    expect(deepLinkNavegable("/profile/notificaciones", true)).toBe(false);
    expect(deepLinkNavegable("https://evil.com/(tabs)/orders/1", true)).toBe(false);
    expect(deepLinkNavegable("/(tabs)/orders/123?redirect=evil", true)).toBe(false);
    expect(deepLinkNavegable("/(tabs)/orders/abc", true)).toBe(false);
  });
});

describe("deepLinkNavegable — sin sesión (push anónimo)", () => {
  it("permite solo las rutas públicas de guest browsing", () => {
    expect(deepLinkNavegable("/product/45", false)).toBe(true);
    expect(deepLinkNavegable("/(tabs)/index", false)).toBe(true);
  });

  it("los pedidos y el carrito siguen exigiendo cuenta", () => {
    expect(deepLinkNavegable("/(tabs)/orders/123", false)).toBe(false);
    expect(deepLinkNavegable("/(tabs)/orders/123?chat=1", false)).toBe(false);
    expect(deepLinkNavegable("/(tabs)/cart", false)).toBe(false);
  });
});
