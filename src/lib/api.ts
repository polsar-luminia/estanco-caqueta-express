import * as SecureStore from "expo-secure-store";
import { API_URL } from "../constants/config";

const TOKEN_KEY = "auth_token";

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function removeToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export async function apiFetch<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    await removeToken();
    throw new Error("UNAUTHORIZED");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Error ${res.status}`);
  }

  return res.json();
}

// --- Auth ---

export async function loginCliente(telefono: string, password: string) {
  return apiFetch<{ token: string; cliente: Cliente }>("/clientes/login", {
    method: "POST",
    body: JSON.stringify({ telefono, password }),
  });
}

export async function registrarCliente(
  telefono: string,
  nombre: string,
  password: string
) {
  return apiFetch<{ token: string; cliente: Cliente }>("/clientes/registrar", {
    method: "POST",
    body: JSON.stringify({ telefono, nombre, password }),
  });
}

export async function getPerfil() {
  return apiFetch<Cliente>("/clientes/perfil");
}

export async function updatePerfil(data: Partial<Cliente>) {
  return apiFetch<Cliente>("/clientes/perfil", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function registrarPushToken(token: string, plataforma: string) {
  return apiFetch("/clientes/push-token", {
    method: "POST",
    body: JSON.stringify({ token, plataforma }),
  });
}

// --- Catalogo ---

export async function getProductos(params: {
  categoria?: number;
  buscar?: string;
  pagina?: number;
  limite?: number;
}) {
  const qs = new URLSearchParams();
  if (params.categoria) qs.set("categoria", String(params.categoria));
  if (params.buscar) qs.set("buscar", params.buscar);
  if (params.pagina) qs.set("pagina", String(params.pagina));
  if (params.limite) qs.set("limite", String(params.limite));
  return apiFetch<{ productos: Producto[]; total: number; paginas: number }>(
    `/catalogo/productos?${qs}`
  );
}

export async function getProducto(id: number) {
  return apiFetch<Producto>(`/catalogo/productos/${id}`);
}

export async function getCategorias() {
  return apiFetch<Categoria[]>("/catalogo/categorias");
}

export async function getDestacados() {
  return apiFetch<Producto[]>("/catalogo/destacados");
}

export async function buscarProductos(q: string) {
  return apiFetch<Producto[]>(`/catalogo/buscar?q=${encodeURIComponent(q)}`);
}

// --- Pedidos ---

export async function crearPedido(pedido: CrearPedidoInput) {
  return apiFetch<{ pedido: Pedido }>("/pedidos", {
    method: "POST",
    body: JSON.stringify(pedido),
  });
}

export async function getPedidos() {
  return apiFetch<Pedido[]>("/pedidos");
}

export async function getPedido(id: number) {
  return apiFetch<Pedido>(`/pedidos/${id}`);
}

export async function cancelarPedido(id: number) {
  return apiFetch(`/pedidos/${id}/cancelar`, { method: "PUT" });
}

// --- Patrocinados ---

export async function getPatrocinados() {
  return apiFetch<Patrocinado[]>("/patrocinados");
}

// --- Tipos ---

export interface Cliente {
  id: number;
  telefono: string;
  nombre: string;
  email?: string;
  direccion?: string;
  barrio?: string;
  notas_direccion?: string;
}

export interface Producto {
  id: number;
  nombre: string;
  codigo?: string;
  imagen_url?: string;
  precio_app: number;
  descripcion?: string;
  categoria: string;
  categoria_id?: number;
  stock_total: number;
}

export interface Categoria {
  id: number;
  nombre: string;
  cantidad_productos: number;
}

export interface Pedido {
  id: number;
  estado: "recibido" | "en_preparacion" | "en_camino" | "entregado" | "cancelado";
  direccion: string;
  barrio?: string;
  notas_cliente?: string;
  subtotal: number;
  total: number;
  created_at: string;
  preparado_at?: string;
  despachado_at?: string;
  entregado_at?: string;
  lineas: LineaPedido[];
}

export interface LineaPedido {
  id: number;
  nombre_producto: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
}

export interface CrearPedidoInput {
  direccion: string;
  barrio?: string;
  notas_cliente?: string;
  lineas: { producto_id: number; cantidad: number }[];
}

export interface Patrocinado {
  id: number;
  producto_id?: number;
  tipo: "banner" | "carousel" | "destacado";
  titulo?: string;
  imagen_url?: string;
  producto?: Producto;
}
