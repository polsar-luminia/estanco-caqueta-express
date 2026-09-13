import { describe, it, expect } from "vitest";
import { copyEnvioGratis } from "../copyEnvio";

describe("copyEnvioGratis", () => {
  it("dice el motivo real cuando fue por superar el monto mínimo", () => {
    // El bug real que esto reemplaza: la barra inferior decía SIEMPRE "con tus
    // puntos" cuando envio===0, aunque hubiera sido gratis por monto.
    expect(copyEnvioGratis("monto", 200000)).toBe("Envío gratis por superar $200.000");
  });

  it("dice el motivo real cuando fue por cupón", () => {
    expect(copyEnvioGratis("cupon", 200000)).toBe("Envío gratis con tu cupón");
  });

  it("dice el motivo real cuando fue por puntos", () => {
    expect(copyEnvioGratis("puntos", 200000)).toBe("Envío gratis con tus puntos");
  });

  it("null cuando no hubo motivo (el envío no es gratis)", () => {
    expect(copyEnvioGratis(null, 200000)).toBeNull();
  });
});
