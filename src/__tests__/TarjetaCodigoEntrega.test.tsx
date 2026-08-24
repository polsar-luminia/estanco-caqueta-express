/**
 * Tarjeta del código de entrega (097) — lo que fija este archivo:
 *
 *  - el código solo se pinta con `estado === "domiciliario_llego"` Y el
 *    campo presente;
 *  - si el campo falta (funcionalidad dormida, o binario/version que no lo
 *    recibe) no pinta NADA, ni un hueco vacío -- la convención documentada
 *    en `interface Pedido` de que todo campo nuevo es opcional;
 *  - aunque el campo venga por error, un pedido ya `entregado` no lo
 *    muestra: es la redundancia deliberada de un secreto de un solo uso.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from "vitest";
import React from "react";

vi.mock("react-native", () => {
  const stub = (name: string) =>
    Object.assign(({ children }: any) => React.createElement(name, null, children), {
      displayName: name,
    });
  return { View: stub("View"), Text: stub("Text"), Pressable: stub("Pressable") };
});

import { TarjetaCodigoEntrega } from "../components/TarjetaCodigoEntrega";

function pedidoBase(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    estado: "domiciliario_llego",
    created_at: "2026-08-24T10:00:00Z",
    lineas: [],
    subtotal: 0,
    total: 0,
    direccion: "x",
    ...overrides,
  } as any;
}

// Recorre el árbol juntando los strings visibles (mismo helper que
// OrderStatusTimeline.test.tsx).
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

// Busca el primer nodo cuyas props cumplan el predicado (para leer un
// accessibilityLabel sin recorrer el arbol a mano en cada prueba).
function buscar(node: any, pred: (props: any) => boolean): any {
  if (node == null || typeof node === "boolean" || typeof node === "string" || typeof node === "number") return null;
  if (Array.isArray(node)) {
    for (const n of node) {
      const r = buscar(n, pred);
      if (r) return r;
    }
    return null;
  }
  if (node.props && pred(node.props)) return node;
  if (node.props?.children) return buscar(node.props.children, pred);
  return null;
}

describe("TarjetaCodigoEntrega", () => {
  it("pinta los digitos cuando el estado es domiciliario_llego y el campo viene", () => {
    const out = TarjetaCodigoEntrega({
      pedido: pedidoBase({ codigo_entrega: "4072" }),
      onPedirAyuda: () => {},
    });
    expect(textos(out)).toContain("4072");
  });

  it("no pinta nada si el campo falta, aunque el estado sea el correcto", () => {
    const out = TarjetaCodigoEntrega({
      pedido: pedidoBase({ codigo_entrega: undefined }),
      onPedirAyuda: () => {},
    });
    expect(out).toBeNull();
  });

  it("no pinta nada con estado entregado, aunque el campo venga por error", () => {
    const out = TarjetaCodigoEntrega({
      pedido: pedidoBase({ estado: "entregado", codigo_entrega: "4072" }),
      onPedirAyuda: () => {},
    });
    expect(out).toBeNull();
  });

  it("el accessibilityLabel deletrea los digitos separados", () => {
    const out = TarjetaCodigoEntrega({
      pedido: pedidoBase({ codigo_entrega: "4072" }),
      onPedirAyuda: () => {},
    });
    const nodo = buscar(out, (p) => typeof p.accessibilityLabel === "string" && p.accessibilityLabel.includes("código de entrega"));
    expect(nodo?.props.accessibilityLabel).toBe("Tu código de entrega: 4, 0, 7, 2");
  });

  it('"No veo mi código" llama a onPedirAyuda', () => {
    const onPedirAyuda = vi.fn();
    const out = TarjetaCodigoEntrega({ pedido: pedidoBase({ codigo_entrega: "4072" }), onPedirAyuda });
    const boton = buscar(out, (p) => p.accessibilityRole === "button");
    expect(boton).toBeTruthy();
    boton.props.onPress();
    expect(onPedirAyuda).toHaveBeenCalledOnce();
  });
});
