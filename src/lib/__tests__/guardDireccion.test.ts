import { describe, it, expect } from "vitest";
import { debeExigirDireccionInicial } from "../guardDireccion";

// Atajo: el caso "todo listo para expulsar", que cada prueba desarma por un lado.
const args = (over: Partial<{
  segmentos: string[]; grupo: string; auth: boolean; cargado: boolean;
  edad: boolean | undefined; dir: boolean | undefined; bandera: boolean | undefined;
}> = {}) => {
  const a = { segmentos: ["(tabs)"], grupo: "(tabs)", auth: true, cargado: true,
              edad: true as boolean | undefined, dir: false as boolean | undefined,
              bandera: true as boolean | undefined, ...over };
  return debeExigirDireccionInicial(a.segmentos, a.grupo, a.auth, a.cargado, a.edad, a.dir, a.bandera);
};

describe("debeExigirDireccionInicial", () => {
  it("expulsa a quien no tiene direccion, con la bandera prendida", () => {
    expect(args()).toBe(true);
  });

  // Lo que hace que esta bandera sea segura de desplegar: apagada no cambia nada.
  it("con la bandera apagada o ausente NUNCA redirige", () => {
    expect(args({ bandera: false })).toBe(false);
    expect(args({ bandera: undefined })).toBe(false);
  });

  it("no toca al invitado", () => {
    expect(args({ auth: false })).toBe(false);
  });

  // El bug del 17-ago, que aqui seria peor: esta pantalla manda AL MAPA, asi que
  // un guard de fondo mataria el formulario de direccion con la direccion escrita.
  it("no redirige cuando la ruta activa es de otro grupo", () => {
    expect(args({ segmentos: ["ubicacion"] })).toBe(false);
    expect(args({ segmentos: ["(auth)", "direccion-inicial"] })).toBe(false);
    expect(args({ segmentos: ["product", "[id]"] })).toBe(false);
  });

  // `undefined` es "el perfil todavia no cargo", no "no tiene direccion".
  // Confundirlos saca de su pantalla a quien SI tiene una.
  it("en la duda no redirige", () => {
    expect(args({ dir: undefined })).toBe(false);
    expect(args({ cargado: false })).toBe(false);
  });

  it("no redirige a quien ya tiene direccion", () => {
    expect(args({ dir: true })).toBe(false);
  });

  // Sin esto los dos guards se disputan la navegacion y la persona rebota.
  it("cede el paso al age gate", () => {
    expect(args({ edad: false })).toBe(false);
    expect(args({ edad: undefined })).toBe(false);
  });
});
