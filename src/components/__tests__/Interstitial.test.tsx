/**
 * Tests del componente Interstitial.
 *
 * Estrategia: se mockea useQuery para controlar el estado de carga/datos/error
 * y se invoca el componente directamente como función (patrón del proyecto).
 * El timer ahora arranca desde onLoad (no desde el efecto), así que en el
 * caso con datos válidos se extrae onLoad del elemento Image y se llama
 * manualmente para simular que la imagen terminó de cargar.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import React from "react";

// ── Mocks de módulos React ────────────────────────────────────────────────────

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
    useRef: (init: unknown) => ({ current: init }),
    useCallback: (fn: unknown) => fn,
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

function flushEffects() {
  while (_effects.length > 0) {
    const fn = _effects.shift()!;
    const cleanup = fn();
    _cleanups.push(cleanup);
  }
}

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

    expect(result).toBeNull();

    flushEffects();

    expect(onFinish).toHaveBeenCalledOnce();
    expect(tracker.track).not.toHaveBeenCalled();
  });

  // ── Caso 2: data válida — timer arranca desde onLoad ──────────────────────

  it("llama onFinish tras duracion_segundos una vez que la imagen cargó", () => {
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

    expect(result).not.toBeNull();

    // Efectos fail-fast: no hacen nada (data existe, sin error)
    flushEffects();
    expect(onFinish).not.toHaveBeenCalled();
    expect(tracker.track).not.toHaveBeenCalled();

    // Simular que la imagen terminó de cargar → onLoad dispara el timer
    const imageEl = (result as React.ReactElement).props.children as React.ReactElement<{
      onLoad: () => void;
    }>;
    imageEl.props.onLoad();

    expect(tracker.track).toHaveBeenCalledWith("interstitial_mostrado", { interstitial_id: 1 });
    expect(onFinish).not.toHaveBeenCalled();

    // Avanzar 3 segundos → timer completa
    vi.advanceTimersByTime(3000);

    expect(onFinish).toHaveBeenCalledOnce();
    expect(tracker.track).toHaveBeenCalledWith("interstitial_completado", { interstitial_id: 1 });
  });

  // ── Caso 3: error de query ─────────────────────────────────────────────────

  it("llama onFinish de inmediato cuando hay error", () => {
    (useQuery as ReturnType<typeof vi.fn>).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    });

    const onFinish = vi.fn();
    const result = Interstitial({ onFinish });

    expect(result).toBeNull();

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

    expect(onFinish).not.toHaveBeenCalled();
    expect(tracker.track).not.toHaveBeenCalled();
  });

  // ── Caso 5: error de imagen (onError) ─────────────────────────────────────

  it("llama onFinish si la imagen falla al cargar", () => {
    const interstitial = {
      id: 2,
      imagen_url: "https://cdn.estancocaqueta.com/roto.jpg",
      duracion_segundos: 4,
    };

    (useQuery as ReturnType<typeof vi.fn>).mockReturnValue({
      data: interstitial,
      isLoading: false,
      isError: false,
    });

    const onFinish = vi.fn();
    const result = Interstitial({ onFinish });

    flushEffects();
    expect(onFinish).not.toHaveBeenCalled();

    // Simular fallo de imagen → onError llama onFinish inmediatamente
    const imageEl = (result as React.ReactElement).props.children as React.ReactElement<{
      onError: () => void;
    }>;
    imageEl.props.onError();

    expect(onFinish).toHaveBeenCalledOnce();
  });
});
