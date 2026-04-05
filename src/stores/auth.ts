import { create } from "zustand";
import {
  getToken,
  setToken,
  removeToken,
  loginCliente,
  registrarCliente,
  getPerfil,
  type Cliente,
} from "../lib/api";

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
    password: string
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
      const cliente = await getPerfil();
      set({ token, cliente, isLoading: false, isAuthenticated: true });
    } catch {
      await removeToken();
      set({ token: null, cliente: null, isLoading: false, isAuthenticated: false });
    }
  },

  login: async (telefono, password) => {
    const { token, cliente } = await loginCliente(telefono, password);
    await setToken(token);
    set({ token, cliente, isAuthenticated: true });
  },

  register: async (telefono, nombre, password) => {
    const { token, cliente } = await registrarCliente(telefono, nombre, password);
    await setToken(token);
    set({ token, cliente, isAuthenticated: true });
  },

  logout: async () => {
    await removeToken();
    set({ token: null, cliente: null, isAuthenticated: false });
  },

  setCliente: (cliente) => set({ cliente }),
}));
