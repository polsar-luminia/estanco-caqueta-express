import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock completo de ../../lib/api (todas las funciones que auth.ts importa)
vi.mock("../../lib/api", () => ({
  getToken: vi.fn(),
  setToken: vi.fn(),
  removeToken: vi.fn(),
  loginCliente: vi.fn(),
  registrarCliente: vi.fn(),
  getPerfil: vi.fn(),
  registerUnauthorizedHandler: vi.fn(),
  eliminarPushToken: vi.fn().mockResolvedValue(undefined),
}));

// Mock de expo-notifications: auth.ts las llama en logout y en el callback 401.
vi.mock("expo-notifications", () => ({
  dismissAllNotificationsAsync: vi.fn().mockResolvedValue(undefined),
  setBadgeCountAsync: vi.fn().mockResolvedValue(undefined),
}));

import { useAuthStore } from "../auth";
import * as api from "../../lib/api";

// Capturar el callback registrado al importar auth.ts (side effect en L75).
// Debe hacerse aquí (nivel de módulo) porque vi.clearAllMocks() en beforeEach
// borra mock.calls — después ya no se puede recuperar.
const unauthorizedCallback = vi.mocked(api.registerUnauthorizedHandler).mock.calls[0]?.[0];

const ESTADO_INICIAL = {
  token: null,
  cliente: null,
  isLoading: true,
  isAuthenticated: false,
};

describe("useAuthStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState(ESTADO_INICIAL);
  });

  describe("hydrate", () => {
    it("sin token → isAuthenticated=false, isLoading=false", async () => {
      vi.mocked(api.getToken).mockResolvedValue(null);
      await useAuthStore.getState().hydrate();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(useAuthStore.getState().isLoading).toBe(false);
      expect(api.getPerfil).not.toHaveBeenCalled();
    });

    it("con token válido → carga cliente, isAuthenticated=true", async () => {
      vi.mocked(api.getToken).mockResolvedValue("tok-123");
      vi.mocked(api.getPerfil).mockResolvedValue({ id: 1, telefono: "3001234567", nombre: "Juan" } as any);
      await useAuthStore.getState().hydrate();
      expect(useAuthStore.getState().token).toBe("tok-123");
      expect(useAuthStore.getState().cliente?.id).toBe(1);
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
    });

    it("getPerfil lanza UNAUTHORIZED → borra token y resetea", async () => {
      vi.mocked(api.getToken).mockResolvedValue("tok-expirado");
      vi.mocked(api.getPerfil).mockRejectedValue(new Error("UNAUTHORIZED"));
      await useAuthStore.getState().hydrate();
      expect(api.removeToken).toHaveBeenCalled();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });

    it("error de red (NO UNAUTHORIZED) → NO borra token pero resetea sesión", async () => {
      vi.mocked(api.getToken).mockResolvedValue("tok-123");
      vi.mocked(api.getPerfil).mockRejectedValue(new Error("Network request failed"));
      await useAuthStore.getState().hydrate();
      expect(api.removeToken).not.toHaveBeenCalled();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(useAuthStore.getState().isLoading).toBe(false);
    });
  });

  describe("login", () => {
    it("happy path → guarda token, cliente, marca autenticado", async () => {
      vi.mocked(api.loginCliente).mockResolvedValue({
        token: "nuevo-tok",
        cliente: { id: 5, telefono: "3005555555", nombre: "Ana" } as any,
      });
      await useAuthStore.getState().login("3005555555", "password123");
      expect(api.setToken).toHaveBeenCalledWith("nuevo-tok");
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
      expect(useAuthStore.getState().cliente?.nombre).toBe("Ana");
    });

    it("propaga error si loginCliente rechaza", async () => {
      vi.mocked(api.loginCliente).mockRejectedValue(new Error("Credenciales incorrectas"));
      await expect(
        useAuthStore.getState().login("3001234567", "wrong")
      ).rejects.toThrow("Credenciales incorrectas");
      expect(api.setToken).not.toHaveBeenCalled();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });
  });

  describe("register", () => {
    it("happy path con fecha_nacimiento → guarda token y cliente", async () => {
      vi.mocked(api.registrarCliente).mockResolvedValue({
        token: "reg-tok",
        cliente: { id: 10, telefono: "3009876543", nombre: "Luis" } as any,
      });
      await useAuthStore.getState().register(
        "3009876543", "Luis", "password123", "2000-01-15"
      );
      expect(api.registrarCliente).toHaveBeenCalledWith(
        "3009876543", "Luis", "password123", "2000-01-15"
      );
      expect(api.setToken).toHaveBeenCalledWith("reg-tok");
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
    });

  });

  describe("logout", () => {
    it("borra token y resetea estado", async () => {
      useAuthStore.setState({ token: "t", cliente: { id: 1 } as any, isAuthenticated: true });
      await useAuthStore.getState().logout();
      expect(api.removeToken).toHaveBeenCalled();
      expect(useAuthStore.getState().token).toBe(null);
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });

    it("limpia bandeja del OS y badge (M-PERS-13)", async () => {
      const Notifications = await import("expo-notifications");
      useAuthStore.setState({ token: "t", cliente: { id: 1 } as any, isAuthenticated: true });
      await useAuthStore.getState().logout();
      expect(Notifications.dismissAllNotificationsAsync).toHaveBeenCalledTimes(1);
      expect(Notifications.setBadgeCountAsync).toHaveBeenCalledWith(0);
    });
  });

  describe("callback 401 (registerUnauthorizedHandler)", () => {
    it("al invocar el callback se resetea el store", () => {
      useAuthStore.setState({ token: "t", cliente: { id: 1 } as any, isAuthenticated: true });
      expect(unauthorizedCallback).toBeDefined();
      unauthorizedCallback!();
      expect(useAuthStore.getState().token).toBe(null);
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });
  });

  describe("setCliente", () => {
    it("actualiza solo el cliente sin tocar isAuthenticated", () => {
      useAuthStore.setState({ isAuthenticated: true });
      useAuthStore.getState().setCliente({ id: 99, nombre: "Actualizado" } as any);
      expect(useAuthStore.getState().cliente?.id).toBe(99);
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
    });
  });
});
