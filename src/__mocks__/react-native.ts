// Minimal mock — solo lo que los stores/api usan
import { vi } from "vitest";

export const Platform = {
  OS: "ios" as "ios" | "android" | "web",
  select: (obj: any) => obj[Platform.OS] ?? obj.default,
};

export const AppState = {
  addEventListener: vi.fn(() => ({ remove: vi.fn() })),
  currentState: "active" as const,
};

// Las pruebas de componentes de este repo NO renderizan: invocan el componente
// como funcion y recorren el arbol devuelto (ver Interstitial.test.tsx). Para
// eso basta con que estos sean identidades distinguibles — React guarda los
// hijos en props.children sin ejecutar nada.
function componenteFalso(nombre: string) {
  const C = (_props: any) => null;
  C.displayName = nombre;
  return C;
}

export const View = componenteFalso("View");
export const Text = componenteFalso("Text");
export const Pressable = componenteFalso("Pressable");
export const FlatList = componenteFalso("FlatList");
export const ScrollView = componenteFalso("ScrollView");

// 390x844 = iPhone 14. El ancho concreto no importa para las aserciones, pero
// tiene que existir: HeroBanner lo lee en el modulo, no dentro del componente,
// asi que sin esto el import revienta antes de la primera prueba.
export const Dimensions = {
  get: () => ({ width: 390, height: 844, scale: 3, fontScale: 1 }),
  addEventListener: vi.fn(() => ({ remove: vi.fn() })),
};
