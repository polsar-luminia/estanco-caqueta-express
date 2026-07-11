// Mock de expo-tracking-transparency para vitest (entorno node).
// metaEvents.ts llama requestTrackingPermissionsAsync() en iOS; en tests
// devolvemos 'granted' de forma síncrona-mockeada.
import { vi } from "vitest";

export const requestTrackingPermissionsAsync = vi.fn(async () => ({
  status: "granted" as const,
  granted: true,
  canAskAgain: true,
  expires: "never" as const,
}));

export const getTrackingPermissionsAsync = vi.fn(async () => ({
  status: "granted" as const,
  granted: true,
  canAskAgain: true,
  expires: "never" as const,
}));
