import { describe, it, expect } from "vitest";
import { nuevoUuidV4 } from "../uuid";

const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe("nuevoUuidV4 (M-CART-15)", () => {
  it("formato UUID v4 válido", () => {
    const id = nuevoUuidV4();
    expect(id).toMatch(UUID_V4_RE);
  });

  it("genera valores distintos en llamadas sucesivas", () => {
    const a = nuevoUuidV4();
    const b = nuevoUuidV4();
    expect(a).not.toBe(b);
  });
});
