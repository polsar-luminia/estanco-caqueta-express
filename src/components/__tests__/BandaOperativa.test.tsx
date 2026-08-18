/**
 * La banda de demora sale con la tienda ABIERTA, que es justo lo que
 * BandaCerrado no puede hacer (`if (tienda.abierta) return null`).
 *
 * El texto lo elige el backend segun el ETA este visible u oculto; aqui solo se
 * prueba que la banda no invente nada y que se calle cuando debe.
 */
import { describe, it, expect } from "vitest";
import React from "react";
import { BandaOperativa } from "../BandaOperativa";
import type { EstadoTienda } from "../../lib/api";

function textos(nodo: unknown): string[] {
  if (nodo == null || typeof nodo === "boolean") return [];
  if (typeof nodo === "string") return nodo.trim() ? [nodo] : [];
  if (Array.isArray(nodo)) return nodo.flatMap(textos);
  if (React.isValidElement(nodo)) return textos((nodo.props as { children?: unknown }).children);
  return [];
}

const demora = { tipo: "demora" as const, titulo: "Vamos con demora", mensaje: "Hoy hay muchos pedidos." };
const abierta = (aviso: EstadoTienda["aviso"]): EstadoTienda =>
  ({ abierta: true, proximaApertura: "", aviso } as EstadoTienda);

describe("BandaOperativa", () => {
  it("pinta titulo y mensaje del backend", () => {
    const t = textos(BandaOperativa({ tienda: abierta(demora) }) as unknown);
    expect(t).toContain("Vamos con demora");
    expect(t).toContain("Hoy hay muchos pedidos.");
  });

  it("sin aviso no dibuja nada", () => {
    expect(BandaOperativa({ tienda: abierta(null) })).toBeNull();
  });

  it("con la tienda cerrada se calla: ese aviso lo da BandaCerrado", () => {
    const cerrada = { abierta: false, proximaApertura: "", aviso: demora } as EstadoTienda;
    expect(BandaOperativa({ tienda: cerrada })).toBeNull();
  });

  it("un tipo que este binario no conoce se ignora en vez de pintarse mal", () => {
    const raro = { tipo: "huracan", titulo: "T", mensaje: "M" } as unknown as EstadoTienda["aviso"];
    expect(BandaOperativa({ tienda: abierta(raro) })).toBeNull();
  });
});
