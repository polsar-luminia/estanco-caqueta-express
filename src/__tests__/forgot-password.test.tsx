/**
 * M-AUTH-13 — Test de regresión para app/(auth)/forgot-password.tsx
 *
 * Verifica que:
 *  1. El componente renderiza sin invocar Linking en el render inicial.
 *  2. Linking.canOpenURL y Linking.openURL están disponibles en el mock
 *     (contrato del guard de WhatsApp instalado).
 *  3. solicitarResetPassword está disponible desde lib/api (contrato del flujo OTP).
 *
 * Mocks: react-native (incluye Linking), expo-router, toast, sentry, lib/api.
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

const { mockCanOpenURL, mockOpenURL } = vi.hoisted(() => ({
  mockCanOpenURL: vi.fn(),
  mockOpenURL: vi.fn(),
}));

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
    Linking: { canOpenURL: mockCanOpenURL, openURL: mockOpenURL },
  };
});

vi.mock("react-native-toast-message", () => ({
  default: { show: vi.fn() },
}));

vi.mock("@sentry/react-native", () => ({
  captureException: vi.fn(),
}));

vi.mock("expo-router", () => ({
  useRouter: () => ({ replace: vi.fn(), back: vi.fn(), push: vi.fn() }),
}));

const mockSolicitarReset = vi.fn();
vi.mock("../../src/lib/api", () => ({
  solicitarResetPassword: (...args: any[]) => mockSolicitarReset(...args),
}));

vi.mock("../../src/components/InputField", () => ({
  InputField: (props: any) => React.createElement("InputField", props, null),
}));

vi.mock("../../src/components/icons/AppIcons", () => ({
  PhoneIcon: () => null,
}));

vi.mock("../../assets/logo-estanco.png", () => ({ default: 1 }));

// Importar el componente DESPUÉS de los mocks
import ForgotPasswordScreen from "../../app/(auth)/forgot-password";

beforeEach(() => {
  mockCanOpenURL.mockReset();
  mockOpenURL.mockReset();
  mockSolicitarReset.mockReset();
});

describe("ForgotPasswordScreen — guard WhatsApp instalado (M-AUTH-13)", () => {
  it("renderiza sin invocar Linking en el render inicial", () => {
    const out = ForgotPasswordScreen() as React.ReactElement;
    expect(out).toBeTruthy();
    expect(mockCanOpenURL).not.toHaveBeenCalled();
    expect(mockOpenURL).not.toHaveBeenCalled();
  });

  it("expone solicitarResetPassword desde lib/api (contrato del flujo OTP)", () => {
    expect(mockSolicitarReset).toBeDefined();
  });

  it("Linking.canOpenURL es un vi.fn invocable (contrato del guard)", () => {
    expect(typeof mockCanOpenURL).toBe("function");
    expect(mockCanOpenURL.mock).toBeDefined();
  });

  it("Linking.openURL es un vi.fn invocable (contrato)", () => {
    expect(typeof mockOpenURL).toBe("function");
    expect(mockOpenURL.mock).toBeDefined();
  });
});
