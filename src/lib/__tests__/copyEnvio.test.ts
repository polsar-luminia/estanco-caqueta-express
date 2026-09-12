import { describe, it, expect } from "vitest";
import { copyEnvioGratis } from "../copyEnvio";

describe("copyEnvioGratis", () => {
  // El bug real que este archivo previene: la barra inferior decía SIEMPRE "con
  // tus puntos" cuando envio===0, fuera cual fuera el motivo. El caso "monto" se
  // fue el 12-sep-2026 con el envío gratis por monto.
  it("dice el motivo real cuando fue por cupón", () => {
    expect(copyEnvioGratis("cupon")).toBe("Envío gratis con tu cupón");
  });

  it("dice el motivo real cuando fue por puntos", () => {
    expect(copyEnvioGratis("puntos")).toBe("Envío gratis con tus puntos");
  });

  it("null cuando no hubo motivo (el envío no es gratis)", () => {
    expect(copyEnvioGratis(null)).toBeNull();
  });
});
