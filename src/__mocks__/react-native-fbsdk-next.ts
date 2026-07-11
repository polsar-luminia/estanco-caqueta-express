// Mock de react-native-fbsdk-next para vitest (entorno node, sin módulo nativo).
// Cubre la superficie que usa src/lib/metaEvents.ts. Todas las funciones son no-op.
import { vi } from "vitest";

export const AppEventsLogger = {
  logEvent: vi.fn(),
  logPurchase: vi.fn(),
  setUserID: vi.fn(),
  setUserData: vi.fn(),
  clearUserID: vi.fn(),
  clearUserData: vi.fn(),
  activateApp: vi.fn(),
};

export const Settings = {
  setAdvertiserTrackingEnabled: vi.fn(),
  setAutoLogAppEventsEnabled: vi.fn(),
  initializeSDK: vi.fn(),
};

export default { AppEventsLogger, Settings };
