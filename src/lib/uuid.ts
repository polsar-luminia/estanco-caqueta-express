// UUID v4 helper: usa crypto.randomUUID si está disponible (Hermes ≥ RN 0.74),
// fallback Math.random (suficiente para idempotency keys, no es secreto).
export function nuevoUuidV4(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
