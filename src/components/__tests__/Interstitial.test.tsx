/**
 * Tests del componente Interstitial.
 *
 * Estrategia: se mockea useQuery para controlar el estado de carga/datos/error
 * y se invoca el componente directamente como función (patrón del proyecto).
 * Se usan fake timers para verificar el comportamiento del setTimeout.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import React from "react";

// ── Mocks de módulos React ────────────────────────────────────────────────────

// Capturamos los callbacks de useEffect para ejecutarlos manualmente
const _effects: Array<() => (() => void) | void> = [];
const _cleanups: Array<(() => void) | void> = [];

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    default: actual,
    useEffect: (fn: () => (() => void) | void, _deps?: unknown[]) => {
      _effects.push(fn);
    },
  };
});

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
    StyleSheet: {
      absoluteFillObject: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
      create: (s: unknown) => s,
    },
  };
});

// ── Mock expo-image ───────────────────────────────────────────────────────────

vi.mock("expo-image", () => ({
  Image: () => null,
  default: { Image: () => null },
}));

// ── Mock @tanstack/react-query ────────────────────────────────────────────────

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQuery: vi.fn(),
  };
});

// ── Mock lib/api ──────────────────────────────────────────────────────────────

vi.mock("../../lib/api", () => ({
  getInterstitial: vi.fn(),
}));

// ── Mock lib/tracker ──────────────────────────────────────────────────────────

vi.mock("../../lib/tracker", () => ({
  tracker: { track: vi.fn() },
}));

// Importaciones DESPUÉS de los mocks
import { useQuery } from "@tanstack/react-query";
import { tracker } from "../../lib/tracker";
import { Interstitial } from "../Interstitial";

// Helper para ejecutar todos los efectos registrados y recopilar cleanups
function flushEffects() {
  while (_effects.length > 0) {
    const fn = _effects.shift()!;
    const cleanup = fn();
    _cleanups.push(cleanup);
  }
}

// Helper para ejecutar todos los cleanups registrados
function flushCleanups() {
  while (_cleanups.length > 0) {
    const fn = _cleanups.shift();
    if (typeof fn === "function") fn();
  }
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("Interstitial", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    _effects.length = 0;
    _cleanups.length = 0;
    vi.mocked(tracker.track).mockClear();
  });

  afterEach(() => {
    flushCleanups();
    vi.useRealTimers();
  });

  // ── Caso 1: data null ──────────────────────────────────────────────────────

  it("llama onFinish de inmediato cuando data es null", () => {
    (useQuery as ReturnType<typeof vi.fn>).mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
    });

    const onFinish = vi.fn();
    const result = Interstitial({ onFinish });

    // Componente no renderiza nada cuando data es null
    expect(result).toBeNull();

    // Ejecutar efectos pendientes
    flushEffects();

    expect(onFinish).toHaveBeenCalledOnce();
    expect(tracker.track).not.toHaveBeenCalled();
  });

  // ── Caso 2: data válida ────────────────────────────────────────────────────

  it("renderiza View y llama onFinish tras duracion_segundos", () => {
    const interstitial = {
      id: 1,
      imagen_url: "https://cdn.estancocaqueta.com/banner.jpg",
      duracion_segundos: 3,
    };

    (useQuery as ReturnType<typeof vi.fn>).mockReturnValue({
      data: interstitial,
      isLoading: false,
      isError: false,
    });

    const onFinish = vi.fn();
    const result = Interstitial({ onFinish });

    // Debe renderizar el View contenedor (type es la función stub de View)
    expect(result).not.toBeNull();
    expect((result as React.ReactElement).type).toBeDefined();

    // Ejecutar efectos pendientes
    flushEffects();

    // onFinish aún no se ha llamado (el timer no ha expirado)
    expect(onFinish).not.toHaveBeenCalled();

    // Verificar que se registró la impresión
    expect(tracker.track).toHaveBeenCalledWith("interstitial_mostrado", {
      interstitial_id: 1,
    });

    // Avanzar el timer 3 segundos
    vi.advanceTimersByTime(3000);

    // Ahora onFinish debe haberse llamado
    expect(onFinish).toHaveBeenCalledOnce();
    expect(tracker.track).toHaveBeenCalledWith("interstitial_completado", {
      interstitial_id: 1,
    });
  });

  // ── Caso 3: error ──────────────────────────────────────────────────────────

  it("llama onFinish de inmediato cuando hay error", () => {
    (useQuery as ReturnType<typeof vi.fn>).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    });

    const onFinish = vi.fn();
    const result = Interstitial({ onFinish });

    // No renderiza nada (data es undefined/falsy)
    expect(result).toBeNull();

    // Ejecutar efectos pendientes
    flushEffects();

    expect(onFinish).toHaveBeenCalledOnce();
    expect(tracker.track).not.toHaveBeenCalled();
  });

  // ── Caso 4: isLoading ──────────────────────────────────────────────────────

  it("no llama onFinish ni renderiza nada mientras isLoading es true", () => {
    (useQuery as ReturnType<typeof vi.fn>).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    });

    const onFinish = vi.fn();
    const result = Interstitial({ onFinish });

    expect(result).toBeNull();

    flushEffects();

    // El efecto hace return early cuando isLoading=true
    expect(onFinish).not.toHaveBeenCalled();
    expect(tracker.track).not.toHaveBeenCalled();
  });
});
