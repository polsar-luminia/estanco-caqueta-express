import * as SecureStore from "expo-secure-store";
import { API_URL } from "../constants/config";

const TOKEN_KEY = "auth_token";

// Callback registrado por auth.ts para resetear el store sin dep circular
let _onUnauthorized: (() => void) | null = null;
export function registerUnauthorizedHandler(fn: () => void) {
  _onUnauthorized = fn;
}

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

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    });
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err?.name === 'AbortError') {
      throw new Error('Sin conexión, intenta de nuevo');
    }
    throw err;
  }
  clearTimeout(timeoutId);

  if (res.status === 401) {
    await removeToken();
    _onUnauthorized?.();
    throw new Error("UNAUTHORIZED");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const ERRORES_USUARIO: Record<string, string> = {
      'telefono already exists': 'Este teléfono ya está registrado',
      'Teléfono inválido': 'Teléfono inválido',
      'Nombre inválido': 'Nombre inválido',
      'Contraseña muy corta (mín 8)': 'Contraseña muy corta (mínimo 8 caracteres)',
      'Fecha de nacimiento inválida': 'Fecha de nacimiento inválida',
      'Debes ser mayor de 18 años': 'Debes tener 18 años o más',
      'Cantidad inválida': 'Cantidad inválida en el pedido',
      'Cupón no válido': 'Cupón no válido',
      'Stock insuficiente': 'Producto sin stock suficiente',
    };
    const msg = ERRORES_USUARIO[body.error] ?? (res.status >= 500 ? 'Error del servidor, intenta de nuevo' : (body.error || `Error ${res.status}`));
    throw new Error(msg);
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
  password: string,
  fecha_nacimiento: string,
) {
  return apiFetch<{ token: string; cliente: Cliente }>("/clientes/registrar", {
    method: "POST",
    body: JSON.stringify({ telefono, nombre, password, fecha_nacimiento }),
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
  if (params.categoria != null) qs.set("categoria", String(params.categoria));
  if (params.buscar) qs.set("buscar", params.buscar);
  if (params.pagina != null) qs.set("pagina", String(params.pagina));
  if (params.limite != null) qs.set("limite", String(params.limite));
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

export async function getSugerencias(productoId: number) {
  return apiFetch<Producto[]>(`/catalogo/sugerencias/${productoId}`);
}

export interface EventoInput {
  tipo: string;
  payload?: Record<string, unknown>;
  pantalla?: string;
}

export async function buscarProductos(q: string) {
  return apiFetch<Producto[]>(`/catalogo/buscar?q=${encodeURIComponent(q)}`);
}

// --- Pedidos ---

export async function crearPedido(pedido: CrearPedidoInput) {
  return apiFetch<{ pedido: Pedido; puntos_ganados: number; puntos_usados: number; envio: number; descuento: number }>("/pedidos", {
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

export async function getHeroModo(): Promise<"static" | "carousel"> {
  const data = await apiFetch<{ hero_modo: string }>("/patrocinados/config");
  return (data.hero_modo === "carousel" ? "carousel" : "static");
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
  puntos: number;
  codigo_referido?: string;
  ahorro_total?: number;
  total_pedidos?: number;
}

export interface Producto {
  id: number;
  nombre: string;
  codigo?: string;
  imagen_url?: string;
  precio_app: number;
  precio_lista1?: number;
  descripcion?: string;
  categoria: string;
  categoria_id?: number;
  stock_total: number;
  badge?: string;
}

export interface Categoria {
  id: number;
  nombre: string;
  imagen_url?: string;
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
  producto_id: number;
  nombre_producto: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
}

export interface CrearPedidoInput {
  direccion: string;
  barrio?: string;
  barrio_id?: number;
  notas_cliente?: string;
  usar_puntos?: boolean;
  cupon_codigo?: string;
  lineas: { producto_id: number; cantidad: number }[];
}

// --- Cupones ---

export interface CuponValidado {
  valido: boolean;
  cupon: {
    id: number;
    codigo: string;
    descripcion: string;
    tipo: 'porcentaje' | 'fijo';
    valor: number;
  };
  descuento: number;
}

export async function validarCupon(codigo: string, subtotal: number) {
  return apiFetch<CuponValidado>("/cupones/validar", {
    method: "POST",
    body: JSON.stringify({ codigo, subtotal }),
  });
}

export interface CuponDisponible {
  id: number;
  codigo: string;
  descripcion: string;
  tipo: 'porcentaje' | 'fijo';
  valor: number;
  min_pedido: number;
  expires_at: string | null;
  ya_usado: boolean;
}

export async function getCuponesDisponibles() {
  return apiFetch<CuponDisponible[]>("/cupones/disponibles");
}

export async function solicitarResetPassword(telefono: string) {
  return apiFetch<{ mensaje: string }>("/clientes/reset-password/solicitar", {
    method: "POST",
    body: JSON.stringify({ telefono }),
  });
}

export async function verificarResetPassword(telefono: string, codigo: string, nueva_password: string) {
  return apiFetch<{ mensaje: string }>("/clientes/reset-password/verificar", {
    method: "POST",
    body: JSON.stringify({ telefono, codigo, nueva_password }),
  });
}

export interface PuntosResponse {
  balance: number;
  movimientos: { tipo: string; puntos: number; descripcion: string; created_at: string }[];
}

export async function getPuntos() {
  return apiFetch<PuntosResponse>("/clientes/puntos");
}

// --- Direcciones ---

export interface DireccionGuardada {
  id: number;
  etiqueta: string;
  direccion: string;
  barrio?: string;
  barrio_id?: number;
  notas?: string;
  predeterminada: boolean;
}

export async function getDirecciones() {
  return apiFetch<DireccionGuardada[]>("/clientes/direcciones");
}

export async function crearDireccion(data: { etiqueta?: string; direccion: string; barrio?: string; barrio_id?: number; notas?: string; predeterminada?: boolean }) {
  return apiFetch<DireccionGuardada>("/clientes/direcciones", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function setPredeterminada(id: number) {
  return apiFetch<DireccionGuardada>(`/clientes/direcciones/${id}/predeterminada`, { method: "PUT" });
}

export async function eliminarDireccion(id: number) {
  return apiFetch(`/clientes/direcciones/${id}`, { method: "DELETE" });
}

// --- Barrios ---

export interface Barrio {
  id: number;
  nombre: string;
  comuna: string;
}

export async function getBarrios() {
  return apiFetch<Barrio[]>("/barrios");
}

export interface Patrocinado {
  id: number;
  producto_id?: number;
  tipo: "banner" | "oferta" | "oferta_relampago" | "promocion" | "imperdible" | "irresistible";
  titulo?: string;
  imagen_url?: string;
  producto?: Producto;
  activo?: boolean;
  fecha_inicio?: string;
  fecha_fin?: string;
}


export interface EstadoTienda {
  abierta: boolean;
  proximaApertura: string;
}

export async function getEstadoTienda(): Promise<EstadoTienda> {
  return apiFetch<EstadoTienda>("/tienda/estado");
}

export async function getConfigApp(): Promise<{ envio_gratis_minimo: number; envio_costo: number }> {
  return apiFetch('/configuracion-app');
}

export interface Combo {
  id: number;
  nombre: string;
  descripcion?: string;
  imagen_url?: string;
  precio_combo: number;
  precio_original?: number;
  productos: any[];
  activo: boolean;
  orden: number;
}

export async function getCombos(): Promise<Combo[]> {
  return apiFetch('/combos');
}
