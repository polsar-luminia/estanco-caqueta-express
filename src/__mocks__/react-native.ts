// Minimal mock — solo lo que los stores/api usan
import { vi } from "vitest";

export const Platform = {
  OS: "ios" as "ios" | "android" | "web",
  select: (obj: any) => obj[Platform.OS] ?? obj.default,
};

export const AppState = {
  addEventListener: vi.fn(() => ({ remove: vi.fn() })),
  currentState: "active" as const,
};
