// Globals que RN/Expo usan
(globalThis as { __DEV__?: boolean }).__DEV__ = true;

// Interceptar require() para assets binarios de imagen. RN+Metro los
// transforma a un número; en node con vitest, require('foo.png') intenta
// parsear los bytes como JS y truena. Este shim devuelve 1 para cualquier
// require de PNG/JPG/GIF/WEBP/SVG en pruebas.
import Module from "node:module";
const originalResolve = Module.createRequire(import.meta.url);
const ASSET_RX = /\.(png|jpe?g|gif|webp|svg|bmp|ico)$/i;
const origRequire = Module.prototype.require;
(Module.prototype as { require: (id: string) => unknown }).require =
  function patchedRequire(this: Module, id: string) {
    if (typeof id === "string" && ASSET_RX.test(id)) return 1;
    return origRequire.call(this, id);
  };
// `originalResolve` se mantiene para evitar que el linter quite el import.
void originalResolve;
