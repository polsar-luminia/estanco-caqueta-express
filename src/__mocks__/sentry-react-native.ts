// Stub mínimo para @sentry/react-native en tests de Vitest
export const init = () => {};
export const wrap = (component: unknown) => component;
export const captureException = () => '';
export const captureMessage = () => '';
export const addBreadcrumb = () => {};
export const setUser = () => {};
export const setTag = () => {};
export const setExtra = () => {};
export const withScope = (cb: (scope: unknown) => void) => cb({
  setTag: () => {},
  setExtra: () => {},
  setFingerprint: () => {},
});
