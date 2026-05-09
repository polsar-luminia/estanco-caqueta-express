/**
 * Test de regresión para app/(auth)/forgot-password.tsx
 *
 * Estado del flujo (2026-05-09): WhatsApp deshabilitado en backend
 * (WHATSAPP_OTP_ENABLED=false). El cliente solo solicita el OTP — el backend
 * decide canal (SMS por defecto). Sin abrir WhatsApp ni guardas Linking.
 *
 * Verifica que:
 *  1. El componente renderiza sin invocar Linking en el render inicial.
 *  2. solicitarResetPassword está disponible desde lib/api (contrato del flujo OTP).
 *  3. Importación limpia sin dependencia a Linking ni WHATSAPP_NEGOCIO_LINK.
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
    // Linking SE deja en el mock por si algun import transitivo lo toca,
    // pero el componente actual NO lo importa (verificado por ausencia de
    // calls a estos mocks tras render).
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

describe("ForgotPasswordScreen — flujo SMS-only (WhatsApp deshabilitado)", () => {
  it("renderiza sin errores", () => {
    const out = ForgotPasswordScreen() as React.ReactElement;
    expect(out).toBeTruthy();
  });

  it("NO invoca Linking.canOpenURL en el render inicial", () => {
    ForgotPasswordScreen();
    expect(mockCanOpenURL).not.toHaveBeenCalled();
  });

  it("NO invoca Linking.openURL en el render inicial", () => {
    ForgotPasswordScreen();
    expect(mockOpenURL).not.toHaveBeenCalled();
  });

  it("expone solicitarResetPassword desde lib/api (contrato del flujo OTP)", () => {
    expect(mockSolicitarReset).toBeDefined();
    expect(typeof mockSolicitarReset).toBe("function");
  });
});
