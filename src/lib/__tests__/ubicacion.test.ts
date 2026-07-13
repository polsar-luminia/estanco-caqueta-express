import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// api.ts importa expo-secure-store y la config; los mockeamos igual que api.test.ts.
vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn().mockResolvedValue(null),
  setItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
}));
vi.mock("../../constants/config", () => ({ API_URL: "http://test.local/api/v1" }));

import {
  formatoPrecision,
  esUbicacionAproximada,
  ubicacionABody,
  validarCobertura,
  puntoEnZona,
  PRECISION_APROXIMADA_M,
  type PuntoZona,
  type UbicacionCapturada,
} from "../api";

function mockResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

const ubicGps: UbicacionCapturada = {
  lat: 1.6144,
  lng: -75.6062,
  precision_m: 12.5,
  metodo_ubicacion: "gps",
  geocoded_direccion: "Cra 15, Comuna Norte",
};

describe("formatoPrecision", () => {
  it("redondea y formatea en metros", () => {
    expect(formatoPrecision(12.5)).toBe("±13 m");
    expect(formatoPrecision(0)).toBe("±0 m");
    expect(formatoPrecision(80.4)).toBe("±80 m");
  });
  it("devuelve null para valores ausentes o inválidos", () => {
    expect(formatoPrecision(null)).toBeNull();
    expect(formatoPrecision(undefined)).toBeNull();
    expect(formatoPrecision(-5)).toBeNull();
    expect(formatoPrecision(NaN)).toBeNull();
  });
});

describe("esUbicacionAproximada", () => {
  it("true solo cuando supera el umbral", () => {
    expect(esUbicacionAproximada(PRECISION_APROXIMADA_M + 1)).toBe(true);
    expect(esUbicacionAproximada(200)).toBe(true);
  });
  it("false para precisa, ausente o en el umbral", () => {
    expect(esUbicacionAproximada(PRECISION_APROXIMADA_M)).toBe(false);
    expect(esUbicacionAproximada(10)).toBe(false);
    expect(esUbicacionAproximada(null)).toBe(false);
    expect(esUbicacionAproximada(undefined)).toBe(false);
  });
});

describe("ubicacionABody", () => {
  it("mapea una ubicación válida al body de la API", () => {
    expect(ubicacionABody(ubicGps)).toEqual({
      lat: 1.6144,
      lng: -75.6062,
      precision_m: 12.5,
      metodo_ubicacion: "gps",
      geocoded_direccion: "Cra 15, Comuna Norte",
    });
  });
  it("normaliza precision_m/geocoded ausentes a null", () => {
    const r = ubicacionABody({ lat: 1, lng: -75, metodo_ubicacion: "pin_mapa" } as UbicacionCapturada);
    expect(r).toEqual({ lat: 1, lng: -75, precision_m: null, metodo_ubicacion: "pin_mapa", geocoded_direccion: null });
  });
  it("devuelve {} (sin campos geo) para null/undefined o coords inválidas", () => {
    expect(ubicacionABody(null)).toEqual({});
    expect(ubicacionABody(undefined)).toEqual({});
    expect(ubicacionABody({ lat: NaN, lng: -75, metodo_ubicacion: "gps" } as UbicacionCapturada)).toEqual({});
  });
  it("NUNCA incluye fuera_zona (autoridad del servidor)", () => {
    const conFueraZona = { ...ubicGps, fuera_zona: true } as unknown as UbicacionCapturada;
    expect(ubicacionABody(conFueraZona)).not.toHaveProperty("fuera_zona");
  });
});

describe("puntoEnZona", () => {
  // Rectángulo que cubre el casco urbano de Florencia (bbox del backend).
  const florencia: PuntoZona[] = [
    [1.55, -75.68],
    [1.55, -75.55],
    [1.68, -75.55],
    [1.68, -75.68],
  ];
  it("detecta un punto dentro", () => {
    expect(puntoEnZona(1.6144, -75.6062, florencia)).toBe(true);
  });
  it("detecta un punto fuera (Bogotá)", () => {
    expect(puntoEnZona(4.711, -74.072, florencia)).toBe(false);
  });
  it("un punto justo fuera del borde es false", () => {
    expect(puntoEnZona(1.70, -75.6062, florencia)).toBe(false);
  });
  it("polígono vacío o degenerado → false", () => {
    expect(puntoEnZona(1.61, -75.6, [])).toBe(false);
    expect(puntoEnZona(1.61, -75.6, [[1.55, -75.68]] as PuntoZona[])).toBe(false);
  });
});

describe("validarCobertura", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("arma el querystring lat/lng y devuelve la respuesta", async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse(200, { dentro: true, zona: "Florencia" }));
    const r = await validarCobertura(1.6144, -75.6062);
    expect(r).toEqual({ dentro: true, zona: "Florencia" });
    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("http://test.local/api/v1/cobertura?lat=1.6144&lng=-75.6062");
  });

  it("propaga fuera de zona", async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse(200, { dentro: false, zona: null }));
    const r = await validarCobertura(4.71, -74.07);
    expect(r.dentro).toBe(false);
    expect(r.zona).toBeNull();
  });
});
