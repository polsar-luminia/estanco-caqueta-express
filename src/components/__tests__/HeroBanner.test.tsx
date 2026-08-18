/**
 * Lo que se protege: que un banner pueda salir DESNUDO.
 *
 * Antes, el chip del tipo, "Domicilio en Florencia" y "Pedir ahora" se pintaban
 * siempre porque eran literales del componente. Un banner disenado con su propio
 * texto adentro de la imagen salia con el texto encimado y no habia forma de
 * quitarlo sin publicar una version nueva de la app.
 *
 * La distincion que se prueba es undefined (backend viejo -> pinta lo de
 * siempre) contra null (vacio a proposito -> no pinta). Colapsarlas es
 * exactamente el bug que habia, y no da error: simplemente reaparece el texto.
 *
 * Patron del proyecto (ver Interstitial.test.tsx): el componente se invoca como
 * funcion y se recorre el arbol devuelto. HeroSlide no usa hooks.
 */
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { HeroSlide } from "../HeroBanner";
import type { Patrocinado } from "../../lib/api";

vi.mock("../ShimmerImage", () => ({ ShimmerImage: () => null }));

// Junta todos los strings del arbol, sin importar la profundidad.
function textos(nodo: unknown): string[] {
  if (nodo == null || typeof nodo === "boolean") return [];
  if (typeof nodo === "string") return nodo.trim() ? [nodo] : [];
  if (Array.isArray(nodo)) return nodo.flatMap(textos);
  if (React.isValidElement(nodo)) {
    return textos((nodo.props as { children?: unknown }).children);
  }
  return [];
}

const render = (banner: Patrocinado | undefined) =>
  textos(HeroSlide({ banner, onPress: () => {} }) as unknown);

const base: Patrocinado = { id: 1, tipo: "irresistible", titulo: "Ron barato", imagen_url: "x.png" };

describe("HeroSlide", () => {
  it("backend viejo (campos ausentes) pinta la decoracion de siempre", () => {
    const t = render(base);
    expect(t).toContain("Irresistible");
    expect(t).toContain("Domicilio en Florencia");
    expect(t).toContain("Pedir ahora");
  });

  it("campos en null: el banner sale limpio, solo con su titulo", () => {
    const t = render({ ...base, etiqueta: null, subtitulo: null, cta_texto: null });
    expect(t).toContain("Ron barato");
    expect(t).not.toContain("Irresistible");
    expect(t).not.toContain("Domicilio en Florencia");
    expect(t).not.toContain("Pedir ahora");
  });

  it("todo en null: ni un solo texto encima de la imagen", () => {
    const t = render({ ...base, titulo: null as never, etiqueta: null, subtitulo: null, cta_texto: null });
    expect(t).toEqual([]);
  });

  it("cadena vacia cuenta como vacio, no como texto", () => {
    const t = render({ ...base, etiqueta: "", subtitulo: "   ", cta_texto: "" });
    expect(t).toEqual(["Ron barato"]);
  });

  it("los textos propios ganan sobre los de fabrica", () => {
    const t = render({ ...base, etiqueta: "NUEVO", subtitulo: "Solo hoy", cta_texto: "Ver" });
    expect(t).toContain("NUEVO");
    expect(t).toContain("Solo hoy");
    expect(t).toContain("Ver");
    expect(t).not.toContain("Irresistible");
  });

  it("sin banner (esqueleto de carga) sigue mostrando el relleno", () => {
    expect(render(undefined)).toContain("Pedir ahora");
  });

  it("sin boton, el banner entero queda tocable", () => {
    const onPress = vi.fn();
    const el = HeroSlide({ banner: { ...base, cta_texto: null }, onPress }) as React.ReactElement;
    (el.props as { onPress?: () => void }).onPress?.();
    expect(onPress).toHaveBeenCalled();
  });
});
