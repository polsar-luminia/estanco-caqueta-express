import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
}));
vi.mock("../../constants/config", () => ({ API_URL: "http://test.local/api/v1" }));

import * as SecureStore from "expo-secure-store";
import { apiFetch, registerUnauthorizedHandler } from "../api";

// Helper para crear una Response mock
function mockResponse(
  status: number,
  body: any,
  ok: boolean = status >= 200 && status < 300
) {
  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue(body),
  } as any;
}

function mockResponseJsonThrows(status: number) {
  return {
    ok: false,
    status,
    json: vi.fn().mockRejectedValue(new Error("Invalid JSON")),
  } as any;
}

describe("apiFetch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("GET con token → inyecta Authorization header", async () => {
    vi.mocked(SecureStore.getItemAsync).mockResolvedValue("tok-abc");
    vi.mocked(fetch).mockResolvedValue(mockResponse(200, { ok: true }));
    await apiFetch("/clientes/perfil");
    const [url, opts] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("http://test.local/api/v1/clientes/perfil");
    expect((opts as any).headers.Authorization).toBe("Bearer tok-abc");
  });

  it("GET sin token → NO incluye Authorization", async () => {
    vi.mocked(SecureStore.getItemAsync).mockResolvedValue(null);
    vi.mocked(fetch).mockResolvedValue(mockResponse(200, { ok: true }));
    await apiFetch("/catalogo/destacados");
    const [, opts] = vi.mocked(fetch).mock.calls[0];
    expect((opts as any).headers.Authorization).toBeUndefined();
  });

  it("POST con body → pasa method y body al fetch", async () => {
    vi.mocked(SecureStore.getItemAsync).mockResolvedValue(null);
    vi.mocked(fetch).mockResolvedValue(mockResponse(201, { id: 1 }));
    await apiFetch("/clientes/login", {
      method: "POST",
      body: JSON.stringify({ telefono: "3001234567" }),
    });
    const [, opts] = vi.mocked(fetch).mock.calls[0];
    expect((opts as any).method).toBe("POST");
    expect((opts as any).body).toBe(JSON.stringify({ telefono: "3001234567" }));
    expect((opts as any).headers["Content-Type"]).toBe("application/json");
  });

  it("happy path → devuelve el JSON parseado", async () => {
    vi.mocked(SecureStore.getItemAsync).mockResolvedValue(null);
    vi.mocked(fetch).mockResolvedValue(mockResponse(200, { data: [1, 2, 3] }));
    const result = await apiFetch<{ data: number[] }>("/x");
    expect(result).toEqual({ data: [1, 2, 3] });
  });

  it("401 → borra token, invoca callback unauthorized, throw UNAUTHORIZED", async () => {
    vi.mocked(SecureStore.getItemAsync).mockResolvedValue("tok-expirado");
    vi.mocked(fetch).mockResolvedValue(mockResponse(401, {}, false));
    const onUnauth = vi.fn();
    registerUnauthorizedHandler(onUnauth);

    await expect(apiFetch("/clientes/perfil")).rejects.toThrow("UNAUTHORIZED");
    expect(SecureStore.deleteItemAsync).toHaveBeenCalled();
    expect(onUnauth).toHaveBeenCalled();
  });

  it("401 en /clientes/login (credenciales malas) → NO borra token ni desloguea (M-AUTH-16)", async () => {
    // Con token presente (invitado que reintenta o sesión previa): un login
    // fallido NO debe disparar el logout global ni borrar el carrito.
    vi.mocked(SecureStore.getItemAsync).mockResolvedValue("tok-viejo");
    vi.mocked(fetch).mockResolvedValue(
      mockResponse(401, { error: "Credenciales invalidas" }, false)
    );
    const onUnauth = vi.fn();
    registerUnauthorizedHandler(onUnauth);

    await expect(
      apiFetch("/clientes/login", { method: "POST", body: "{}" })
    ).rejects.toThrow("Teléfono o contraseña incorrectos");
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
    expect(onUnauth).not.toHaveBeenCalled();
  });

  it("401 en /clientes/reset-password/verificar → NO desloguea", async () => {
    vi.mocked(SecureStore.getItemAsync).mockResolvedValue(null);
    vi.mocked(fetch).mockResolvedValue(mockResponse(401, {}, false));
    const onUnauth = vi.fn();
    registerUnauthorizedHandler(onUnauth);

    await expect(
      apiFetch("/clientes/reset-password/verificar", { method: "POST", body: "{}" })
    ).rejects.toThrow();
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
    expect(onUnauth).not.toHaveBeenCalled();
  });

  it("error conocido (mapping) → devuelve mensaje user-friendly", async () => {
    vi.mocked(SecureStore.getItemAsync).mockResolvedValue(null);
    vi.mocked(fetch).mockResolvedValue(
      mockResponse(400, { error: "Debes ser mayor de 18 años" })
    );
    await expect(apiFetch("/clientes/registrar")).rejects.toThrow(
      "Debes tener 18 años o más"
    );
  });

  it("error desconocido (no whitelisteado) → NO expone body.error crudo, usa fallback genérico por status", async () => {
    vi.mocked(SecureStore.getItemAsync).mockResolvedValue(null);
    vi.mocked(fetch).mockResolvedValue(
      mockResponse(400, { error: "violates foreign key constraint pedido_cliente_fkey" })
    );
    await expect(apiFetch("/x")).rejects.toThrow(/^Error 400$/);
  });

  it("error desconocido en 500 → fallback 'Error del servidor', NO expone body.error crudo", async () => {
    vi.mocked(SecureStore.getItemAsync).mockResolvedValue(null);
    vi.mocked(fetch).mockResolvedValue(
      mockResponse(500, { error: "ECONNREFUSED 127.0.0.1:5432 — pool exhausted" })
    );
    await expect(apiFetch("/x")).rejects.toThrow("Error del servidor, intenta de nuevo");
  });

  it("error desconocido en 403 → fallback 'No tienes permiso', NO expone body.error", async () => {
    vi.mocked(SecureStore.getItemAsync).mockResolvedValue(null);
    vi.mocked(fetch).mockResolvedValue(
      mockResponse(403, { error: "RBAC: role 'cliente' missing permission analytics:read" })
    );
    await expect(apiFetch("/x")).rejects.toThrow("No tienes permiso para hacer esto");
  });

  it("error 500 → fallback genérico 'Error del servidor, intenta de nuevo'", async () => {
    vi.mocked(SecureStore.getItemAsync).mockResolvedValue(null);
    vi.mocked(fetch).mockResolvedValue(mockResponse(500, {}));
    await expect(apiFetch("/x")).rejects.toThrow(
      "Error del servidor, intenta de nuevo"
    );
  });

  it("404 sin body.error → 'Servicio no disponible' (UIAPI-001)", async () => {
    vi.mocked(SecureStore.getItemAsync).mockResolvedValue(null);
    vi.mocked(fetch).mockResolvedValue(mockResponse(404, {}));
    await expect(apiFetch("/x")).rejects.toThrow(/Servicio no disponible/);
  });

  it("403 sin body.error → 'No tienes permiso'", async () => {
    vi.mocked(SecureStore.getItemAsync).mockResolvedValue(null);
    vi.mocked(fetch).mockResolvedValue(mockResponse(403, {}));
    await expect(apiFetch("/x")).rejects.toThrow(/No tienes permiso/);
  });

  it("400 sin body.error y sin match → 'Error {status}'", async () => {
    vi.mocked(SecureStore.getItemAsync).mockResolvedValue(null);
    vi.mocked(fetch).mockResolvedValue(mockResponse(418, {}));
    await expect(apiFetch("/x")).rejects.toThrow("Error 418");
  });

  it("response.json() rechaza → catch devuelve {} y mensaje genérico 500+", async () => {
    vi.mocked(SecureStore.getItemAsync).mockResolvedValue(null);
    vi.mocked(fetch).mockResolvedValue(mockResponseJsonThrows(503));
    await expect(apiFetch("/x")).rejects.toThrow(
      "Error del servidor, intenta de nuevo"
    );
  });
});
