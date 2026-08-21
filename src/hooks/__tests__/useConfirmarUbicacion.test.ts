// La escalera del punto de partida del pin.
//
// POR QUE SE PRUEBA: es exactamente el tipo de logica que no falla, sino que da
// un resultado creible y equivocado. Si un escalon se rompe, el mapa abre en un
// punto plausible de Florencia y la persona confirma sin sospechar nada — y la
// direccion queda mal ubicada para siempre, sin un solo error en ningun lado.

import { describe, it, expect, vi, beforeEach } from "vitest";

const geocodeAsync = vi.fn();
vi.mock("expo-location", () => ({ geocodeAsync: (...a: unknown[]) => geocodeAsync(...a) }));
vi.mock("expo-router", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("../../stores/ubicacionPicker", () => ({ useUbicacionPicker: () => vi.fn() }));

import { puntoDePartida, FLORENCIA } from "../useConfirmarUbicacion";

describe("puntoDePartida — de que punto arranca el pin", () => {
  // Con llaves: `mockReset()` DEVUELVE el mock, y vitest interpreta lo que
  // devuelve un hook como funcion de limpieza — o sea que lo invocaba al terminar
  // cada prueba. Con la implementacion que lanza, reventaba en el teardown y el
  // fallo se veia como si el `catch` del hook no atrapara.
  beforeEach(() => { geocodeAsync.mockReset(); });

  it("1º el punto que ya se tiene: no se geocodifica nada", async () => {
    const r = await puntoDePartida("Cra 5 # 10-20", { lat: 1.62, lng: -75.61 });
    expect(r).toEqual({ lat: 1.62, lng: -75.61 });
    expect(geocodeAsync).not.toHaveBeenCalled();
  });

  it("2º el texto escrito, acotado a Florencia", async () => {
    geocodeAsync.mockResolvedValue([{ latitude: 1.63, longitude: -75.62 }]);
    const r = await puntoDePartida("Cra 5 # 10-20", null);
    expect(r).toEqual({ lat: 1.63, lng: -75.62 });
    // Sin acotar, "Cra 5 # 10-20" resuelve en cualquier ciudad del pais.
    expect(geocodeAsync).toHaveBeenCalledWith("Cra 5 # 10-20, Florencia, Caquetá, Colombia");
  });

  it("3º el centro de Florencia cuando no hay nada mejor", async () => {
    geocodeAsync.mockResolvedValue([]);
    expect(await puntoDePartida("Cra 5 # 10-20", null)).toEqual(FLORENCIA);
  });

  it("un texto muy corto no se geocodifica: no vale la pena adivinar", async () => {
    expect(await puntoDePartida("abc", null)).toEqual(FLORENCIA);
    expect(geocodeAsync).not.toHaveBeenCalled();
  });

  it("si el geocoder revienta, cae al centro en vez de propagar", async () => {
    // El geocoder del sistema es un lujo, no un requisito: que falle no puede
    // impedir que se abra el mapa, que es la unica salida que siempre funciona.
    geocodeAsync.mockImplementation(() => { throw new Error("sin red"); });
    expect(await puntoDePartida("Cra 5 # 10-20", null)).toEqual(FLORENCIA);
  });

  it("una direccion guardada sin pin cae al texto, no a coordenadas nulas", async () => {
    // El caso real: las 80 direcciones sin punto llegan como { lat: null }.
    geocodeAsync.mockResolvedValue([{ latitude: 1.64, longitude: -75.63 }]);
    const r = await puntoDePartida("Barrio Ventilador, casa 3", { lat: null, lng: null });
    expect(r).toEqual({ lat: 1.64, lng: -75.63 });
  });
});
