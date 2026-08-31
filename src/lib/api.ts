import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { API_URL } from "../constants/config";
import { APP_VERSION } from "./appVersion";

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

export type ApiFetchOptions = RequestInit & { idempotencyKey?: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- default any para callers que no especifican generic; los callers tipados pasan <T> explícito
export async function apiFetch<T = any>(
  path: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const { idempotencyKey, ...rest } = options;
  const token = await getToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    // Apple §1.4.3 — el backend filtra categorías de tabaco/vape cuando
    // el header indica ios. Es defensa server-side; el frontend tiene su
    // propio filtro defensivo en src/lib/iosFilters.ts.
    "X-Platform": Platform.OS,
    // Versión del binario. El servidor la usa para no cobrarle a un cliente algo
    // que su versión no sabe mostrar: 1.1.5 sigue vivo en las tiendas y pinta el
    // envío con el costo global, así que el servidor le cobra el global aunque la
    // zona tenga tarifa propia. La ausencia del header significa "app vieja".
    ...(APP_VERSION ? { "X-App-Version": APP_VERSION } : {}),
    ...(rest.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // M-CART-15: idempotency key opcional para POST /pedidos (y futuros endpoints)
  if (idempotencyKey) {
    headers["Idempotency-Key"] = idempotencyKey;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...rest,
      headers,
      signal: controller.signal,
    });
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Sin conexión, intenta de nuevo');
    }
    throw err;
  }
  clearTimeout(timeoutId);

  if (res.status === 401) {
    // Los 401 de endpoints de autenticación (login/registro/reset) NO deben
    // disparar el logout global: son "credenciales inválidas", no "sesión caída".
    // Sin este guard, un login fallido corre runLogoutHandlers() y BORRA el
    // carrito del invitado en el paso más caliente del funnel (M-AUTH-16).
    // Solo invalidamos si la request iba autenticada (llevaba token) a un
    // endpoint protegido.
    const esEndpointAuth = /^\/clientes\/(login|registrar|reset-password)/.test(path);
    if (token && !esEndpointAuth) {
      await removeToken();
      _onUnauthorized?.();
    }
    let errorMsg = "UNAUTHORIZED";
    try {
      const body401 = await res.json() as Record<string, unknown>;
      const e401 = typeof body401.error === 'string' ? body401.error : null;
      const ERRORES_401: Record<string, string> = {
        'Credenciales invalidas': 'Teléfono o contraseña incorrectos',
        'Token requerido': 'Sesión inválida, vuelve a iniciar sesión',
        'Cliente no encontrado': 'No encontramos tu cuenta',
      };
      if (e401) errorMsg = ERRORES_401[e401] ?? e401;
    } catch { /* body no-parseable, mantener fallback */ }
    throw new Error(errorMsg);
  }

  if (!res.ok) {
    let body: Record<string, unknown> = {};
    let bodyParsed = false;
    try {
      body = await res.json();
      bodyParsed = true;
    } catch {
      // Body no es JSON (HTML de error, texto plano, o vacío). Loguea para debug.
      if (__DEV__) console.warn(`[apiFetch] ${res.status} ${path} — body no-JSON`);
    }
    const ERRORES_USUARIO: Record<string, string> = {
      'telefono already exists': 'Este teléfono ya está registrado',
      'Ya existe una cuenta con ese telefono': 'Este teléfono ya está registrado',
      'Teléfono inválido': 'Teléfono inválido',
      'Telefono invalido': 'Teléfono inválido',
      'Nombre inválido': 'Nombre inválido',
      'Contraseña muy corta (mín 8)': 'Contraseña muy corta (mínimo 8 caracteres)',
      'La contrasena debe tener al menos 8 caracteres': 'La contraseña debe tener al menos 8 caracteres',
      'Fecha de nacimiento inválida': 'Fecha de nacimiento inválida',
      'Debes ser mayor de 18 años': 'Debes tener 18 años o más',
      'Cantidad inválida': 'Cantidad inválida en el pedido',
      'Cupón no válido': 'Cupón no válido',
      'Stock insuficiente': 'Producto sin stock suficiente',
      'Telefono y contrasena requeridos': 'Ingresa tu teléfono y contraseña',
      'Telefono, nombre y contrasena requeridos': 'Completa todos los campos',
      'Demasiados intentos fallidos, intente de nuevo en 15 minutos': 'Demasiados intentos. Intenta de nuevo en 15 minutos',
      'Direccion requerida': 'Dirección requerida',
      'Direccion no encontrada': 'Dirección no encontrada',
      'confirmado debe ser true': 'Debes confirmar para continuar',
      'Este número no está registrado.': 'Este número no está registrado.',
      'Espera 1 minuto antes de pedir otro código.': 'Espera un minuto antes de pedir otro código.',
      'Código inválido o expirado': 'Código inválido o expirado',
      'La contraseña debe tener al menos 8 caracteres': 'La contraseña debe tener al menos 8 caracteres',
    };
    let msg: string;
    const errorField = bodyParsed && typeof body.error === 'string' ? body.error : undefined;
    // El backend puede marcar un error como `mostrable: true` cuando el mensaje es
    // seguro y dinámico (ej. "solo puedes llevar 2 unidades de X", "solo hay 3
    // disponibles"). Esos no caben en una whitelist fija, así que se muestran tal cual.
    const mostrable = bodyParsed && body.mostrable === true;
    // Fail-closed: fuera de eso, solo se muestran los mensajes whitelisteados.
    // Cualquier otro body.error se loguea para debug pero se enmascara con un fallback
    // genérico por status code (evita filtrar internals del backend al cliente).
    if (errorField && mostrable) {
      msg = errorField;
    } else if (errorField && ERRORES_USUARIO[errorField]) {
      msg = ERRORES_USUARIO[errorField];
    } else if (res.status === 404) {
      msg = 'Servicio no disponible (404)';
    } else if (res.status >= 500) {
      msg = 'Error del servidor, intenta de nuevo';
    } else if (res.status === 403) {
      msg = 'No tienes permiso para hacer esto';
    } else if (res.status === 429) {
      // EL CASO QUE PRODUCIA LA CADENA `Error 429`, literal, en la pantalla.
      // La whitelist de arriba tenia el copy VIEJO del backend y el backend
      // hacia rato mandaba otro; no coincidian, el body no traia `mostrable`, y
      // 429 no caia en ninguna rama especial: terminaba en el `else`. 33 eventos
      // de produccion registran exactamente eso — sin explicacion, sin tiempo de
      // espera y sin salida, y con el canje del codigo de recuperacion tambien
      // bloqueado.
      //
      // Esta rama va por STATUS, que no puede desincronizarse de ningun copy, y
      // el `retry-after` que ya venia en la cabecera y se tiraba a la basura
      // convierte un "espera" sin numero en una espera con final.
      const espera = Number(res.headers?.get?.('retry-after'));
      const minutos = Number.isFinite(espera) && espera > 0 ? Math.ceil(espera / 60) : null;
      msg = minutos
        ? `Demasiados intentos. Espera ${minutos} minuto${minutos === 1 ? '' : 's'} o toca «¿Olvidaste tu contraseña?».`
        : 'Demasiados intentos. Espera unos minutos o toca «¿Olvidaste tu contraseña?».';
    } else {
      msg = `Error ${res.status}`;
    }
    if (__DEV__ && errorField && !ERRORES_USUARIO[errorField]) {
      console.warn(`[apiFetch] body.error sin whitelist → enmascarado. status=${res.status} path=${path} error="${errorField}"`);
    }
    // El status viaja en el error (aditivo: quien solo lee .message no cambia).
    // Es lo que permite distinguir un bloqueo (429/423) de una credencial mala
    // sin regex sobre el texto — que es como se venian identificando y por eso
    // la metrica se rompia con cada cambio de copy.
    const apiError = new Error(msg) as ApiError;
    apiError.status = res.status;
    if (bodyParsed) apiError.body = body;
    const retry = Number(res.headers?.get?.('retry-after'));
    if (Number.isFinite(retry) && retry > 0) apiError.retryAfter = retry;
    throw apiError;
  }

  return res.json();
}

// --- Auth ---

/** Error de apiFetch con el status HTTP y el body original adjuntos. */
export type ApiError = Error & {
  status?: number;
  body?: { error?: string } & Record<string, unknown>;
  /** Segundos de espera del header `retry-after`, cuando el servidor lo manda (429). */
  retryAfter?: number;
};

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
  acepta_mercadeo: boolean,
) {
  return apiFetch<{ token: string; cliente: Cliente }>("/clientes/registrar", {
    method: "POST",
    body: JSON.stringify({ telefono, nombre, password, fecha_nacimiento, acepta_mercadeo }),
  });
}

export interface ConsentimientoVigente {
  otorgado: boolean;
  fecha: string;
  version: string;
  origen: string;
}

/**
 * Estado vigente. Una finalidad AUSENTE no es lo mismo que revocada: significa que
 * nunca se le pregunto — el caso de los clientes anteriores a esta pantalla. La UI
 * tiene que distinguirlo para pedir la autorizacion en vez de asumir un no.
 */
export async function getConsentimiento() {
  return apiFetch<{
    consentimiento: {
      mercadeo?: ConsentimientoVigente;
      tratamiento_datos?: ConsentimientoVigente;
    };
    versiones: Record<string, string>;
  }>("/clientes/me/consentimiento");
}

export async function actualizarConsentimientoMercadeo(mercadeo: boolean) {
  return apiFetch<{ ok: true; mercadeo: boolean }>("/clientes/me/consentimiento", {
    method: "PUT",
    body: JSON.stringify({ mercadeo }),
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

export async function eliminarPushToken() {
  return apiFetch("/clientes/push-token", { method: "DELETE" });
}

export async function logoutCliente() {
  return apiFetch<{ ok: true }>("/clientes/logout", { method: "POST" });
}

// Apple App Store §5.1.1(v) — eliminación in-app de la cuenta.
// El backend anonimiza/elimina los datos del cliente y revoca todas sus sesiones.
// Devuelve 204 No Content; cualquier 4xx/5xx se mapea a Error en apiFetch.
export async function eliminarCuenta(confirmacion: string) {
  return apiFetch<{ ok: true }>("/clientes/me", {
    method: "DELETE",
    body: JSON.stringify({ confirmacion }),
  });
}

// Apple App Store §1.4.3 — confirmación explícita de mayoría de edad.
// El backend exige `{ confirmado: true }`; cualquier otra cosa es 400.
export async function confirmarEdad() {
  return apiFetch<{ ok: true; edad_confirmada: true; edad_confirmada_at: string }>(
    "/clientes/me/confirmar-edad",
    { method: "POST", body: JSON.stringify({ confirmado: true }) }
  );
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

export async function buscarProductos(
  q: string,
  opts: { pagina?: number; limite?: number } = {},
) {
  const qs = new URLSearchParams({ q });
  if (opts.pagina != null) qs.set("pagina", String(opts.pagina));
  if (opts.limite != null) qs.set("limite", String(opts.limite));
  return apiFetch<{ productos: Producto[]; total: number; paginas: number }>(
    `/catalogo/buscar?${qs}`,
  );
}

// --- Pedidos ---

export async function crearPedido(pedido: CrearPedidoInput, idempotencyKey?: string) {
  return apiFetch<{ pedido: Pedido; puntos_ganados: number; puntos_usados: number; envio: number; descuento: number }>("/pedidos", {
    method: "POST",
    body: JSON.stringify(pedido),
    idempotencyKey,
  });
}

// --- Tiempo estimado (bloque D) ---

// Cuánto se demoraría un pedido hecho AHORA. Devuelve null mientras la bandera
// `eta_visible_cliente` esté apagada, que es como sale 1.2.0: el motor calcula y
// guarda desde el día uno, pero no promete nada hasta que haya cumplimiento medido.
export async function getEtaActual(lat?: number | null, lng?: number | null) {
  const qs = lat != null && lng != null
    ? `?${new URLSearchParams({ lat: String(lat), lng: String(lng) })}`
    : "";
  const r = await apiFetch<{ eta: { min: number; max: number } | null }>(`/pedidos/eta${qs}`);
  return r.eta;
}

// --- Reseñas (bloque C) ---

export interface Resena {
  id: number;
  estrellas: number;
  comentario: string | null;
  created_at: string;
}

// Devuelve null si el cliente todavía no ha calificado ese pedido. No calificar
// no es un error, así que el backend responde 200 con null.
export async function getResena(pedidoId: number) {
  return apiFetch<Resena | null>(`/pedidos/${pedidoId}/resena`);
}

export async function crearResena(pedidoId: number, estrellas: number, comentario?: string) {
  return apiFetch<Resena>(`/pedidos/${pedidoId}/resena`, {
    method: "POST",
    body: JSON.stringify({ estrellas, comentario: comentario?.trim() || undefined }),
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

// --- Ofertas ---

export async function getOfertas() {
  return apiFetch<Oferta[]>("/ofertas");
}

// --- Interstitiales ---

export interface Interstitial {
  id: number;
  imagen_url: string;
  duracion_segundos: number;
}

export async function getInterstitial(): Promise<Interstitial | null> {
  try {
    const list = await apiFetch<Interstitial[]>("/interstitiales");
    return list[0] ?? null;
  } catch {
    return null;
  }
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
  // Apple App Store §1.4.3 — confirmación explícita de mayoría de edad (18+ COL)
  edad_confirmada?: boolean;
  edad_confirmada_at?: string | null;
}

export interface Producto {
  id: number;
  nombre: string;
  codigo?: string;
  imagen_url?: string;
  precio_app: number;
  // Precio efectivo con oferta/combo activo aplicado, calculado server-side.
  // El carrito y el checkout deben usar ESTE, no precio_app, para no revertir
  // el precio de oferta (M-CART-19). Opcional: fallback a precio_app si el
  // backend aún no lo expone.
  precio_vigente?: number;
  precio_lista1?: number;
  descripcion?: string;
  categoria: string;
  categoria_id?: number;
  stock_total: number;
  // Máximo de unidades por cliente. Es atributo del producto: aplica SIEMPRE que
  // esté configurado, haya o no oferta activa.
  max_unidades_por_cliente?: number | null;
  // Ventana móvil (días) sobre la que se acumula el máximo. Llega junto al tope.
  limite_ventana_dias?: number | null;
  // Consumo del cliente en la ventana. Solo llegan con sesión iniciada (el detalle
  // de producto usa auth opcional); anónimo llegan undefined y solo se muestra la regla.
  limite_ya_comprado?: number | null;
  limite_disponible?: number | null;
  // ISO. Solo viene cuando limite_disponible === 0: cuándo se le libera cupo.
  limite_disponible_desde?: string | null;
  badge?: string;
  // Badge editable desde DB/admin (solo lo trae /catalogo/destacados).
  badge_texto?: string | null;
  badge_color?: string | null;
}

export interface Categoria {
  id: number;
  nombre: string;
  imagen_url?: string;
  cantidad_productos: number;
}

export interface Pedido {
  id: number;
  /**
   * Número secuencial de pedido del cliente (1, 2, 3...). Calculado en backend.
   * Para mostrar al usuario. `id` es el ID global de la tabla y debe usarse solo
   * para tracking interno, deep links y referencia con soporte.
   */
  numero_orden_cliente?: number;
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
  // Frío asegurado. `frio_removido` = no alcanzó a estar frío y no se cobró.
  frio?: boolean;
  frio_costo?: number;
  frio_removido?: boolean;
  // Foto que tomó el domiciliario al entregar (bloque B). Solo la ve el dueño del
  // pedido: el endpoint filtra por cliente_id.
  foto_entrega_url?: string | null;
  // Solo en el listado (bloque C): alimenta el banner de "califica tu pedido" sin
  // tener que pedir la reseña de cada pedido por separado.
  tiene_resena?: boolean;
  // Tiempo estimado ya resuelto por el servidor (bloque D): trae el override del
  // staff si existe, y llega en null cuando la bandera está apagada. La app nunca
  // ve los campos crudos, así que no puede saltarse la bandera pintándolos.
  eta?: { min: number; max: number; override: boolean } | null;
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
  // Snapshot de ubicación opcional (Fase 1): llegan juntos lat/lng o ninguno.
  lat?: number;
  lng?: number;
  precision_m?: number | null;
  metodo_ubicacion?: Exclude<MetodoUbicacion, "manual">;
  geocoded_direccion?: string | null;
  // Frío asegurado (bloque H): solo la INTENCIÓN. El servidor recalcula la
  // elegibilidad y el precio desde la base — el cliente nunca manda el monto.
  quiere_frio?: boolean;
}

// --- Cupones ---

export interface CuponValidado {
  valido: boolean;
  cupon: {
    id: number;
    codigo: string;
    descripcion: string;
    // 'envio_gratis' viene del backend (cupones.js) y trae descuento 0: lo que
    // regala es el envío, no mercancía. Faltaba en el tipo, así que el carrito
    // mostraba envío cobrado en un pedido que el servidor cobraba sin él.
    tipo: 'porcentaje' | 'fijo' | 'envio_gratis';
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

// --- Geolocalización (Fase 1) ---

export type MetodoUbicacion = "manual" | "gps" | "pin_mapa";

// Ubicación capturada en la app (GPS en Fase 1). El servidor calcula `fuera_zona`;
// el cliente NUNCA lo envía. Ver PLAN-GEOLOCALIZACION.md §2.1, §4.
export interface UbicacionCapturada {
  lat: number;
  lng: number;
  precision_m: number | null; // accuracy GPS en metros; null si método = 'pin_mapa'
  metodo_ubicacion: Exclude<MetodoUbicacion, "manual">; // 'gps' | 'pin_mapa'
  geocoded_direccion: string | null; // reverse geocode, solo prellenado/display
}

export interface DireccionGuardada {
  id: number;
  etiqueta: string;
  direccion: string;
  barrio?: string;
  barrio_id?: number;
  notas?: string;
  predeterminada: boolean;
  // Campos de ubicación (Fase 1). Direcciones viejas: lat/lng null, método 'manual'.
  lat?: number | null;
  lng?: number | null;
  precision_m?: number | null;
  metodo_ubicacion?: MetodoUbicacion;
  geocoded_direccion?: string | null;
  fuera_zona?: boolean | null;
}

export async function getDirecciones() {
  return apiFetch<DireccionGuardada[]>("/clientes/direcciones");
}

export interface CrearDireccionInput {
  etiqueta?: string;
  direccion: string;
  barrio?: string;
  barrio_id?: number;
  notas?: string;
  predeterminada?: boolean;
  // Ubicación opcional (Fase 1): llegan juntos lat/lng o ninguno.
  lat?: number;
  lng?: number;
  precision_m?: number | null;
  metodo_ubicacion?: Exclude<MetodoUbicacion, "manual">;
  geocoded_direccion?: string | null;
  // Frío asegurado (bloque H): solo la INTENCIÓN. El servidor recalcula la
  // elegibilidad y el precio desde la base — el cliente nunca manda el monto.
  quiere_frio?: boolean;
}

export async function crearDireccion(data: CrearDireccionInput, idempotencyKey?: string) {
  return apiFetch<DireccionGuardada>("/clientes/direcciones", {
    method: "POST",
    body: JSON.stringify(data),
    idempotencyKey,
  });
}

export interface CoberturaResponse {
  dentro: boolean;
  zona: string | null;
  // Tarifa de la zona. null = usar el envio_costo global de configuración.
  // Ojo: null NO es envío gratis. Los servidores viejos no mandan estos campos.
  costo_envio?: number | null;
  tiempo_viaje_min?: number | null;
}

// GET /cobertura?lat=&lng= — el servidor decide si el punto está dentro de la zona
// y con qué tarifa. El carrito lo consulta para mostrar el mismo envío que se cobra.
export async function validarCobertura(lat: number, lng: number) {
  const qs = new URLSearchParams({ lat: String(lat), lng: String(lng) });
  return apiFetch<CoberturaResponse>(`/cobertura?${qs}`);
}

// Punto del polígono como [lat, lng].
export type PuntoZona = [number, number];

export interface ZonaMapa {
  id: number;
  nombre: string;
  poligono: PuntoZona[];
  // 'excluida' = zona donde NO se reparte; gana sobre cualquier incluida.
  tipo: 'incluida' | 'excluida';
  color?: string | null;
}

export interface ZonaCobertura {
  // Forma histórica (una sola zona), que el servidor mantiene para las apps 1.1.x.
  nombre: string;
  poligono: PuntoZona[];
  // Desde 1.2.0: todas las zonas, incluidas las exclusiones.
  zonas?: ZonaMapa[];
}

// GET /cobertura/zona — polígonos de reparto para validar en el mapa (Fase 2).
export async function getCoberturaZona() {
  return apiFetch<ZonaCobertura>("/cobertura/zona");
}

// Validación optimista contra TODAS las zonas, con el mismo orden de reglas que el
// servidor: una exclusión gana siempre. Si el servidor es viejo y no manda `zonas`,
// cae al polígono único de antes. El servidor sigue siendo la autoridad al guardar.
export function evaluarZonasCliente(lat: number, lng: number, zona: ZonaCobertura | undefined): boolean {
  if (!zona) return true;
  const zonas = zona.zonas;
  if (Array.isArray(zonas) && zonas.length > 0) {
    const excluidas = zonas.filter((z) => z.tipo === 'excluida');
    if (excluidas.some((z) => puntoEnZona(lat, lng, z.poligono))) return false;
    const incluidas = zonas.filter((z) => z.tipo !== 'excluida');
    // Sin incluidas dibujadas no hay nada contra qué validar: se deja pasar y
    // decide el servidor, igual que hace él con su bounding box.
    if (incluidas.length === 0) return true;
    return incluidas.some((z) => puntoEnZona(lat, lng, z.poligono));
  }
  if (!Array.isArray(zona.poligono) || zona.poligono.length < 3) return true;
  return puntoEnZona(lat, lng, zona.poligono);
}

// Point-in-polygon (ray-casting) para feedback instantáneo en el mapa. El
// servidor sigue siendo la autoridad al guardar. Mismo algoritmo que el backend.
export function puntoEnZona(lat: number, lng: number, poligono: PuntoZona[]): boolean {
  if (!Array.isArray(poligono) || poligono.length < 3) return false;
  let dentro = false;
  for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) {
    const yi = poligono[i][0], xi = poligono[i][1];
    const yj = poligono[j][0], xj = poligono[j][1];
    const cruza = (yi > lat) !== (yj > lat) &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (cruza) dentro = !dentro;
  }
  return dentro;
}

// --- Helpers puros de ubicación (usados por la UI y testeados) ---

// iOS/Android pueden dar precisión reducida; a partir de este umbral avisamos.
export const PRECISION_APROXIMADA_M = 50;

/** Texto de precisión para mostrar al usuario, p.ej. "±12 m". null si no hay dato. */
export function formatoPrecision(precision_m?: number | null): string | null {
  if (precision_m == null || !Number.isFinite(precision_m) || precision_m < 0) return null;
  return `±${Math.round(precision_m)} m`;
}

/** true si la captura es imprecisa (precisión reducida) y conviene avisar. */
export function esUbicacionAproximada(precision_m?: number | null): boolean {
  return precision_m != null && Number.isFinite(precision_m) && precision_m > PRECISION_APROXIMADA_M;
}

/**
 * Extrae los campos de ubicación para el body de crearDireccion/crearPedido.
 * Devuelve {} si no hay ubicación válida (→ dirección manual, comportamiento 1.0.x).
 * Nunca incluye `fuera_zona` (autoridad del servidor).
 */
export function ubicacionABody(u: UbicacionCapturada | null | undefined): {
  lat?: number;
  lng?: number;
  precision_m?: number | null;
  metodo_ubicacion?: Exclude<MetodoUbicacion, "manual">;
  geocoded_direccion?: string | null;
  // Frío asegurado (bloque H): solo la INTENCIÓN. El servidor recalcula la
  // elegibilidad y el precio desde la base — el cliente nunca manda el monto.
  quiere_frio?: boolean;
} {
  if (!u || !Number.isFinite(u.lat) || !Number.isFinite(u.lng)) return {};
  return {
    lat: u.lat,
    lng: u.lng,
    precision_m: u.precision_m ?? null,
    metodo_ubicacion: u.metodo_ubicacion,
    geocoded_direccion: u.geocoded_direccion ?? null,
  };
}

// Editar dirección (Fase 2): actualiza campos presentes. Si incluye lat/lng,
// el servidor recalcula fuera_zona. Para editar el pin: { lat, lng, metodo_ubicacion, ... }.
export async function editarDireccion(id: number, data: Partial<CrearDireccionInput>) {
  return apiFetch<DireccionGuardada>(`/clientes/direcciones/${id}`, {
    method: "PUT",
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

export interface Oferta {
  id: number;
  producto_id: number;
  tipo: "oferta" | "oferta_relampago" | "imperdible" | "promocion" | "irresistible";
  titulo: string | null;
  precio_oferta: number | null;
  precio_anterior?: number | null;
  orden: number;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
  producto: Producto;
}


// Tipos de aviso de cierre. El backend elige el tipo; el app lo mapea a
// color/ícono. Retrocompatible: builds viejos ignoran `aviso` y usan el banner
// genérico con `proximaApertura`.
export type AvisoTipo = "fuera_horario" | "general" | "ley_seca" | "almuerzo";

export interface AvisoTienda {
  tipo: AvisoTipo;
  titulo: string;
  mensaje: string;
}

/** Fila del horario semanal, ya agrupada y formateada por el backend. */
export interface HorarioFila {
  /** "Lun – Jue", "Sáb", ... */
  dias: string;
  /** Una entrada por franja: ["7:00 am – 12:00 pm", "2:00 pm – 7:00 pm"]. */
  horas: string[];
}

export interface EstadoTienda {
  abierta: boolean;
  proximaApertura: string;
  aviso?: AvisoTienda | null;
  /**
   * Horario configurado desde el admin. Opcional porque un backend viejo no lo
   * manda; en ese caso la app cae a su tabla quemada.
   */
  horario?: HorarioFila[] | null;
}

export async function getEstadoTienda(): Promise<EstadoTienda> {
  return apiFetch<EstadoTienda>("/tienda/estado");
}

export interface ConfigApp {
  envio_gratis_minimo: number;
  envio_costo: number;
  pedido_minimo: number;
  limite_ventana_dias?: number;
  // Frío asegurado (bloque H). Nacen apagadas y se prenden desde el servidor.
  frio_activo?: boolean;
  frio_costo?: number;
  frio_recordatorio_activo?: boolean;
  frio_imagen_url?: string | null;
  // Motor de ETA (bloque D) y ubicación obligatoria (bloque F). Ambas nacen
  // apagadas y se prenden desde el servidor, de a una.
  eta_visible_cliente?: boolean;
  exigir_ubicacion?: boolean;
  // Bloqueo de versión (bloque G). '1.0.0' = dormido: toda versión lo cumple.
  version_minima?: string;
  version_minima_mensaje?: string;
}

export async function getConfigApp(): Promise<ConfigApp> {
  return apiFetch('/configuracion-app');
}

// POST /catalogo/frio — qué productos del carrito pueden ir fríos.
//
// Existe un endpoint porque CartItem no guarda la categoría (y los carritos ya
// persistidos en los teléfonos tampoco la tendrían): la app no puede resolver la
// elegibilidad sola. Que la resuelva el servidor evita además tener la misma
// regla escrita en dos lados.
export interface FrioCarrito {
  activo: boolean;
  costo: number;
  elegibles: number[];
}

export async function getFrioCarrito(productoIds: number[]): Promise<FrioCarrito> {
  return apiFetch<FrioCarrito>("/catalogo/frio", {
    method: "POST",
    body: JSON.stringify({ producto_ids: productoIds }),
  });
}

// Cupo restante del cliente para los productos con máximo por cliente. Existe porque
// los listados (inicio, buscar, categoría, ofertas) exponen el tope pero no el consumo:
// sin esto, un cliente que ya agotó su cupo podía agregar igual desde una card y solo
// se enteraba del rechazo al pagar. La ficha sigue siendo la fuente detallada.
export interface LimiteCliente {
  producto_id: number;
  max: number;
  ya_comprado: number;
  disponible: number;
}

export async function getMisLimites(): Promise<LimiteCliente[]> {
  const res = await apiFetch<{ limites: LimiteCliente[] }>("/catalogo/mis-limites");
  return res.limites ?? [];
}

export interface Combo {
  id: number;
  producto_id: number;
  nombre: string;
  descripcion?: string | null;
  imagen_url?: string | null;
  precio_combo: number;
  precio_original?: number | null;
  orden: number;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
  // Producto principal del combo (FK joined). En la app, mostramos `producto.imagen_url`,
  // `producto.categoria` y agregamos al carrito con `precio_combo`.
  producto: Producto | null;
}

export async function getCombos(): Promise<Combo[]> {
  return apiFetch('/combos');
}
