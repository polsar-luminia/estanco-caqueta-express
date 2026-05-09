// Stub mínimo para @sentry/react-native en tests de Vitest
import { vi } from "vitest";
export const init = vi.fn();
export const wrap = vi.fn((component: unknown) => component);
export const captureException = vi.fn().mockReturnValue('');
export const captureMessage = vi.fn().mockReturnValue('');
export const addBreadcrumb = vi.fn();
export const setUser = vi.fn();
export const setTag = vi.fn();
export const setExtra = vi.fn();
export const withScope = vi.fn((cb: (scope: unknown) => void) => cb({
  setTag: vi.fn(),
  setExtra: vi.fn(),
  setFingerprint: vi.fn(),
}));
export const setupExpressErrorHandler = vi.fn();
