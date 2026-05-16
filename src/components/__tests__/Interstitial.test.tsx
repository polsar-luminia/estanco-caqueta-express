/**
 * Tests del componente Interstitial.
 *
 * Estrategia: se mockea useQuery para controlar el estado de carga/datos/error
 * y se invoca el componente directamente como función (patrón del proyecto).
 * El timer ahora arranca desde onLoad (no desde el efecto), así que en el
 * caso con datos válidos se extrae onLoad del elemento Image y se llama
 * manualmente para simular que la imagen terminó de cargar.
 *
 * Mientras la imagen carga se muestra SplashBranded como overlay (mockeado
 * a null). Si en 7s no cargó, un timeout llama onFinish directamente.
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
    useState: (init: unknown) => [init, vi.fn()],
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

// ── Mock SplashBranded (no necesitamos testear sus internos aquí) ─────────────

vi.mock("../SplashBranded", () => ({
  SplashBranded: () => null,
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

// ── Helpers para extraer el elemento Image del árbol ──────────────────────────

function getImageEl(result: React.ReactElement) {
  // Estructura: <View> [ <Image />, <View><SplashBranded /></View> ] </View>
  // Image es el primer hijo de la View raíz.
  const children = (result.props as { children: React.ReactElement[] }).children;
  return children[0] as React.ReactElement<{ onLoad: () => void; onError: () => void }>;
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

  // ── Caso 2: data válida — splash hasta onLoad, timer arranca desde onLoad ──

  it("muestra splash hasta que la imagen carga y luego llama onFinish tras duracion_segundos", () => {
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

    // Efectos fail-fast e imagen-timeout arrancan (data existe, sin error)
    flushEffects();
    expect(onFinish).not.toHaveBeenCalled();
    expect(tracker.track).not.toHaveBeenCalled();

    // Simular que la imagen terminó de cargar → onLoad cancela timeout + dispara timer
    const imageEl = getImageEl(result as React.ReactElement);
    imageEl.props.onLoad();

    expect(tracker.track).toHaveBeenCalledWith("interstitial_mostrado", { interstitial_id: 1 });
    expect(onFinish).not.toHaveBeenCalled();

    // Avanzar 3 segundos → timer de duración completa
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

  it("muestra SplashBranded (no home) mientras isLoading es true y no llama onFinish", () => {
    (useQuery as ReturnType<typeof vi.fn>).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    });

    const onFinish = vi.fn();
    const result = Interstitial({ onFinish });

    // Debe cubrir el home con el splash, no retornar null
    expect(result).not.toBeNull();

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
    const imageEl = getImageEl(result as React.ReactElement);
    imageEl.props.onError();

    expect(onFinish).toHaveBeenCalledOnce();
  });

  // ── Caso 6: timeout de 7s si la imagen nunca carga ────────────────────────

  it("llama onFinish tras 7s si la imagen no llega a cargar", () => {
    const interstitial = {
      id: 3,
      imagen_url: "https://cdn.estancocaqueta.com/lento.jpg",
      duracion_segundos: 4,
    };

    (useQuery as ReturnType<typeof vi.fn>).mockReturnValue({
      data: interstitial,
      isLoading: false,
      isError: false,
    });

    const onFinish = vi.fn();
    Interstitial({ onFinish });

    flushEffects();
    expect(onFinish).not.toHaveBeenCalled();

    // No llamamos onLoad → el timeout de 7s dispara
    vi.advanceTimersByTime(7000);

    expect(onFinish).toHaveBeenCalledOnce();
    expect(tracker.track).not.toHaveBeenCalled();
  });
});
