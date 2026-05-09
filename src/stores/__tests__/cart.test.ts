import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock tracker y AsyncStorage antes de importar el store
vi.mock("../../lib/tracker", () => ({ tracker: { track: vi.fn() } }));
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn().mockResolvedValue(null),
    setItem: vi.fn().mockResolvedValue(undefined),
    removeItem: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock("react-native", () => ({
  AppState: { addEventListener: vi.fn(() => ({ remove: vi.fn() })) },
}));

import { useCartStore } from "../cart";

const PRODUCT_A = {
  productoId: 1,
  nombre: "Ron Medellín",
  precioUnitario: 25000,
  imagenUrl: "https://example.com/ron.png",
};

const PRODUCT_B = {
  productoId: 2,
  nombre: "Aguardiente Néctar",
  precioUnitario: 18000,
};

describe("useCartStore", () => {
  beforeEach(() => {
    useCartStore.setState({ items: [], direccion: "", barrio: "", notas: "" });
  });

  // ── addItem ────────────────────────────────────────────────────────────────

  it("agrega un producto nuevo con cantidad 1", () => {
    useCartStore.getState().addItem(PRODUCT_A);
    const { items } = useCartStore.getState();
    expect(items).toHaveLength(1);
    expect(items[0].cantidad).toBe(1);
    expect(items[0].productoId).toBe(1);
  });

  it("incrementa cantidad si el producto ya existe", () => {
    useCartStore.getState().addItem(PRODUCT_A);
    useCartStore.getState().addItem(PRODUCT_A);
    const { items } = useCartStore.getState();
    expect(items).toHaveLength(1);
    expect(items[0].cantidad).toBe(2);
  });

  it("agrega productos distintos como ítems separados", () => {
    useCartStore.getState().addItem(PRODUCT_A);
    useCartStore.getState().addItem(PRODUCT_B);
    expect(useCartStore.getState().items).toHaveLength(2);
  });

  // ── addItemWithQuantity ────────────────────────────────────────────────────

  it("agrega producto con cantidad específica", () => {
    useCartStore.getState().addItemWithQuantity(PRODUCT_A, 3);
    expect(useCartStore.getState().items[0].cantidad).toBe(3);
  });

  it("suma cantidad si el producto ya existe", () => {
    useCartStore.getState().addItemWithQuantity(PRODUCT_A, 2);
    useCartStore.getState().addItemWithQuantity(PRODUCT_A, 3);
    expect(useCartStore.getState().items[0].cantidad).toBe(5);
  });

  it("clampa a stockMaximo cuando se piden más unidades de las disponibles", () => {
    const productoLimitado = { ...PRODUCT_A, stockMaximo: 2 };
    useCartStore.getState().addItemWithQuantity(productoLimitado, 5);
    const item = useCartStore.getState().items.find((i) => i.productoId === PRODUCT_A.productoId);
    expect(item?.cantidad).toBe(2);
  });

  // ── updateQuantity ─────────────────────────────────────────────────────────

  it("actualiza la cantidad de un ítem", () => {
    useCartStore.getState().addItem(PRODUCT_A);
    useCartStore.getState().updateQuantity(1, 5);
    expect(useCartStore.getState().items[0].cantidad).toBe(5);
  });

  it("elimina el ítem si la cantidad baja a 0", () => {
    useCartStore.getState().addItem(PRODUCT_A);
    useCartStore.getState().updateQuantity(1, 0);
    expect(useCartStore.getState().items).toHaveLength(0);
  });

  it("elimina el ítem si la cantidad es negativa", () => {
    useCartStore.getState().addItem(PRODUCT_A);
    useCartStore.getState().updateQuantity(1, -1);
    expect(useCartStore.getState().items).toHaveLength(0);
  });

  // ── removeItem ─────────────────────────────────────────────────────────────

  it("elimina un ítem por productoId", () => {
    useCartStore.getState().addItem(PRODUCT_A);
    useCartStore.getState().addItem(PRODUCT_B);
    useCartStore.getState().removeItem(1);
    const { items } = useCartStore.getState();
    expect(items).toHaveLength(1);
    expect(items[0].productoId).toBe(2);
  });

  // ── getTotal ───────────────────────────────────────────────────────────────

  it("calcula el total correctamente", () => {
    useCartStore.getState().addItemWithQuantity(PRODUCT_A, 2); // 50.000
    useCartStore.getState().addItemWithQuantity(PRODUCT_B, 1); // 18.000
    expect(useCartStore.getState().getTotal()).toBe(68000);
  });

  it("retorna 0 para carrito vacío", () => {
    expect(useCartStore.getState().getTotal()).toBe(0);
  });

  // ── getItemCount ───────────────────────────────────────────────────────────

  it("cuenta el total de unidades en el carrito", () => {
    useCartStore.getState().addItemWithQuantity(PRODUCT_A, 3);
    useCartStore.getState().addItemWithQuantity(PRODUCT_B, 2);
    expect(useCartStore.getState().getItemCount()).toBe(5);
  });

  // ── clear ──────────────────────────────────────────────────────────────────

  it("vacía el carrito completamente", () => {
    useCartStore.getState().addItem(PRODUCT_A);
    useCartStore.getState().setDireccion("Carrera 15 # 12-34");
    useCartStore.getState().clear();
    const state = useCartStore.getState();
    expect(state.items).toHaveLength(0);
    expect(state.direccion).toBe("");
    expect(state.notas).toBe("");
  });

  // ── updateStocks ───────────────────────────────────────────────────────────

  it("updateStocks clampa cantidad al nuevo stockMaximo cuando el stock baja", () => {
    useCartStore.getState().addItemWithQuantity({ ...PRODUCT_A, stockMaximo: 10 }, 5);
    const map = new Map<number, number>([[1, 3]]);
    useCartStore.getState().updateStocks(map);
    const { items } = useCartStore.getState();
    expect(items).toHaveLength(1);
    expect(items[0].cantidad).toBe(3);
    expect(items[0].stockMaximo).toBe(3);
  });

  it("updateStocks elimina items con stockMaximo 0 (stock-out)", () => {
    useCartStore.getState().addItem(PRODUCT_A);
    useCartStore.getState().addItem(PRODUCT_B);
    const map = new Map<number, number>([[1, 0]]);
    useCartStore.getState().updateStocks(map);
    const { items } = useCartStore.getState();
    expect(items).toHaveLength(1);
    expect(items[0].productoId).toBe(2);
  });

  it("updateStocks no toca items que no estén en el map", () => {
    useCartStore.getState().addItemWithQuantity(PRODUCT_A, 2);
    useCartStore.getState().addItemWithQuantity(PRODUCT_B, 1);
    const map = new Map<number, number>([[1, 5]]);
    useCartStore.getState().updateStocks(map);
    const items = useCartStore.getState().items;
    const b = items.find((i) => i.productoId === 2);
    expect(b?.cantidad).toBe(1);
    expect(b?.stockMaximo).toBeUndefined();
  });
});
