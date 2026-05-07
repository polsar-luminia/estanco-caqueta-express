/**
 * T5a — Test de regresión para app/(auth)/verify-otp.tsx
 *
 * Verifica que:
 *  1. El componente renderiza el flujo OTP cuando llega un teléfono válido (10 dígitos).
 *  2. Redirige a /(auth)/forgot-password cuando el teléfono está ausente.
 *  3. Redirige a /(auth)/forgot-password cuando el teléfono es malformado.
 *  4. Los hooks se invocan SIEMPRE antes del guard (rules-of-hooks) — el guard no
 *     debe afectar la cantidad de useState() llamados, así prevenimos la regresión
 *     que tuvimos al meter el <Redirect> antes de los hooks.
 *
 * Como el entorno de tests es Node (sin React Native real ni testing-library),
 * mockeamos expo-router, react-native, toast y la API. Validamos el output del
 * componente inspeccionando el ReactElement devuelto (type, props.href).
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- Los mocks de RN/expo-router
   requieren `any` para encajar con APIs no tipadas en el entorno node de tests. */
import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";

// ---- Stub de React.useState (sin reconciler) ----
// Contador compartido entre tests; reseteado en beforeEach.
let useStateCount = 0;
const noop = () => {};

// Mockeamos `react` para reemplazar `useState` por un stub que devuelve
// `[init, noop]` y cuenta llamadas. Así el componente se puede invocar
// fuera de un renderer y a la vez verificamos que TODOS los hooks
// se llaman antes del guard (rules-of-hooks).
vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    default: actual,
    useState: ((init: any) => {
      useStateCount++;
      const value = typeof init === "function" ? init() : init;
      return [value, noop];
    }) as unknown as typeof actual.useState,
    // useRef y useEffect requieren el dispatcher de React que no existe fuera
    // de un renderer. Los stubamos para que el componente se pueda invocar
    // como función plana en este entorno de test.
    useRef: (init: any) => ({ current: init }),
    useEffect: () => {},
  };
});

// ---- Mocks ----
// `vi.hoisted` hace que la variable esté disponible cuando vi.mock se hoista.
const { mockUseLocalSearchParams } = vi.hoisted(() => ({
  mockUseLocalSearchParams: vi.fn(),
}));

// Sentinel marcado para detectar el componente Redirect sin importar la
// referencia de la función mockeada. `Symbol.for(...)` es global por nombre,
// así que el mismo símbolo se obtiene desde dentro de la factoría hoisteada.
const REDIRECT_SENTINEL = Symbol.for("test:Redirect");

vi.mock("expo-router", () => {
  const RedirectMock: any = ({ href }: { href: string }) => ({
    type: "Redirect",
    props: { href },
  });
  RedirectMock.__sentinel__ = Symbol.for("test:Redirect");
  return {
    useRouter: () => ({ replace: () => {}, back: () => {}, push: () => {} }),
    useLocalSearchParams: () => mockUseLocalSearchParams(),
    Redirect: RedirectMock,
  };
});

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
    Platform: { OS: "ios", select: (o: any) => o.ios ?? o.default },
  };
});

vi.mock("react-native-toast-message", () => ({
  default: { show: vi.fn() },
}));

vi.mock("../../src/components/InputField", () => ({
  InputField: (props: any) =>
    React.createElement("InputField", props, null),
}));

vi.mock("../../src/lib/api", () => ({
  verificarResetPassword: vi.fn(),
  solicitarResetPassword: vi.fn(),
}));

// El componente hace `require("../../assets/logo-estanco.png")` (RN/metro
// pattern). En vitest no hay transformer para PNG → mockeamos como número.
vi.mock("../../assets/logo-estanco.png", () => ({ default: 1 }));

// Importar después de los mocks
import VerifyOtpScreen from "../../app/(auth)/verify-otp";

beforeEach(() => {
  useStateCount = 0;
});

describe("VerifyOtpScreen — guard de telefono y rules-of-hooks", () => {
  it("renderiza el flujo OTP cuando recibe un telefono válido (10 dígitos)", () => {
    mockUseLocalSearchParams.mockReturnValue({ telefono: "3001234567" });
    const out = VerifyOtpScreen() as React.ReactElement;
    // No debe ser un Redirect — debe ser el árbol del formulario (KeyboardAvoidingView raíz)
    expect((out.type as any).__sentinel__).not.toBe(REDIRECT_SENTINEL);
    expect(useStateCount).toBe(8);
  });

  it("redirige a /(auth)/forgot-password cuando telefono está ausente", () => {
    mockUseLocalSearchParams.mockReturnValue({});
    const out = VerifyOtpScreen() as React.ReactElement;
    // El Redirect mockeado renderiza createElement('Redirect', { href })
    expect((out.type as any).__sentinel__).toBe(REDIRECT_SENTINEL);
    expect((out.props as any).href).toBe("/(auth)/forgot-password");
    // Aún así los 7 hooks deben haberse llamado (rules-of-hooks)
    expect(useStateCount).toBe(8);
  });

  it("redirige cuando el telefono es malformado (no son 10 dígitos)", () => {
    mockUseLocalSearchParams.mockReturnValue({ telefono: "123" });
    const out = VerifyOtpScreen() as React.ReactElement;
    expect((out.type as any).__sentinel__).toBe(REDIRECT_SENTINEL);
    expect((out.props as any).href).toBe("/(auth)/forgot-password");
    expect(useStateCount).toBe(8);
  });

  it("redirige cuando el telefono trae caracteres no numéricos", () => {
    mockUseLocalSearchParams.mockReturnValue({ telefono: "30012abcde" });
    const out = VerifyOtpScreen() as React.ReactElement;
    expect((out.type as any).__sentinel__).toBe(REDIRECT_SENTINEL);
    expect(useStateCount).toBe(8);
  });
});
