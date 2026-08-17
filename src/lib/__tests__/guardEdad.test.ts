import { describe, it, expect } from "vitest";
import { debeConfirmarEdad, decidirAuthLayout, grupoDebeConfirmarEdad, RUTAS_EXENTAS_EDAD } from "../guardEdad";

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

describe("decidirAuthLayout", () => {
  it("EL BUG DEL 17-AGO: en el mapa, recien registrado y sin edad confirmada, NO expulsa", () => {
    // `useSegments()` es global: el layout de (auth) sigue montado debajo del
    // mapa. Antes devolvia "edad" aqui, tumbaba la pantalla y el formulario de
    // direccion del onboarding moria con la direccion ya escrita.
    expect(decidirAuthLayout(["ubicacion"], true, false)).toBe("render");
  });

  it("deja renderizar las pantallas del onboarding", () => {
    expect(decidirAuthLayout(["(auth)", "direccion-inicial"], true, false)).toBe("render");
    expect(decidirAuthLayout(["(auth)", "edad-confirmar"], true, false)).toBe("render");
  });

  it("dentro de (auth) y sin confirmar edad: manda a confirmarla", () => {
    expect(decidirAuthLayout(["(auth)", "login"], true, false)).toBe("edad");
  });

  it("dentro de (auth) con la edad confirmada: se va al catalogo", () => {
    expect(decidirAuthLayout(["(auth)", "login"], true, true)).toBe("tabs");
  });

  it("cliente sin cargar (undefined) NO cuenta como 'no confirmo'", () => {
    expect(decidirAuthLayout(["(auth)", "login"], true, undefined)).toBe("tabs");
  });

  it("sin sesion, el grupo (auth) se renderiza tal cual", () => {
    expect(decidirAuthLayout(["(auth)", "login"], false, undefined)).toBe("render");
  });

  it("cualquier otra ruta de raiz tampoco se toca desde este layout", () => {
    expect(decidirAuthLayout(["product", "12"], true, false)).toBe("render");
  });
});

describe("grupoDebeConfirmarEdad — los layouts de fondo no expulsan", () => {
  it("EL BUG: en el mapa, el layout de (tabs) sigue montado y NO debe redirigir", () => {
    // Esta era la copia que segui expulsando despues de arreglar (auth): el
    // layout de las tabs vive debajo de todo el onboarding.
    expect(grupoDebeConfirmarEdad(["ubicacion"], "(tabs)", true, true, false)).toBe(false);
  });

  it("tampoco desde profile ni ofertas mientras la persona esta en el mapa", () => {
    expect(grupoDebeConfirmarEdad(["ubicacion"], "profile", true, true, false)).toBe(false);
    expect(grupoDebeConfirmarEdad(["ubicacion"], "ofertas", true, true, false)).toBe(false);
  });

  it("ni durante el onboarding en (auth)", () => {
    expect(grupoDebeConfirmarEdad(["(auth)", "direccion-inicial"], "(tabs)", true, true, false)).toBe(false);
  });

  it("pero SI bloquea el catalogo cuando (tabs) es la ruta activa (Apple 1.4.3)", () => {
    expect(grupoDebeConfirmarEdad(["(tabs)"], "(tabs)", true, true, false)).toBe(true);
    expect(grupoDebeConfirmarEdad(["(tabs)", "index"], "(tabs)", true, true, false)).toBe(true);
  });

  it("cubre que la API omita el campo: undefined con cliente cargado si bloquea", () => {
    expect(grupoDebeConfirmarEdad(["(tabs)"], "(tabs)", true, true, undefined)).toBe(true);
  });

  it("cliente sin cargar todavia no bloquea (evita el flash y la expulsion)", () => {
    expect(grupoDebeConfirmarEdad(["(tabs)"], "(tabs)", true, false, undefined)).toBe(false);
  });

  it("sin sesion no aplica: el catalogo es publico", () => {
    expect(grupoDebeConfirmarEdad(["(tabs)"], "(tabs)", false, false, undefined)).toBe(false);
  });

  it("con la edad confirmada deja pasar", () => {
    expect(grupoDebeConfirmarEdad(["(tabs)"], "(tabs)", true, true, true)).toBe(false);
  });
});
