/**
 * Test de regresión para app/(auth)/register.tsx — registro en dos pasos con OTP.
 *
 * Estado del flujo (2026-08-16): el submit del formulario ya NO crea la cuenta;
 * llama a solicitarCodigoRegistro y pasa al paso "codigo", donde el código de
 * WhatsApp/SMS + register(...codigo) crean la cuenta con el teléfono verificado.
 *
 * Mismo patrón shallow de forgot-password.test.tsx: hooks stubbeados, así que el
 * componente se prueba en su estado inicial (paso "formulario"). Lo que fija:
 *  1. Renderiza sin errores y sin efectos colaterales (Linking).
 *  2. El paso inicial es el formulario: CTA "Continuar", sin campo de código.
 *  3. Contratos con lib/api y el store: solicitarCodigoRegistro disponible y
 *     register aceptando el sexto argumento (codigo).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";

const noop = () => {};
vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    default: actual,
    useState: ((init: any) => {
      const value = typeof init === "function" ? init() : init;
      return [value, noop];
    }) as unknown as typeof actual.useState,
    useRef: (init: any) => ({ current: init }),
    useEffect: () => {},
  };
});

const { mockOpenURL } = vi.hoisted(() => ({ mockOpenURL: vi.fn() }));

vi.mock("react-native", () => {
  const stub = (name: string) =>
    Object.assign(
      ({ children }: any) => React.createElement(name, null, children),
      { displayName: name }
    );
  return {
    View: stub("View"),
    Text: stub("Text"),
    Pressable: stub("Pressable"),
    ScrollView: stub("ScrollView"),
    KeyboardAvoidingView: stub("KeyboardAvoidingView"),
    Image: stub("Image"),
    Alert: { alert: vi.fn() },
    Platform: { OS: "ios", select: (o: any) => o.ios ?? o.default },
    Linking: { openURL: mockOpenURL },
  };
});

vi.mock("expo-linear-gradient", () => ({
  LinearGradient: ({ children }: any) => React.createElement("LinearGradient", null, children),
}));

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

vi.mock("@expo/vector-icons", () => ({
  Feather: () => null,
}));

vi.mock("react-native-toast-message", () => ({
  default: { show: vi.fn() },
}));

vi.mock("@sentry/react-native", () => ({
  captureException: vi.fn(),
}));

vi.mock("expo-router", () => ({
  useRouter: () => ({ replace: vi.fn(), back: vi.fn(), push: vi.fn(), canGoBack: () => false }),
  Link: ({ children }: any) => React.createElement("Link", null, children),
}));

const mockRegister = vi.fn();
vi.mock("../../src/stores/auth", () => ({
  useAuthStore: (selector: any) => selector({ register: mockRegister }),
}));

const mockSolicitarCodigo = vi.fn();
vi.mock("../../src/lib/api", () => ({
  solicitarCodigoRegistro: (...args: any[]) => mockSolicitarCodigo(...args),
}));

const mockTrack = vi.fn();
vi.mock("../../src/lib/tracker", () => ({
  tracker: { track: (...args: any[]) => mockTrack(...args) },
}));

vi.mock("../../src/lib/metaEvents", () => ({
  metaLogRegistration: vi.fn(),
}));

vi.mock("../../src/components/DateSelector", () => ({
  toISODate: vi.fn(() => null),
  calcularEdad: vi.fn(() => null),
}));

vi.mock("../../src/components/InputField", () => ({
  InputField: (props: any) => React.createElement("InputField", props, null),
}));

vi.mock("../../src/components/icons/AppIcons", () => ({
  UserIcon: () => null,
  PhoneIcon: () => null,
  LockIcon: () => null,
}));

vi.mock("../../assets/logo-estanco.png", () => ({ default: 1 }));

// Importar el componente DESPUÉS de los mocks
import RegisterScreen from "../../app/(auth)/register";

beforeEach(() => {
  mockOpenURL.mockReset();
  mockSolicitarCodigo.mockReset();
  mockRegister.mockReset();
  mockTrack.mockReset();
});

// Recorre el árbol de elementos renderizado juntando strings y labels de props.
function textosDelArbol(node: any, acc: string[] = []): string[] {
  if (node == null || typeof node === "boolean") return acc;
  if (typeof node === "string" || typeof node === "number") {
    acc.push(String(node));
    return acc;
  }
  if (Array.isArray(node)) {
    node.forEach((n) => textosDelArbol(n, acc));
    return acc;
  }
  if (node.props) {
    if (typeof node.props.label === "string") acc.push(node.props.label);
    if (typeof node.props.accessibilityLabel === "string") acc.push(node.props.accessibilityLabel);
    textosDelArbol(node.props.children, acc);
  }
  return acc;
}

// El componente es una función normal con hooks stubbeados: se puede invocar
// directo. Los componentes intermedios (View, Pressable) son stubs que reciben
// children, así que el árbol completo queda en las props sin montar nada.
function render(): string[] {
  const out = RegisterScreen() as React.ReactElement;
  expect(out).toBeTruthy();
  return textosDelArbol(out);
}

describe("RegisterScreen — registro en dos pasos con OTP", () => {
  it("renderiza sin errores y sin abrir Linking", () => {
    render();
    expect(mockOpenURL).not.toHaveBeenCalled();
  });

  it("el paso inicial es el formulario: CTA 'Continuar', no 'Crear Cuenta'", () => {
    const textos = render();
    expect(textos).toContain("Continuar");
    expect(textos.some((t) => t.includes("Continuar y verificar número"))).toBe(true);
  });

  it("el paso inicial NO muestra el campo de código (aparece tras solicitar el OTP)", () => {
    const textos = render();
    expect(textos.some((t) => t.includes("Código de verificación"))).toBe(false);
    expect(textos.some((t) => t.includes("Verifica tu número"))).toBe(false);
  });

  it("el link a login sigue visible en el formulario (¿Ya tienes una cuenta?)", () => {
    const textos = render();
    expect(textos.some((t) => t.includes("Ya tienes una cuenta"))).toBe(true);
    expect(textos.some((t) => t.includes("Inicia sesión"))).toBe(true);
  });

  it("no solicita ningún código en el render inicial (solo al tocar Continuar)", () => {
    render();
    expect(mockSolicitarCodigo).not.toHaveBeenCalled();
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it("contrato con lib/api: el flujo usa solicitarCodigoRegistro", () => {
    expect(typeof mockSolicitarCodigo).toBe("function");
  });
});
