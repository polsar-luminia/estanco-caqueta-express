import { create } from "zustand";
import * as Sentry from "@sentry/react-native";
import * as Notifications from "expo-notifications";
import { metaIdentify, metaClearUser } from "../lib/metaEvents";
import { tracker } from "../lib/tracker";
import {
  getToken,
  setToken,
  removeToken,
  loginCliente,
  registrarCliente,
  getPerfil,
  registerUnauthorizedHandler,
  eliminarPushToken,
  logoutCliente,
  type Cliente,
} from "../lib/api";

// M-PERS-13: bandeja del OS y badge son datos de sesión — deben limpiarse
// en cualquier cierre (logout manual o 401). Best-effort: si el OS rechaza
// (raro), la sesión sigue cerrándose.
async function limpiarNotificacionesOS() {
  try {
    await Notifications.dismissAllNotificationsAsync();
  } catch {
    // OS rechazó — ignorar.
  }
  try {
    await Notifications.setBadgeCountAsync(0);
  } catch {
    // OS rechazó — ignorar.
  }
}

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
  lastHydrateError: 'network' | null;

  hydrate: () => Promise<void>;
  clearHydrateError: () => void;
  login: (telefono: string, password: string) => Promise<void>;
  register: (
    telefono: string,
    nombre: string,
    password: string,
    fecha_nacimiento: string,
    acepta_mercadeo: boolean,
    // OTP de verificación del teléfono. Opcional solo por compatibilidad de
    // firma: el flujo nuevo de register.tsx siempre lo manda.
    codigo?: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
  setCliente: (cliente: Cliente) => void;
  markEdadConfirmada: (at?: string) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  cliente: null,
  isLoading: true,
  isAuthenticated: false,
  lastHydrateError: null,

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
      // Éxito: limpiar cualquier lastHydrateError previo para que el listener
      // de reconexión (app/_layout.tsx) no siga reintentando (M-PERS-16).
      set({ token, cliente, isLoading: false, isAuthenticated: true, lastHydrateError: null });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      const isUnauthorized = msg === 'UNAUTHORIZED';
      const isNetwork =
        msg === 'TIMEOUT' ||
        msg === 'Sin conexión, intenta de nuevo' ||
        msg === 'Network request failed' ||
        (err instanceof Error && err.name === 'TypeError');

      if (isUnauthorized) {
        // Sesión inválida confirmada por el servidor — borrar token
        await removeToken();
        set({ token: null, cliente: null, isLoading: false, isAuthenticated: false });
        return;
      }

      if (!isNetwork) {
        // Error inesperado (JSON malformado, schema error, etc.) — reportar para diagnóstico
        Sentry.captureException(err instanceof Error ? err : new Error(String(err)), {
          tags: { flow: 'auth', action: 'hydrate' },
        });
      }

      // En fallo de red: token válido, pero no podemos verificarlo ahora.
      // No se borra el token — al reabrir con conexión hydrate volverá a intentarlo.
      set({
        token: null,
        cliente: null,
        isLoading: false,
        isAuthenticated: false,
        lastHydrateError: isNetwork ? 'network' : null,
      });
    }
  },

  clearHydrateError: () => set({ lastHydrateError: null }),

  login: async (telefono, password) => {
    const { token, cliente } = await loginCliente(telefono, password);
    await setToken(token);
    set({ token, cliente, isAuthenticated: true });
    metaIdentify(cliente.id, cliente.telefono);
  },

  register: async (telefono, nombre, password, fecha_nacimiento, acepta_mercadeo, codigo) => {
    const { token, cliente } = await registrarCliente(
      telefono, nombre, password, fecha_nacimiento, acepta_mercadeo, codigo,
    );
    await setToken(token);
    set({ token, cliente, isAuthenticated: true });
    metaIdentify(cliente.id, cliente.telefono);
  },

  logout: async () => {
    // M-AUTH-15: revocar sesión server-side antes de borrar el token local.
    // Best-effort: si falla por red el logout local continúa igual.
    await logoutCliente().catch(() => {});
    // Desactivar push tokens en backend ANTES de borrar el JWT (necesita auth).
    // Best-effort: si falla por red, el frontend sigue cerrando sesión.
    try {
      await eliminarPushToken();
    } catch {
      // sin red u otro error — el frontend reseteará el ref local igualmente
    }
    // M-PERS-13: limpiar bandeja del OS + badge antes de los handlers de app
    // (cart, query-cache, push-registered) para que el orden sea OS → app.
    await limpiarNotificacionesOS();
    await removeToken();
    await runLogoutHandlers();
    set({ token: null, cliente: null, isAuthenticated: false });
    metaClearUser();
  },

  setCliente: (cliente) => set({ cliente }),

  // Marca el flag local tras confirmar edad sin tener que refetch /perfil.
  // Mantiene el resto del cliente intacto (puntos, direcciones, etc).
  markEdadConfirmada: (at) =>
    set((state) =>
      state.cliente
        ? {
            cliente: {
              ...state.cliente,
              edad_confirmada: true,
              edad_confirmada_at: at ?? new Date().toISOString(),
            },
          }
        : state,
    ),
}));

// Cuando apiFetch recibe un 401, resetea el store sin dep circular
registerUnauthorizedHandler(() => {
  // POR AQUI SOLO PASA LA EXPIRACION, NO EL LOGOUT VOLUNTARIO — `logout()` de
  // arriba limpia el estado por su cuenta y nunca llama a este handler. Esa es
  // justamente la distincion que faltaba: la sesion dura 7 dias exactos y no se
  // renueva, asi que toda la base vuelve al login cada semana, pero esa
  // expiracion era INVISIBLE. La persona reaparecia en el login y no habia
  // forma de saber si venia de una sesion caida o de haberse deslogueado.
  // Sin este evento, "629 de 741 cuentas sin sesion viva" hay que deducirlo del
  // estado de una tabla en vez de medirlo.
  //
  // Va aqui y no en `api.ts` porque `tracker.ts` importa de `api.ts`: al reves
  // seria un ciclo.
  tracker.track("sesion_expirada", {}, undefined);
  // M-PERS-13: limpieza OS-side igual que en logout manual.
  void limpiarNotificacionesOS();
  void runLogoutHandlers();
  useAuthStore.setState({ token: null, cliente: null, isAuthenticated: false });
});
