import { describe, it, expect } from "vitest";
import { debeConfirmarEdad, RUTAS_EXENTAS_EDAD } from "../guardEdad";

describe("debeConfirmarEdad", () => {
  it("manda a confirmar cuando la edad está explícitamente sin confirmar", () => {
    expect(debeConfirmarEdad("(tabs)", false)).toBe(true);
    expect(debeConfirmarEdad("product", false)).toBe(true);
  });

  it("deja pasar a quien ya confirmó", () => {
    expect(debeConfirmarEdad("(tabs)", true)).toBe(false);
  });

  it("NO expulsa del mapa de ubicación", () => {
    // El bug del 08-ago-2026: el mapa vive en la raíz (app/ubicacion.tsx), así
    // que al abrirlo desde el onboarding de `(auth)` el guard lo alcanzaba y
    // botaba el pin a medio poner. 34 de 93 aperturas terminaron así.
    expect(debeConfirmarEdad("ubicacion", false)).toBe(false);
    expect(debeConfirmarEdad("ubicacion", undefined)).toBe(false);
  });

  it("NO expulsa mientras el cliente todavía no cargó", () => {
    // `cliente?.edad_confirmada` es undefined cuando `cliente` es null: recién
    // registrado, o un hydrate que falló por red. Eso NO es "no confirmó".
    expect(debeConfirmarEdad("(tabs)", undefined)).toBe(false);
    expect(debeConfirmarEdad("product", undefined)).toBe(false);
  });

  it("no hace nada sin ruta", () => {
    expect(debeConfirmarEdad(undefined, false)).toBe(false);
  });

  it("mantiene exento todo el grupo de autenticación", () => {
    expect(debeConfirmarEdad("(auth)", false)).toBe(false);
  });

  it("la lista de exentas cubre el grupo auth y el mapa", () => {
    expect(RUTAS_EXENTAS_EDAD).toContain("(auth)");
    expect(RUTAS_EXENTAS_EDAD).toContain("ubicacion");
  });
});
