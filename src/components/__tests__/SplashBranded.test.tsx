import { describe, it, expect, vi } from "vitest";
import React from "react";

// ── Mock react-native ─────────────────────────────────────────────────────────

vi.mock("react-native", () => {
  const stub = (name: string) =>
    Object.assign(
      ({ children }: { children?: React.ReactNode }) =>
        React.createElement(name, null, children),
      { displayName: name }
    );
  return {
    View: stub("View"),
    Image: stub("Image"),
    StyleSheet: { create: (s: unknown) => s },
  };
});

// Importación DESPUÉS de los mocks
import { SplashBranded } from "../SplashBranded";

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("SplashBranded", () => {
  it("renderiza sin crashear y devuelve un elemento React", () => {
    const result = SplashBranded();
    expect(result).not.toBeNull();
    expect(result).toBeDefined();
  });

  it("el elemento raíz tiene props con style", () => {
    const result = SplashBranded() as React.ReactElement<Record<string, unknown>>;
    expect(result.props).toBeDefined();
    expect(result.props.style).toBeDefined();
  });
});
