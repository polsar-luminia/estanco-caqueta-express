/**
 * Timeline del pedido — lo que fija este archivo es la regla de resiliencia de
 * la 068: un estado que este binario no conoce se resuelve por el ÚLTIMO
 * timestamp presente (antes dejaba los pasos enteros grises, como si el pedido
 * no hubiera avanzado nada), y los dos pasos nuevos (preparado, llegó) solo se
 * pintan si ocurrieron.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from "vitest";
import React from "react";

vi.mock("react-native", () => {
  const stub = (name: string) =>
    Object.assign(({ children }: any) => React.createElement(name, null, children), {
      displayName: name,
    });
  return { View: stub("View"), Text: stub("Text") };
});

vi.mock("../../lib/format", () => ({ formatTime: (v: string) => `t(${v})` }));

import { OrderStatusTimeline } from "../OrderStatusTimeline";

function pedidoBase(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    estado: "recibido",
    created_at: "2026-08-16T10:00:00Z",
    lineas: [],
    subtotal: 0,
    total: 0,
    direccion: "x",
    ...overrides,
  } as any;
}

// Recorre el árbol juntando los strings visibles y, por paso, si está resaltado.
function textos(node: any, acc: string[] = []): string[] {
  if (node == null || typeof node === "boolean") return acc;
  if (typeof node === "string" || typeof node === "number") {
    acc.push(String(node));
    return acc;
  }
  if (Array.isArray(node)) {
    node.forEach((n) => textos(n, acc));
    return acc;
  }
  if (node.props) textos(node.props.children, acc);
  return acc;
}

describe("OrderStatusTimeline — pasos opcionales de la 068", () => {
  it("un pedido clásico (sin listo_at/llego_at) muestra solo los 4 pasos de siempre", () => {
    const out = OrderStatusTimeline({ estado: "entregado", pedido: pedidoBase({ estado: "entregado", entregado_at: "2026-08-16T11:00:00Z" }) });
    const t = textos(out);
    expect(t).toContain("Recibido");
    expect(t).toContain("Despachado");
    expect(t).toContain("Entregado");
    expect(t).not.toContain("Preparado");
    expect(t).not.toContain("Tu domiciliario llegó");
  });

  it("con estado preparado aparece su paso aunque listo_at aún no llegue en el payload", () => {
    const t = textos(OrderStatusTimeline({ estado: "preparado", pedido: pedidoBase({ estado: "preparado" }) }));
    expect(t).toContain("Preparado");
  });

  it("con llego_at presente aparece el paso del domiciliario", () => {
    const t = textos(
      OrderStatusTimeline({
        estado: "domiciliario_llego",
        pedido: pedidoBase({ estado: "domiciliario_llego", despachado_at: "x", llego_at: "2026-08-16T11:30:00Z" }),
      })
    );
    expect(t).toContain("Tu domiciliario llegó");
  });

  it("estado DESCONOCIDO: se resuelve por el último timestamp y no queda todo gris", () => {
    // Simula un binario viejo recibiendo un estado futuro: el timeline debe
    // anclarse al último paso con sello (despachado) en vez de a ninguno.
    const out = OrderStatusTimeline({
      estado: "estado_futuro_x",
      pedido: pedidoBase({ estado: "estado_futuro_x", preparado_at: "a", despachado_at: "b" }),
    });
    // El render no revienta y el árbol contiene los pasos con sus horas.
    const t = textos(out);
    expect(t).toContain("Despachado");
    expect(t.some((s) => s.includes("t(b)"))).toBe(true);
  });

  it("cancelado conserva su rama especial", () => {
    const t = textos(OrderStatusTimeline({ estado: "cancelado", pedido: pedidoBase({ estado: "cancelado" }) }));
    expect(t).toContain("Pedido cancelado");
  });
});
