import { create } from "zustand";
import {
  getToken,
  setToken,
  removeToken,
  loginCliente,
  registrarCliente,
  getPerfil,
  registerUnauthorizedHandler,
  eliminarPushToken,
  type Cliente,
} from "../lib/api";

type LogoutHandler = () => void | Promise<void>;
const logoutHandlers: LogoutHandler[] = [];

export function registerLogoutHandler(handler: LogoutHandler) {
  logoutHandlers.push(handler);
}

async function runLogoutHandlers() {
  for (const handler of logoutHandlers) {
    try {
      await handler();
    } catch {
      // los handlers no deben romper el logout
    }
  }
}

interface AuthState {
  token: string | null;
  cliente: Cliente | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  hydrate: () => Promise<void>;
  login: (telefono: string, password: string) => Promise<void>;
  register: (
    telefono: string,
    nombre: string,
    password: string,
    fecha_nacimiento: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
  setCliente: (cliente: Cliente) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  cliente: null,
  isLoading: true,
  isAuthenticated: false,

  hydrate: async () => {
    try {
      const token = await getToken();
      if (!token) {
        set({ isLoading: false, isAuthenticated: false });
        return;
      }
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('TIMEOUT')), 7_000)
      );
      const cliente = await Promise.race([getPerfil(), timeoutPromise]);
      set({ token, cliente, isLoading: false, isAuthenticated: true });
    } catch (err: any) {
      // Solo borrar token si fue rechazado explícitamente (no por error de red)
      if (err?.message === 'UNAUTHORIZED') await removeToken();
      set({ token: null, cliente: null, isLoading: false, isAuthenticated: false });
    }
  },

  login: async (telefono, password) => {
    const { token, cliente } = await loginCliente(telefono, password);
    await setToken(token);
    set({ token, cliente, isAuthenticated: true });
  },

  register: async (telefono, nombre, password, fecha_nacimiento) => {
    const { token, cliente } = await registrarCliente(telefono, nombre, password, fecha_nacimiento);
    await setToken(token);
    set({ token, cliente, isAuthenticated: true });
  },

  logout: async () => {
    // Desactivar push tokens en backend ANTES de borrar el JWT (necesita auth).
    // Best-effort: si falla por red, el frontend sigue cerrando sesión.
    try {
      await eliminarPushToken();
    } catch {
      // sin red u otro error — el frontend reseteará el ref local igualmente
    }
    await removeToken();
    await runLogoutHandlers();
    set({ token: null, cliente: null, isAuthenticated: false });
  },

  setCliente: (cliente) => set({ cliente }),
}));

// Cuando apiFetch recibe un 401, resetea el store sin dep circular
registerUnauthorizedHandler(() => {
  void runLogoutHandlers();
  useAuthStore.setState({ token: null, cliente: null, isAuthenticated: false });
});
