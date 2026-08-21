/**
 * Tests del BuscadorDireccion: el camino de Google era el único que ponía el pin
 * sin validar la zona de reparto (el mapa valida desde Fase 2, y el proxy de
 * Places restringe a un círculo de 15 km que es más grande que la zona).
 *
 * Estrategia: patrón del proyecto (ver Interstitial.test.tsx) — se mockea react
 * para controlar los useState por orden de llamada, se invoca el componente como
 * función y se extrae el onPress de la sugerencia para disparar `elegir`.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";

// ── Mock react: useState con cola de valores iniciales + captura de setters ───

const _stateQueue: unknown[] = [];
const _setters: Array<ReturnType<typeof vi.fn>> = [];

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    default: actual,
    useState: (init: unknown) => {
      const v = _stateQueue.length > 0 ? _stateQueue.shift() : init;
      const set = vi.fn();
      _setters.push(set);
      return [v, set];
    },
    useEffect: () => {},
    useRef: (init: unknown) => ({ current: init }),
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
    Text: stub("Text"),
    TextInput: stub("TextInput"),
    Pressable: stub("Pressable"),
    ActivityIndicator: stub("ActivityIndicator"),
  };
});

vi.mock("@expo/vector-icons", () => ({ Feather: () => null }));

// ── Mock lib/places ───────────────────────────────────────────────────────────

vi.mock("../../lib/places", () => ({
  buscarDirecciones: vi.fn().mockResolvedValue([]),
  resolverDireccion: vi.fn(),
}));

vi.mock("../../lib/uuid", () => ({ nuevoUuidV4: () => "sesion-test" }));
vi.mock("../../lib/tracker", () => ({ tracker: { track: vi.fn() } }));

// ── Mock del hook de zona: aquí se controla dentro/fuera ──────────────────────

const fueraDeZonaMock = vi.fn();
vi.mock("../../hooks/useZonaEntrega", () => ({
  useZonaEntrega: () => ({ fueraDeZona: fueraDeZonaMock }),
}));

// Importaciones DESPUÉS de los mocks
import { resolverDireccion } from "../../lib/places";
import { tracker } from "../../lib/tracker";
import { BuscadorDireccion } from "../BuscadorDireccion";

// Orden de los useState del componente: sugerencias, buscando, resolviendo, errorCampo.
// Se indexa por POSICION: agregar un useState antes de errorCampo rompe todo esto.
const IDX_ERROR_CAMPO = 3;

const SUGERENCIA = { id: "p1", principal: "Cra 5 # 10-20", secundaria: "Florencia" };

type OnChangeText = (t: string) => void;
type OnUbicacion = Parameters<typeof BuscadorDireccion>[0]["onUbicacion"];

// Renderiza con una sugerencia visible y devuelve su onPress (la función `elegir`).
function renderYExtraerElegir(props: { onChangeText: OnChangeText; onUbicacion: OnUbicacion }) {
  _stateQueue.push([SUGERENCIA], false, false, null);
  const result = BuscadorDireccion({
    value: "cra 5",
    onChangeText: props.onChangeText,
    onUbicacion: props.onUbicacion,
  }) as React.ReactElement<{ children: React.ReactNode[] }>;

  // Estructura: <View> [ <View fila input>, errorCampo && <Text>, <View lista> ] </View>
  const children = React.Children.toArray(result.props.children) as React.ReactElement[];
  const lista = children[children.length - 1] as React.ReactElement<{ children: React.ReactNode[] }>;
  const [pressable] = React.Children.toArray(lista.props.children) as Array<
    React.ReactElement<{ onPress: () => Promise<void> }>
  >;
  return pressable.props.onPress;
}

describe("BuscadorDireccion — validación de zona al elegir sugerencia", () => {
  beforeEach(() => {
    _stateQueue.length = 0;
    _setters.length = 0;
    vi.mocked(tracker.track).mockClear();
    vi.mocked(resolverDireccion).mockReset();
    fueraDeZonaMock.mockReset();
  });

  it("fuera de zona: no pone el pin, no rellena el campo, avisa y trackea", async () => {
    // Punto real del anillo entre el bbox y el círculo de Places (~12 km).
    vi.mocked(resolverDireccion).mockResolvedValue({ lat: 1.547, lng: -75.697, direccion: "Vía a Morelia" });
    fueraDeZonaMock.mockReturnValue(true);

    const onChangeText = vi.fn<(t: string) => void>();
    const onUbicacion = vi.fn<OnUbicacion>();
    await renderYExtraerElegir({ onChangeText, onUbicacion })();

    expect(onUbicacion).not.toHaveBeenCalled();
    expect(onChangeText).not.toHaveBeenCalled();
    expect(_setters[IDX_ERROR_CAMPO]).toHaveBeenCalledWith(
      expect.stringContaining("fuera de nuestra zona de entrega")
    );
    expect(tracker.track).toHaveBeenCalledWith(
      "fuera_de_zona",
      { lat: 1.547, lng: -75.697 },
      "buscador_direccion"
    );
  });

  it("dentro de zona: pone el pin como pin_mapa y limpia el aviso", async () => {
    vi.mocked(resolverDireccion).mockResolvedValue({ lat: 1.6144, lng: -75.6062, direccion: "Cra 5 # 10-20, Florencia" });
    fueraDeZonaMock.mockReturnValue(false);

    const onChangeText = vi.fn<(t: string) => void>();
    const onUbicacion = vi.fn<OnUbicacion>();
    await renderYExtraerElegir({ onChangeText, onUbicacion })();

    expect(onChangeText).toHaveBeenCalledWith("Cra 5 # 10-20, Florencia");
    expect(onUbicacion).toHaveBeenCalledWith({
      lat: 1.6144,
      lng: -75.6062,
      precision_m: null,
      metodo_ubicacion: "pin_mapa",
      geocoded_direccion: "Cra 5 # 10-20, Florencia",
    });
    expect(_setters[IDX_ERROR_CAMPO]).toHaveBeenCalledWith(null);
    expect(tracker.track).not.toHaveBeenCalled();
  });

  // Esta prueba afirmaba lo contrario ("no rompe ni avisa nada") y consagraba un
  // callejon sin salida: la sugerencia no trae coordenadas, hay que pedirlas en un
  // segundo viaje, y si ese viaje falla el componente se quedaba mudo. Tocar la
  // sugerencia no producia NADA — ni pin, ni aviso, ni rastro que permitiera
  // medirlo. Es la explicacion mas probable de las 80 direcciones sin punto.
  it("si el detalle no resuelve, avisa y manda al mapa en vez de quedarse mudo", async () => {
    vi.mocked(resolverDireccion).mockResolvedValue(null);
    fueraDeZonaMock.mockReturnValue(true);

    const onChangeText = vi.fn<(t: string) => void>();
    const onUbicacion = vi.fn<OnUbicacion>();
    await renderYExtraerElegir({ onChangeText, onUbicacion })();

    // Sigue sin poner pin ni tocar el texto: no se inventa una ubicacion.
    expect(onUbicacion).not.toHaveBeenCalled();
    expect(onChangeText).not.toHaveBeenCalled();
    // Pero ahora dice que paso, y ofrece la salida que SIEMPRE funciona.
    const mensaje = vi.mocked(_setters[IDX_ERROR_CAMPO]).mock.calls.at(-1)?.[0];
    expect(mensaje).toMatch(/mapa/i);
    // El fallo de Places no es "fuera de zona": mezclarlos ensuciaria el unico
    // evento con el que se mide la cobertura real de la zona de reparto.
    expect(tracker.track).not.toHaveBeenCalled();
  });
});
