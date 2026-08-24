import { useState, useRef, useEffect, useCallback } from "react";
import { View, Text, FlatList, TextInput, Pressable, KeyboardAvoidingView, Platform, AppState } from "react-native";
import { Image as ImagenExpo } from "expo-image";
import { useRouter, Redirect, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Sentry from "@sentry/react-native";
import { useQuery, useQueries, useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
import { Feather } from "@expo/vector-icons";
import Toast from "react-native-toast-message";
import { useCartStore } from "../../src/stores/cart";
import { useAuthStore } from "../../src/stores/auth";
import { useTiendaAbierta } from "../../src/hooks/useTiendaAbierta";
import { useTecladoVisible } from "../../src/hooks/useTecladoVisible";
import { crearPedido, getDirecciones, crearDireccion, editarDireccion, validarCupon, getConfigApp, getEstadoTienda, getProducto, ubicacionABody, validarCobertura, getFrioCarrito, getEtaActual, type DireccionGuardada, type CuponValidado, type UbicacionCapturada, type ApiError } from "../../src/lib/api";
import { useConfirmarUbicacion } from "../../src/hooks/useConfirmarUbicacion";
import { calcularResumen, envioDeZona } from "../../src/lib/resumenPedido";
import { FrioRecordatorio } from "../../src/components/FrioRecordatorio";
import { nuevoUuidV4 } from "../../src/lib/uuid";
import { tracker } from "../../src/lib/tracker";
import { metaLogInitiateCheckout, metaLogPurchase } from "../../src/lib/metaEvents";
import { CartIcon } from "../../src/components/icons/TabIcons";
import { formatCOP } from "../../src/lib/format";
import { CartItem } from "../../src/components/CartItem";
import { BandaOperativa } from "../../src/components/BandaOperativa";
import { BandaCerrado } from "../../src/components/BandaCerrado";
import { MEDIOS_PAGO_RESPALDO, ICONOS_MEDIO, ICONO_MEDIO_GENERICO } from "../../src/constants/config";
import { colors, shadows, fuentes } from "../../src/constants/theme";
import { FilaPedidoColapsado } from "../../src/components/checkout/FilaPedidoColapsado";
import { BloquePuntoEntrega } from "../../src/components/checkout/BloquePuntoEntrega";
import { FilaAccion } from "../../src/components/checkout/FilaAccion";
import { BloqueExtras } from "../../src/components/checkout/BloqueExtras";
import { ResumenTotales } from "../../src/components/checkout/ResumenTotales";
import { HojaDireccion } from "../../src/components/checkout/HojaDireccion";
import { HojaMedioPago } from "../../src/components/checkout/HojaMedioPago";
import { HojaNotas } from "../../src/components/checkout/HojaNotas";

function ChevronRightIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M9 18l6-6-6-6" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// Lo ya validado del pedido, para poder crearlo desde el carrito o desde los
// botones del recordatorio de frío sin repetir las validaciones.
interface DatosPedido {
  dirFinal: string;
  notFinal: string;
  ubicacionSnapshot: UbicacionCapturada | null;
}

// Borrador de dirección nueva, capturado al abrir la hoja para poder
// restaurarlo si se cierra sin comprometer ("Usar esta dirección"). Sin esto,
// editar dentro de la hoja y cerrar con el backdrop dejaría `mostrarNueva`
// (si ya era true) con campos a medias, y handlePedir intentaría crear una
// dirección invisible.
interface BorradorDireccion {
  direccion: string;
  notas: string;
  ubicacion: UbicacionCapturada | null;
  permitirSinPin: boolean;
}

// Modulo, no useRef: sobrevive a un REMOUNT del componente. 22 de 153 filas de
// carrito_abandonado (23-ago-2026) eran copias exactas en el mismo instante —
// mismo device, mismo payload, mismo created_at al microsegundo. Eso solo pasa
// si dos llamadas a tracker.track() caen en el mismo flush, y un useRef no lo
// evita si hay dos instancias del componente montadas a la vez (remount de
// pestaña, no solo background+blur del mismo montaje). La ventana de 5 s
// alcanza para cubrir ambos gatillos del mismo cierre sin suprimir un
// abandono real de una visita distinta.
let ultimoAbandonoReportado: { clave: string; en: number } | null = null;
const VENTANA_DEDUP_ABANDONO_MS = 5_000;

export default function CartScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const items = useCartStore((s) => s.items);
  const direccion = useCartStore((s) => s.direccion);
  const notas = useCartStore((s) => s.notas);
  const direccionId = useCartStore((s) => s.direccionId);
  const setDireccionId = useCartStore((s) => s.setDireccionId);
  // Selector inline (no metodo): los metodos del store no son reactivos a cambios de items
  const subtotalComputed = useCartStore((s) => s.items.reduce((sum, i) => sum + i.cantidad * i.precioUnitario, 0));
  const clear = useCartStore((s) => s.clear);
  const updatePrices = useCartStore((s) => s.updatePrices);
  const updateStocks = useCartStore((s) => s.updateStocks);
  const updateLimites = useCartStore((s) => s.updateLimites);
  const cliente = useAuthStore((s) => s.cliente);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isAuthLoading = useAuthStore((s) => s.isLoading);

  // Refetch precios al montar — detecta si cambiaron desde que se persistieron en AsyncStorage.
  // El backend cobra el precio actual (lineas sin precio), así que es sólo corrección visual.
  const productosCheck = useQueries({
    queries: items.map((i) => ({
      queryKey: ["producto", i.productoId] as const,
      queryFn: () => getProducto(i.productoId),
      staleTime: 0,
    })),
  });
  useEffect(() => {
    if (items.length === 0 || productosCheck.some((q) => q.isLoading)) return;
    const priceMap = new Map<number, number>();
    const stockMap = new Map<number, number>();
    const limitMap = new Map<number, number | null>();
    let huboCambioPrecio = false;
    let huboCambioStock = false;
    let huboCambioLimite = false;
    productosCheck.forEach((q, idx) => {
      if (q.data && items[idx]) {
        // M-CART-19: usar precio_vigente (con oferta aplicada) para no revertir
        // el precio de oferta al precio full. Fallback a precio_app si el backend
        // aún no expone el campo.
        // Number(): node-postgres devuelve los numeric como string ("19999.00"), y
        // comparar string vs number marcaría "cambió" en cada apertura del carrito.
        const nuevoPrecio = Number(q.data.precio_vigente ?? q.data.precio_app);
        const nuevoStock = Number(q.data.stock_total ?? 0);
        if (nuevoPrecio !== items[idx].precioUnitario) huboCambioPrecio = true;
        priceMap.set(items[idx].productoId, nuevoPrecio);
        const stockActual = items[idx].stockMaximo ?? Infinity;
        const cantidadActual = items[idx].cantidad;
        if (nuevoStock !== stockActual || nuevoStock < cantidadActual) huboCambioStock = true;
        stockMap.set(items[idx].productoId, nuevoStock);
        // Cupo por cliente: el refetch corre con sesión, así que trae limite_disponible.
        // Antes este dato llegaba y se botaba, y un carrito armado sin cap (p.ej. desde
        // Ofertas) nunca lo ganaba. null = el producto ya no tiene límite.
        const nuevoLimite = q.data.limite_disponible ?? q.data.max_unidades_por_cliente ?? null;
        if (nuevoLimite !== (items[idx].maxPorCliente ?? null)) huboCambioLimite = true;
        limitMap.set(items[idx].productoId, nuevoLimite);
      }
    });
    if (huboCambioPrecio) updatePrices(priceMap);
    if (huboCambioStock) updateStocks(stockMap);
    if (huboCambioLimite) updateLimites(limitMap);
    // Sin aviso. El carrito ya se refrescó solo y los precios y el stock que se ven
    // en pantalla son los nuevos: el toast no le pedía nada al cliente ni le
    // señalaba qué cambió, solo salía cada vez que se revalidaba —incluso al
    // agregar un producto, donde no había cambiado nada para el— y tapaba el
    // botón. Si algún dia hay que avisar de un cambio de precio, tiene que ser en
    // la linea del producto, no en una banda que se va sola.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productosCheck.map((q) => q.dataUpdatedAt).join(","), items.length]);
  const [loading, setLoading] = useState(false);
  const [usarPuntos, setUsarPuntos] = useState(false);
  const [mostrarNueva, setMostrarNueva] = useState(false);
  const [nuevaDireccion, setNuevaDireccion] = useState("");
  const [nuevasNotas, setNuevasNotas] = useState("");
  const [nuevaUbicacion, setNuevaUbicacion] = useState<UbicacionCapturada | null>(null);
  const [silenciadoDir, setSilenciadoDir] = useState(false);
  // Salida de "fuera de zona" del mapa (Direcciones 1.3.2): habilita usar la
  // dirección nueva sin pin SOLO para el texto con el que se concedió — ver
  // cambiarNuevaDireccion más abajo, que la revoca al reescribir.
  const [permitirSinPin, setPermitirSinPin] = useState(false);
  // Nota editada desde el carrito para una dirección GUARDADA. null = "usa la
  // de la dirección" — sin esto, las notas de una guardada no se podían tocar
  // desde el checkout (se mandaba dirActiva.notas a secas).
  const [notasOverride, setNotasOverride] = useState<string | null>(null);
  // Frío asegurado: intención del cliente. No se persiste entre sesiones.
  const [quiereFrio, setQuiereFrio] = useState(false);
  // Medio de pago (093). "efectivo" preseleccionado: es lo que la mayoría usa
  // hoy de facto, y garantiza que siempre haya un dato sin agregar un paso
  // obligatorio al checkout — que es donde vive el 90% de los abandonos.
  const [medioPago, setMedioPago] = useState("efectivo");
  const [mostrarRecordatorioFrio, setMostrarRecordatorioFrio] = useState(false);
  const [codigoCupon, setCodigoCupon] = useState("");
  const [cuponValidado, setCuponValidado] = useState<CuponValidado | null>(null);
  const [cuponError, setCuponError] = useState("");
  const [validandoCupon, setValidandoCupon] = useState(false);
  const [cuponAbierto, setCuponAbierto] = useState(false);
  const cuponSubtotalRef = useRef<number | null>(null);
  const queryClient = useQueryClient();

  // Checkout denso (1.3.2/build 94): "Tu pedido" colapsado por defecto —
  // los productos se ven al desplegar, no al abrir la tab.
  const [pedidoAbierto, setPedidoAbierto] = useState(false);
  const [hojaDireccionVisible, setHojaDireccionVisible] = useState(false);
  const [hojaDireccionModo, setHojaDireccionModo] = useState<"lista" | "nueva">("lista");
  const [hojaMedioPagoVisible, setHojaMedioPagoVisible] = useState(false);
  const [hojaNotasVisible, setHojaNotasVisible] = useState(false);
  const borradorDireccionRef = useRef<BorradorDireccion | null>(null);

  const tienda = useTiendaAbierta();
  const tecladoVisible = useTecladoVisible();

  const { data: configApp } = useQuery({
    queryKey: ['config-app'],
    queryFn: getConfigApp,
    staleTime: 5 * 60 * 1000,
  });

  // Precargar la pieza del recordatorio de frío APENAS se conoce su URL: la
  // tarjeta aparece en el momento más caliente del checkout y antes se veía un
  // recuadro azul vacío mientras bajaba la imagen. expo-image la deja en el
  // caché de disco y el modal abre con el arte ya pintado.
  useEffect(() => {
    if (configApp?.frio_imagen_url) {
      ImagenExpo.prefetch(configApp.frio_imagen_url).catch(() => {});
    }
  }, [configApp?.frio_imagen_url]);

  const { data: direcciones = [], refetch: refetchDirs } = useQuery({
    queryKey: ["direcciones"],
    queryFn: getDirecciones,
    enabled: isAuthenticated,
  });

  const dirPredeterminada = direcciones.find((d) => d.predeterminada) || direcciones[0];
  const dirSeleccionada = direccionId ? direcciones.find((d) => d.id === direccionId) ?? null : null;
  const dirActiva = dirSeleccionada || dirPredeterminada;

  // Síntesis de la dirección nueva en progreso, para que el bloque de punto de
  // entrega tenga algo que mostrar (mapa/CTA) mientras se llena el formulario
  // dentro de la hoja, sin esperar a que se guarde como DireccionGuardada real.
  const dirParaMostrar: DireccionGuardada | null = mostrarNueva
    ? {
        id: -1,
        etiqueta: "Nueva",
        direccion: nuevaDireccion.trim() || nuevaUbicacion?.geocoded_direccion || "Ubicación en el mapa",
        predeterminada: false,
        lat: nuevaUbicacion?.lat ?? null,
        lng: nuevaUbicacion?.lng ?? null,
      }
    : dirActiva ?? null;

  const notasEfectivas = notasOverride ?? dirActiva?.notas ?? notas.trim();
  const notasVisibles = mostrarNueva ? nuevasNotas : notasEfectivas;

  const subtotal = subtotalComputed;
  const puntos = cliente?.puntos || 0;
  // Umbral real de canje (090): antes esto y los otros dos "200" mas abajo
  // estaban quemados por separado del texto de profile.tsx, que a su vez
  // mostraba OTRO numero (100, de una barra de progreso que ni siquiera leia
  // esta config). Un solo valor, del servidor, en los tres sitios.
  const puntosParaEnvioGratis = configApp?.puntos_envio_gratis ?? 200;
  const puedeUsarPuntos = puntos >= puntosParaEnvioGratis;
  const envioGratisMinimo = configApp?.envio_gratis_minimo ?? 150000;
  const envioCostoGlobal = configApp?.envio_costo ?? 5000;
  const pedidoMinimo = configApp?.pedido_minimo ?? 30000;
  // Medio de pago (093). Nace apagada: sin la bandera, ni se renderiza la fila
  // ni se manda medio_pago/paga_con al crear el pedido — el carrito se
  // comporta byte a byte como antes de esta funcionalidad.
  const medioPagoActivo = configApp?.medio_pago_activo === true;
  const mediosPagoDisponibles = configApp?.medios_pago ?? MEDIOS_PAGO_RESPALDO;
  const medioActivoObj = mediosPagoDisponibles.find((m) => m.codigo === medioPago);
  const iconoMedioActivo = medioActivoObj ? (ICONOS_MEDIO[medioActivoObj.codigo] ?? ICONO_MEDIO_GENERICO) : ICONO_MEDIO_GENERICO;
  const subtituloMedioPago = medioActivoObj?.etiqueta;

  // Punto de entrega actual: el pin recién capturado o el de la dirección elegida.
  // Se calcula aquí (y no solo dentro de handlePedir) porque la tarifa por zona
  // tiene que verse ANTES de pedir, no descubrirse en el cobro.
  const puntoEntrega = mostrarNueva
    ? (nuevaUbicacion ? { lat: nuevaUbicacion.lat, lng: nuevaUbicacion.lng } : null)
    : (dirActiva?.lat != null && dirActiva?.lng != null ? { lat: dirActiva.lat, lng: dirActiva.lng } : null);

  // Tarifa de la zona del punto. Sin coordenadas no hay zona que consultar y se
  // usa el costo global, igual que hace el servidor.
  const { data: cobertura } = useQuery({
    queryKey: ["cobertura", puntoEntrega?.lat, puntoEntrega?.lng],
    queryFn: () => validarCobertura(puntoEntrega!.lat, puntoEntrega!.lng),
    enabled: !!puntoEntrega,
    staleTime: 5 * 60 * 1000,
  });

  const envioCosto = envioDeZona(cobertura?.costo_envio, envioCostoGlobal);
  const descuentoCupon = cuponValidado?.descuento || 0;

  // --- Frío asegurado (bloque H) ---
  // El servidor resuelve la elegibilidad porque CartItem no guarda la categoría y
  // los carritos ya persistidos en los teléfonos tampoco la tendrían.
  const productoIds = items.map((i) => i.productoId);
  const { data: frioInfo } = useQuery({
    queryKey: ["frio-carrito", productoIds.slice().sort((a, b) => a - b).join(",")],
    queryFn: () => getFrioCarrito(productoIds),
    enabled: items.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const frioActivo = !!frioInfo?.activo;
  const frioCosto = frioInfo?.costo ?? configApp?.frio_costo ?? 1000;
  const itemsElegibles = frioInfo?.elegibles?.length
    ? items.filter((i) => frioInfo.elegibles.includes(i.productoId))
    : [];
  const hayElegibles = itemsElegibles.length > 0;
  const todosElegibles = hayElegibles && itemsElegibles.length === items.length;
  // Solo se cobra si el check está marcado Y hay algo elegible. Nunca cobrar por aire.
  const frioAplicado = quiereFrio && frioActivo && hayElegibles;

  // Una sola cuenta, la misma que hace el servidor en POST /pedidos.
  const resumen = calcularResumen({
    subtotal,
    descuentoCupon,
    envioCosto,
    envioGratisMinimo,
    usaPuntos: usarPuntos && puedeUsarPuntos,
    cuponEnvioGratis: cuponValidado?.cupon.tipo === 'envio_gratis',
    frio: frioAplicado,
    frioCosto,
  });
  const total = resumen.total;

  // Espacio libre bajo el boton de confirmar. La tab bar FLOTA
  // (position:absolute en (tabs)/_layout.tsx): bottom = insets.bottom-6 (o 18
  // sin inset) y height 58. Con el `paddingBottom: 80` fijo de antes, en un
  // telefono con inset (86pt de tab bar) al boton se le comian 6pt y se le
  // cortaban las esquinas redondeadas. Se deriva de la MISMA formula para que
  // no se vuelva a desalinear si la barra cambia de alto.
  const altoTabBarFlotante = (insets.bottom > 0 ? insets.bottom - 6 : 18) + 58;
  const respiroBarra = altoTabBarFlotante + 12;

  // El check arranca apagado en cada pedido y no se persiste entre sesiones. Un
  // check pegado que suma $1.000 sin que la gente lo note es una queja garantizada.
  // Si el carrito deja de tener elegibles, se apaga solo para no cobrar por aire.
  useEffect(() => {
    if (quiereFrio && !hayElegibles) setQuiereFrio(false);
  }, [quiereFrio, hayElegibles]);

  // Tiempo estimado (bloque D). Llega null mientras la bandera esté apagada, así
  // que la app no necesita conocer la bandera: si no hay rango, no se muestra nada.
  const { data: eta } = useQuery({
    queryKey: ["eta", puntoEntrega?.lat, puntoEntrega?.lng],
    queryFn: () => getEtaActual(puntoEntrega?.lat, puntoEntrega?.lng),
    enabled: items.length > 0,
    staleTime: 60 * 1000,
  });

  const etaReportadoRef = useRef<string | null>(null);
  useEffect(() => {
    if (!eta) return;
    const clave = `${eta.min}-${eta.max}`;
    if (etaReportadoRef.current === clave) return;
    etaReportadoRef.current = clave;
    tracker.track('eta_mostrado', { min: eta.min, max: eta.max }, 'cart');
  }, [eta]);

  // Denominador de "cuánto pesa no tener pin" — el tamaño real del problema
  // contra el que va a chocar `exigir_ubicacion`. Se dispara cuando el CTA
  // "falta el punto" REALMENTE se pinta en pantalla, no solo cuando handlePedir
  // lo bloquea — así mide exposición, no solo bloqueo.
  const dirsSinPinReportadasRef = useRef<Set<number>>(new Set());
  useEffect(() => {
    if (!dirParaMostrar || dirParaMostrar.lat != null) return;
    if (dirsSinPinReportadasRef.current.has(dirParaMostrar.id)) return;
    dirsSinPinReportadasRef.current.add(dirParaMostrar.id);
    tracker.track('entrega_sin_pin_mostrado', { items_count: items.length }, 'cart');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirParaMostrar?.id, dirParaMostrar?.lat, items.length]);

  // Una dirección guardada sin punto se completa abriendo el mapa: al confirmar,
  // el pin se guarda contra ESA dirección para que la próxima vez ya lo tenga.
  const confirmarUbicacion = useConfirmarUbicacion();
  const abrirMapaParaDireccion = (dir: DireccionGuardada) => {
    // El texto de la dirección va como punto de partida: una dirección guardada
    // sin pin es, por definición, una que nunca resolvió contra el mapa, así que
    // abrir en el centro de Florencia deja a la persona arrastrando a ciegas.
    confirmarUbicacion(dir.direccion, dir, async (u, ctx) => {
      // "Guardar sin el punto" (fuera de zona, Direcciones 1.3.2) no aplica
      // aquí: esta dirección YA existe y ya se podía usar sin pin. No hay nada
      // que mutar — se vuelve tal cual estaba.
      if (u == null || ctx.motivo === "fuera_zona") return;
      try {
        await editarDireccion(dir.id, ubicacionABody(u));
        await refetchDirs();
        Toast.show({ type: "success", text1: "Punto guardado", text2: "Ya puedes confirmar tu pedido" });
      } catch {
        // Si no se pudo guardar contra la dirección, el punto igual sirve para
        // este pedido: se usa como si fuera una dirección nueva. Se abre la
        // hoja en modo "nueva" para que se vea qué pasó — SIN borrador: ya se
        // comprometió (mostrarNueva=true, nuevaUbicacion=u) antes de abrir la
        // hoja, así que cerrarla con el backdrop no debe descartar el pin.
        setNuevaUbicacion(u);
        setMostrarNueva(true);
        borradorDireccionRef.current = null;
        hojaDireccionAbiertaEstaVisitaRef.current = true;
        tracker.track('direccion_hoja_abierta', { n_direcciones: direcciones.length, origen: 'fallback_pin' }, 'cart');
        setHojaDireccionModo('nueva');
        setHojaDireccionVisible(true);
      }
    }, "carrito");
  };

  // Abre la hoja de dirección, capturando el borrador vigente para poder
  // restaurarlo si se cierra sin comprometer.
  const hojaDireccionAbiertaEstaVisitaRef = useRef(false);
  const abrirHojaDireccion = (modo: "lista" | "nueva", origen: "fila" | "sin_direccion" | "fallback_pin") => {
    borradorDireccionRef.current = { direccion: nuevaDireccion, notas: nuevasNotas, ubicacion: nuevaUbicacion, permitirSinPin };
    hojaDireccionAbiertaEstaVisitaRef.current = true;
    tracker.track('direccion_hoja_abierta', { n_direcciones: direcciones.length, origen }, 'cart');
    setHojaDireccionModo(modo);
    setHojaDireccionVisible(true);
  };

  const cerrarHojaDireccion = () => {
    // Descarta: si no se comprometió con "Usar esta dirección", los campos
    // vuelven a como estaban ANTES de abrir la hoja.
    if (borradorDireccionRef.current) {
      setNuevaDireccion(borradorDireccionRef.current.direccion);
      setNuevasNotas(borradorDireccionRef.current.notas);
      setNuevaUbicacion(borradorDireccionRef.current.ubicacion);
      setPermitirSinPin(borradorDireccionRef.current.permitirSinPin);
    }
    setHojaDireccionVisible(false);
  };

  // Envuelve setNuevaDireccion: el permiso de guardar sin pin es para el texto
  // con el que se concedió (Direcciones 1.3.2) — si la persona lo reescribe,
  // hay que volver a pasar por el mapa.
  const cambiarNuevaDireccion = (t: string) => {
    setNuevaDireccion(t);
    setPermitirSinPin(false);
  };

  const usarNuevaDireccion = () => {
    borradorDireccionRef.current = null;
    setMostrarNueva(true);
    setHojaDireccionVisible(false);
  };

  const seleccionarDireccion = (d: DireccionGuardada) => {
    setDireccionId(d.id);
    setMostrarNueva(false);
    setNotasOverride(null);
    setPermitirSinPin(false);
    borradorDireccionRef.current = null;
    // con_pin responde si la dirección ya tiene coordenadas: es el numerador
    // de "cuántas hay que mandar al mapa" (bloque F).
    tracker.track('direccion_seleccionada', { direccion_id: d.id, con_pin: d.lat != null }, 'cart');
    setHojaDireccionVisible(false);
  };

  const alternarFrio = (valor: boolean) => {
    setQuiereFrio(valor);
    // Tasa de toma real: ¿el cliente sí paga por frío? Se mide el tap, que es la
    // decisión, no el estado.
    tracker.track(
      valor ? 'frio_activado' : 'frio_desactivado',
      { n_elegibles: itemsElegibles.length },
      'cart',
    );
  };

  // ¿A cuántos carritos les aparece siquiera la opción? Es el denominador de la
  // tasa de toma. Una vez por composición de carrito, no en cada render.
  const frioOfrecidoRef = useRef<string | null>(null);
  useEffect(() => {
    if (!frioActivo || !hayElegibles) return;
    const clave = productoIds.slice().sort((a, b) => a - b).join(",");
    if (frioOfrecidoRef.current === clave) return;
    frioOfrecidoRef.current = clave;
    tracker.track('frio_ofrecido', { n_elegibles: itemsElegibles.length, n_items: items.length }, 'cart');
  }, [frioActivo, hayElegibles, itemsElegibles.length, items.length, productoIds]);

  const togglePedidoAbierto = () => {
    setPedidoAbierto((v) => {
      const nuevo = !v;
      if (nuevo) tracker.track('carrito_items_desplegados', { items_count: items.length }, 'cart');
      return nuevo;
    });
  };

  const handleValidarCupon = async () => {
    if (!codigoCupon.trim()) return;
    if (cuponValidado?.cupon.codigo === codigoCupon.trim()) return;
    setValidandoCupon(true);
    setCuponError("");
    setCuponValidado(null);
    try {
      const result = await validarCupon(codigoCupon.trim(), subtotal);
      setCuponValidado(result);
      cuponSubtotalRef.current = subtotal;
      tracker.track('cupon_aplicado', { cupon_id: result.cupon.id, descuento: result.descuento }, 'cart');
      Toast.show({ type: "success", text1: "Cupon aplicado", text2: `-${formatCOP(result.descuento)} de descuento` });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Cupon no valido";
      setCuponError(msg);
      Toast.show({ type: "error", text1: "Cupon no valido", text2: msg });
    } finally {
      setValidandoCupon(false);
    }
  };

  const handleQuitarCupon = () => {
    setCuponValidado(null);
    setCodigoCupon("");
    setCuponError("");
    cuponSubtotalRef.current = null;
  };

  // M-CART-17: si el subtotal cambió respecto al subtotal con el que se validó
  // el cupón, re-llamar al backend. Si el cupón ya no aplica (min_pedido, etc.)
  // lo retiramos y avisamos. Sin esto el total mostrado al cliente diverge del
  // que cobra el backend al crear pedido.
  useEffect(() => {
    if (!cuponValidado) return;
    if (cuponSubtotalRef.current === subtotal) return;
    const codigo = cuponValidado.cupon.codigo;
    const subtotalAtIntento = subtotal;
    let cancelado = false;
    (async () => {
      try {
        const result = await validarCupon(codigo, subtotalAtIntento);
        if (cancelado) return;
        cuponSubtotalRef.current = subtotalAtIntento;
        setCuponValidado(result);
      } catch {
        if (cancelado) return;
        cuponSubtotalRef.current = null;
        setCuponValidado(null);
        setCodigoCupon("");
        setCuponError("");
        Toast.show({
          type: "info",
          text1: "Cupon retirado",
          text2: "El subtotal cambio y el cupon ya no aplica",
        });
      }
    })();
    return () => { cancelado = true; };
  }, [subtotal, cuponValidado]);

  const submitLockRef = useRef(false);
  // M-CART-15: idempotency key persiste hasta éxito; reintentos tras timeout reusan el mismo
  const submitIdempotencyKeyRef = useRef<string | null>(null);
  // M-CART-18: id de la dirección creada en este intento. Evita que un reintento
  // (tras timeout/stock) vuelva a crear la misma dirección una y otra vez.
  const direccionCreadaIdRef = useRef<number | null>(null);
  // Idempotency-Key propia para crear la dirección (NUNCA compartir la del
  // pedido: el middleware replay-earía la respuesta del endpoint equivocado).
  const direccionIdemKeyRef = useRef<string | null>(null);
  // InitiateCheckout de Meta: una vez por intento de pedido. Los reintentos tras
  // un fallo NO lo re-disparan; se resetea junto con el idempotency key al éxito.
  const initiateCheckoutLogueadoRef = useRef(false);
  // checkout_iniciado: una sola vez por VISITA (build 94; antes era por montaje
  // del tab — ver el reset en useFocusEffect mas abajo). Tambien se libera al
  // crear el pedido para que un reintento dentro de la misma visita, tras un
  // fallo, no re-cuente un segundo "toco Pedir".
  const checkoutIniciadoRef = useRef(false);
  // Composición de carrito para la que ya se mostró el recordatorio de frío. Un
  // modal que reaparece encima del botón de comprar es la forma más rápida de que
  // desinstalen la app.
  const recordatorioMostradoRef = useRef<string | null>(null);
  // Datos ya validados del pedido, a la espera de que el cliente responda la tarjeta.
  const datosPedidoRef = useRef<DatosPedido | null>(null);
  // registro_muro_mostrado: una vez por montaje del tab. Sin el guard, cada
  // re-render del invitado con carrito contaría un rebote nuevo.
  const muroTrackeadoRef = useRef(false);

  // --- carrito_abandonado: el que se va SIN tocar "Pedir" ---
  // El estado viaja por ref y no por dependencias del efecto a proposito. Con
  // deps, useFocusEffect vuelve a correr su limpieza cada vez que cambia una —
  // subir una cantidad, elegir direccion— y contaria un abandono por cada
  // retoque del carrito, con la pantalla todavia abierta.
  //
  // vio_formulario: desde el checkout denso (1.3.2/build 94) significa "abrió
  // la hoja de dirección en esta visita" (hojaDireccionAbiertaEstaVisitaRef),
  // NO "tiene el formulario inline abierto" como antes de la hoja — la serie
  // NO es comparable a través del build 94.
  //
  // envio/total/envio_gratis/tiene_pin/frio (build 94): antes solo se sabia si
  // el SUBTOTAL superaba el minimo, no si el envio o el frio pesaban en lo que
  // la persona alcanzo a VER. Es lo que permite responder "vio el total y se
  // fue" por inferencia — no dice el motivo, solo las condiciones. Se infiere
  // en vez de preguntar porque el gatillo mas comun de este evento es la app
  // yendose a background, donde no hay pantalla para mostrar una hoja de
  // motivos. Los cinco salen de `resumen` (mismo calculo que usa el servidor)
  // y `frioAplicado`, ya calculados mas arriba — no se recalcula nada aca.
  const estadoCarritoRef = useRef({
    items_count: 0, subtotal: 0, tiene_direccion: false, supera_minimo: false,
    tienda_abierta: false, vio_formulario: false, envio: 0, total: 0,
    envio_gratis: false, tiene_pin: false, frio: false,
  });
  useEffect(() => {
    estadoCarritoRef.current = {
      items_count: items.length,
      subtotal,
      tiene_direccion: !!(dirActiva?.direccion || direccion.trim()),
      supera_minimo: subtotal >= pedidoMinimo,
      tienda_abierta: !!tienda.abierta,
      vio_formulario: hojaDireccionAbiertaEstaVisitaRef.current,
      envio: resumen.envio,
      total: resumen.total,
      envio_gratis: resumen.motivoEnvioGratis !== null,
      tiene_pin: dirActiva?.lat != null && dirActiva?.lng != null,
      frio: frioAplicado,
    };
  });
  // Intento de pedido en ESTA visita. Independiente de checkoutIniciadoRef:
  // uno cuenta el boton tocado (una vez), el otro solo bloquea el reporte de
  // carrito_abandonado una vez que ya se toco Pedir.
  const pidioEnEstaVisitaRef = useRef(false);
  const abandonoReportadoRef = useRef(false);
  const reportarAbandono = useCallback(() => {
    if (abandonoReportadoRef.current || pidioEnEstaVisitaRef.current) return;
    const estado = estadoCarritoRef.current;
    // Carrito vacio no es un abandono: o nunca hubo nada, o el pedido ya salio y
    // el carrito se limpio solo.
    if (estado.items_count === 0) return;
    abandonoReportadoRef.current = true;
    // Deduplicacion entre remounts (ver comentario de ultimoAbandonoReportado):
    // el ref de este componente no alcanza a cubrirlo si hay dos instancias
    // montadas a la vez, asi que se compara contra el estado del MODULO.
    const clave = JSON.stringify(estado);
    const ahora = Date.now();
    if (ultimoAbandonoReportado && ultimoAbandonoReportado.clave === clave
      && ahora - ultimoAbandonoReportado.en < VENTANA_DEDUP_ABANDONO_MS) {
      return;
    }
    ultimoAbandonoReportado = { clave, en: ahora };
    tracker.track('carrito_abandonado', estado, 'cart');
  }, []);

  useFocusEffect(
    useCallback(() => {
      pidioEnEstaVisitaRef.current = false;
      abandonoReportadoRef.current = false;
      hojaDireccionAbiertaEstaVisitaRef.current = false;
      dirsSinPinReportadasRef.current = new Set();
      // checkoutIniciadoRef se resetea aca, no solo al crear el pedido (mas
      // abajo, en el camino de exito): antes era por MONTAJE del tab, asi que
      // volver a esta pantalla sin desmontarla (cambiar de tab y regresar) no
      // recontaba checkout_iniciado aunque si podia volver a contar
      // carrito_abandonado — el denominador del embudo de checkout quedaba
      // subcontado contra el numerador de abandonos. Alinearlo a la VISITA,
      // igual que pidioEnEstaVisitaRef, es un corte de serie (build 94): ver
      // docs/estanco/TELEMETRIA-EVENTOS.md.
      checkoutIniciadoRef.current = false;
      // Cerrar la app tambien es irse, y probablemente sea la forma mas comun.
      // Sin esto solo se veria al que se cambia de pestaña. El tracker hace flush
      // al pasar a background, asi que el evento alcanza a salir.
      const sub = AppState.addEventListener('change', (estado) => {
        if (estado !== 'active') reportarAbandono();
      });
      return () => {
        sub.remove();
        reportarAbandono();
      };
    }, [reportarAbandono]),
  );

  const handlePedir = async () => {
    if (submitLockRef.current) return;
    // Toco "Pedir": pase lo que pase despues, esta visita ya no cuenta como
    // abandono silencioso — se cae en alguno de los pasos de checkout_abandonado,
    // que es justo la diferencia que este evento existe para medir.
    pidioEnEstaVisitaRef.current = true;

    // A.2 — base del embudo de checkout: intención real de pedir. Una vez por
    // intento; un reintento tras un fallo no vuelve a contarlo.
    if (!checkoutIniciadoRef.current) {
      checkoutIniciadoRef.current = true;
      tracker.track('checkout_iniciado', { items_count: items.length, subtotal }, 'cart');
    }

    // Guía 5.1.1(v) — requerir cuenta solo al momento del checkout. A REGISTRO,
    // no a login: la mayoría de invitados no tiene cuenta todavía, y el pie del
    // registro ya ofrece "¿Ya tienes una cuenta? Iniciar sesión" para el que sí.
    if (!cliente) {
      tracker.track('checkout_abandonado', { paso: 'registro', items_count: items.length }, 'cart');
      router.push("/(auth)/register");
      return;
    }

    if (subtotal < pedidoMinimo) {
      tracker.track('checkout_abandonado', { paso: 'pedido_minimo', items_count: items.length }, 'cart');
      Toast.show({ type: "error", text1: "Pedido mínimo", text2: `Agrega ${formatCOP(pedidoMinimo - subtotal)} más para continuar` });
      return;
    }

    const dir = dirActiva?.direccion || direccion.trim();

    if (!dir && !mostrarNueva) {
      // Se mantiene el evento: es la linea base contra la que se mide si abrir el
      // formulario aqui sirvio. Quitarlo al arreglar el flujo dejaria el arreglo
      // sin forma de evaluarse.
      tracker.track('checkout_abandonado', { paso: 'sin_direccion', items_count: items.length }, 'cart');
      abrirHojaDireccion('nueva', 'sin_direccion');
      // `info` y no `error`: ya no es un callejon sin salida sino el siguiente
      // paso del pedido, y el rojo le dice al cliente que hizo algo mal.
      Toast.show({ type: "info", text1: "Falta tu dirección", text2: "Agrégala para enviarte el pedido" });
      return;
    }
    // GPS-first: en una dirección nueva hace falta el texto Y (el punto O el
    // permiso de "fuera de zona"). Ya no se pide barrio (la cobertura se
    // calcula del GPS). Antes esto era un OR (bastaba texto o pin) y era la
    // única llave abierta por la que nacían direcciones sin punto: en agosto,
    // 18 de 60 direcciones creadas desde el checkout no tenían coordenadas —
    // perfil y onboarding ya lo bloqueaban, solo el carrito no (Direcciones 1.3.2).
    if (mostrarNueva && !nuevaDireccion.trim()) {
      tracker.track('checkout_abandonado', { paso: 'sin_direccion', items_count: items.length }, 'cart');
      Toast.show({ type: "error", text1: "Falta la dirección", text2: "Escríbela o elige una sugerencia" });
      return;
    }
    if (mostrarNueva && !nuevaUbicacion && !permitirSinPin) {
      tracker.track('checkout_abandonado', { paso: 'sin_pin', items_count: items.length }, 'cart');
      Toast.show({ type: "error", text1: "Falta el punto de entrega", text2: "Ubica tu punto en el mapa o usa tu ubicación actual" });
      return;
    }

    // Bloque F: con la bandera prendida el punto es obligatorio. Se valida ACÁ y no
    // solo en el servidor porque rebotar el pedido después de tocar "Confirmar" es
    // la peor forma de enterarse — y porque desde aquí se puede abrir el mapa, que
    // es la salida que sí funciona sin ningún permiso.
    const puntoActual = mostrarNueva ? nuevaUbicacion : (dirActiva?.lat != null ? dirActiva : null);
    if (configApp?.exigir_ubicacion && !puntoActual) {
      tracker.track('checkout_abandonado', { paso: 'sin_pin', items_count: items.length }, 'cart');
      Toast.show({
        type: "error",
        text1: "Falta el punto de entrega",
        text2: "Ubícalo en el mapa para que el domiciliario llegue exacto",
      });
      // Una dirección guardada sin punto se completa abriendo el mapa; el resultado
      // se guarda contra esa misma dirección al volver.
      if (!mostrarNueva && dirActiva) {
        abrirMapaParaDireccion(dirActiva);
      }
      return;
    }
    if (items.length === 0) return;

    const dirFinal = mostrarNueva
      ? (nuevaDireccion.trim() || nuevaUbicacion?.geocoded_direccion || "Ubicación en el mapa")
      : dir;
    const notFinal = mostrarNueva ? nuevasNotas.trim() : notasEfectivas;

    // Snapshot de ubicación para el pedido: pin recién capturado (nueva dirección)
    // o el pin ya guardado en la dirección seleccionada. El servidor recalcula fuera_zona.
    const ubicacionSnapshot: UbicacionCapturada | null = mostrarNueva
      ? nuevaUbicacion
      : dirActiva?.lat != null && dirActiva?.lng != null
        ? {
            lat: dirActiva.lat,
            lng: dirActiva.lng,
            precision_m: dirActiva.precision_m ?? null,
            metodo_ubicacion: dirActiva.metodo_ubicacion === "pin_mapa" ? "pin_mapa" : "gps",
            geocoded_direccion: dirActiva.geocoded_direccion ?? null,
          }
        : null;

    const datos: DatosPedido = { dirFinal, notFinal, ubicacionSnapshot };

    // Recordatorio de frío: se intercepta el tap y el pedido NO se crea todavía.
    // Solo si la bandera está prendida, hay algo elegible y el check está apagado
    // — si ya dijo que sí, volvérselo a preguntar es tratarlo de distraído y
    // arriesgar que se arrepienta. Una sola vez por carrito: si el pedido falla y
    // el cliente reintenta, la tarjeta no reaparece.
    const claveCarrito = productoIds.slice().sort((a, b) => a - b).join(",");
    const debeRecordar =
      !!configApp?.frio_recordatorio_activo &&
      frioActivo &&
      hayElegibles &&
      !quiereFrio &&
      recordatorioMostradoRef.current !== claveCarrito;

    if (debeRecordar) {
      recordatorioMostradoRef.current = claveCarrito;
      datosPedidoRef.current = datos;
      tracker.track('frio_recordatorio_visto', { n_elegibles: itemsElegibles.length }, 'cart');
      setMostrarRecordatorioFrio(true);
      return;
    }

    await ejecutarPedido(datos, frioAplicado);
  };

  // Creación real del pedido. Vive aparte de handlePedir porque los dos botones
  // del recordatorio terminan aquí: la tarjeta es una bifurcación, no un desvío.
  // Se toca una vez y se compra; nadie vuelve al carrito.
  const ejecutarPedido = async (datos: DatosPedido, conFrio: boolean) => {
    if (submitLockRef.current) return;
    const { dirFinal, notFinal, ubicacionSnapshot } = datos;

    submitLockRef.current = true;
    setLoading(true);

    // Meta InitiateCheckout: el usuario tocó "Confirmar pedido" con carrito
    // válido — intención de compra real. Guard de una vez por intento.
    if (!initiateCheckoutLogueadoRef.current) {
      initiateCheckoutLogueadoRef.current = true;
      metaLogInitiateCheckout(subtotal, { numItems: items.length });
    }

    let llegoACrearPedido = false;
    try {
      // S10 - Verificar estado fresco de la tienda antes de crear pedido
      const estadoTienda = await getEstadoTienda();
      if (!estadoTienda.abierta) {
        // Cerrar la tarjeta del frío ANTES del toast. Este `return` temprano se
        // saltaba el cierre que sí hacen el éxito y el catch, y el Modal nativo
        // se dibuja encima de todo: el aviso salía detrás y la tarjeta quedaba
        // ahí, sin explicación. Se veía como que el pedido se colgó.
        setMostrarRecordatorioFrio(false);
        tracker.track('checkout_abandonado', { paso: 'tienda_cerrada', items_count: items.length }, 'cart');
        Toast.show({ type: "error", text1: "Tienda cerrada", text2: estadoTienda.proximaApertura || "Ya cerramos por hoy" });
        return;
      }

      // Guardar nueva dirección si la ingresó. M-CART-18: solo una vez por intento
      // — si ya la creamos y el pedido falló, el reintento NO la vuelve a crear.
      if (mostrarNueva && dirFinal && direccionCreadaIdRef.current == null) {
        try {
          if (!direccionIdemKeyRef.current) direccionIdemKeyRef.current = nuevoUuidV4();
          const nueva = await crearDireccion({ direccion: dirFinal, notas: notFinal || undefined, predeterminada: true, ...ubicacionABody(nuevaUbicacion) }, direccionIdemKeyRef.current);
          direccionCreadaIdRef.current = nueva.id;
          tracker.track('direccion_creada', { con_pin: !!nuevaUbicacion }, 'cart');
          if (!nuevaUbicacion) {
            tracker.track('direccion_sin_pin_guardada', { origen: 'carrito' }, 'cart');
          }
          try {
            await refetchDirs();
          } catch {
            // refetch best-effort: errores no bloquean el pedido
          }
        } catch {
          // si falla la creación, el pedido continúa con la dirección inline (dirFinal)
        }
      }

      llegoACrearPedido = true;
      // M-CART-15: generar key UNA vez; reintentos tras timeout/error reusan el mismo
      if (!submitIdempotencyKeyRef.current) {
        submitIdempotencyKeyRef.current = nuevoUuidV4();
      }
      const { pedido, puntos_ganados } = await crearPedido({
        direccion: dirFinal,
        notas_cliente: notFinal || undefined,
        usar_puntos: usarPuntos && puedeUsarPuntos,
        cupon_codigo: cuponValidado?.cupon.codigo || undefined,
        lineas: items.map((i) => ({ producto_id: i.productoId, cantidad: i.cantidad })),
        // Solo la intención. El servidor recalcula la elegibilidad y el precio
        // desde la base: si no hay nada elegible, no cobra y no falla.
        quiere_frio: conFrio,
        ...ubicacionABody(ubicacionSnapshot),
        // Medio de pago (093): solo si la bandera está prendida. Con ella
        // apagada no se manda nada nuevo — el servidor guarda NULL igual que
        // con un binario que no conoce el campo.
        ...(medioPagoActivo ? { medio_pago: medioPago } : {}),
      }, submitIdempotencyKeyRef.current);
      // Éxito: liberar el key y el id de dirección para que el próximo pedido empiece limpio
      submitIdempotencyKeyRef.current = null;
      direccionCreadaIdRef.current = null;
      direccionIdemKeyRef.current = null;
      initiateCheckoutLogueadoRef.current = false;
      checkoutIniciadoRef.current = false;
      recordatorioMostradoRef.current = null;
      setMostrarRecordatorioFrio(false);
      setQuiereFrio(false);
      setMedioPago("efectivo");
      setNuevaUbicacion(null);
      setNotasOverride(null);
      setPedidoAbierto(false);
      setCuponAbierto(false);
      // medio_pago del PEDIDO devuelto por el servidor, no del estado local:
      // el estado ya se reseteó arriba, y ademas el servidor es quien decide
      // si lo que se mandó era válido (normalizarMedioPago puede haberlo
      // descartado a NULL).
      tracker.track('pedido_creado', { pedido_id: pedido.id, total: pedido.total, items_count: items.length, uso_cupon: !!cuponValidado, uso_puntos: usarPuntos && puedeUsarPuntos, medio_pago: pedido.medio_pago ?? undefined, pide_vuelto: pedido.paga_con != null, con_notas: !!notFinal }, 'cart');
      metaLogPurchase(pedido.total, { pedidoId: pedido.id, numItems: items.length });
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
      queryClient.invalidateQueries({ queryKey: ["cupones-disponibles"] });
      // El cupo de los productos con máximo por cliente acaba de consumirse: sin esto
      // la ficha serviría el cupo viejo (staleTime 5 min) y dejaría agregar de nuevo
      // para rebotar al pagar.
      queryClient.invalidateQueries({ queryKey: ["producto"] });
      // Mismo motivo para el resumen de cupos que consumen las cards de los listados.
      queryClient.invalidateQueries({ queryKey: ["mis-limites"] });
      // Refrescar perfil antes de limpiar carrito (si falla, no afecta el pedido)
      const { getPerfil } = await import("../../src/lib/api");
      let clienteActualizado;
      try {
        clienteActualizado = await getPerfil();
      } catch {
        // Pedido creado exitosamente; puntos se actualizarán al reabrir el perfil
      }
      clear();
      if (clienteActualizado) {
        useAuthStore.getState().setCliente(clienteActualizado);
      }

      const ptsMsg = puntos_ganados ? ` (+${puntos_ganados} pts)` : "";
      Toast.show({
        type: "success",
        text1: "Pedido confirmado" + ptsMsg,
        text2: `Pedido #${pedido.numero_orden_cliente ?? pedido.id} - ${formatCOP(pedido.total)}`,
        visibilityTime: 3000,
      });
      // Replace cart con la lista de pedidos + push detalle encima:
      // 1. replace borra cart del stack (carrito ya esta vacio, no tiene sentido volver)
      // 2. push deja stack: orders/index -> orders/[id], lo que da back button automatico
      //    en el detalle que retorna a "Mis pedidos"
      router.replace("/(tabs)/orders");
      router.push({ pathname: "/(tabs)/orders/[id]", params: { id: String(pedido.id) } });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "No se pudo crear el pedido";
      const codigo = (err as ApiError)?.body?.codigo_error;
      // El error del pedido no se mezcla con la pregunta del frío: se cierra la
      // tarjeta y el mensaje sale en el carrito, como siempre.
      setMostrarRecordatorioFrio(false);
      tracker.track('checkout_abandonado', { paso: llegoACrearPedido ? 'error_pedido' : 'error_previo', items_count: items.length }, 'cart');
      Sentry.captureException(err instanceof Error ? err : new Error(msg), { tags: { flow: "checkout" } });
      // Solo limpiar cupón si el pedido llegó a crearse en backend (podría haberse consumido)
      if (llegoACrearPedido) {
        setCuponValidado(null);
        setCodigoCupon("");
      }

      // Al cliente le falta un dato, no se le rompió nada: "Error al crear
      // pedido" lo asusta y además esconde el mensaje bueno en el subtítulo.
      //
      // POR QUE PASA SI LA APP YA VALIDA ANTES: la config vive en caché de 5
      // minutos, así que en los minutos siguientes a prender `exigir_ubicacion`
      // hay gente con la app abierta que todavía la cree apagada, se salta la
      // validación local y choca contra el 400. Es justo el rato de mayor
      // volumen de este error, y era el único camino que no abría el mapa —
      // el cliente leía "ubícalo en el mapa" sin nada que tocar.
      if (codigo === 'UBICACION_REQUERIDA') {
        Toast.show({
          type: "error",
          text1: "Falta el punto de entrega",
          text2: "Ubícalo en el mapa para que el domiciliario llegue exacto",
        });
        if (!mostrarNueva && dirActiva) abrirMapaParaDireccion(dirActiva);
        return;
      }
      if (codigo === 'FUERA_DE_ZONA') {
        Toast.show({ type: "error", text1: "Fuera de la zona de entrega", text2: msg });
        return;
      }

      Toast.show({ type: "error", text1: "Error al crear pedido", text2: msg });
    } finally {
      submitLockRef.current = false;
      setLoading(false);
    }
  };

  // Apple §5.1.1(v): el catálogo es público pero el checkout requiere sesión.
  // Items en el cart (Zustand persistido) sobreviven el registro y se mantienen
  // disponibles al volver. Bloqueamos cart únicamente cuando hay items pendientes
  // (un guest que solo abre el tab ve la pantalla vacía y puede volver a explorar).
  // A REGISTRO, no a login: la mayoría de invitados no tiene cuenta, y el pie del
  // registro ya ofrece "¿Ya tienes una cuenta? Iniciar sesión" para el que sí.
  if (isAuthLoading) return null;
  if (!isAuthenticated && items.length > 0) {
    // El rebote se mide UNA vez por montaje: es la base del embudo
    // muro → codigo_solicitado → registro_completado. Antes era invisible.
    if (!muroTrackeadoRef.current) {
      muroTrackeadoRef.current = true;
      tracker.track('registro_muro_mostrado', { items_count: items.length, subtotal }, 'cart');
    }
    return <Redirect href="/(auth)/register" />;
  }

  if (items.length === 0) {
    return (
      <View className="flex-1 items-center justify-center px-6" style={{ backgroundColor: colors.bg }}>
        <CartIcon color="#BCCABA" size={48} />
        <Text style={{ fontSize: 20, fontFamily: fuentes.titulo, color: "#6D7B6C", marginBottom: 6 }}>Carrito vacío</Text>
        <Text style={{ color: "#BCCABA", textAlign: "center", fontFamily: fuentes.destacado, fontSize: 14 }}>
          Agrega productos desde el catálogo para hacer tu pedido
        </Text>
      </View>
    );
  }

  // En iOS el desplazamiento lo hace `automaticallyAdjustKeyboardInsets` de la lista,
  // que sube solo el contenido scrolleable. Antes ademas habia un behavior="padding"
  // aqui, y entre los dos levantaban la pantalla entera —barra del total incluida—
  // hasta tapar media vista. Android si necesita el ajuste porque no tiene equivalente.
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'android' ? 'height' : undefined}
      style={{ flex: 1 }}
    >
    <View className="flex-1" style={{ backgroundColor: colors.bg }}>
      <FlatList automaticallyAdjustKeyboardInsets keyboardDismissMode="interactive"
        data={pedidoAbierto ? items : []}
        keyExtractor={(item) => String(item.productoId)}
        contentContainerStyle={{ padding: 16, paddingTop: insets.top + 8, paddingBottom: 24 }}
        ListHeaderComponent={
          <View style={{ marginBottom: 12 }}>
            <FilaPedidoColapsado nItems={items.length} subtotal={subtotal} abierto={pedidoAbierto} onToggle={togglePedidoAbierto} />
          </View>
        }
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        renderItem={({ item }) => <CartItem item={item} />}
        ListFooterComponent={
          <View style={{ gap: 12, marginTop: pedidoAbierto ? 12 : 0 }}>
            <BloquePuntoEntrega
              dirActiva={dirParaMostrar}
              eta={eta ?? null}
              notas={notasVisibles}
              exigirUbicacion={!!configApp?.exigir_ubicacion}
              onCambiarDireccion={() => abrirHojaDireccion(direcciones.length > 0 ? "lista" : "nueva", "fila")}
              onAgregarDireccion={() => abrirHojaDireccion("nueva", "fila")}
              onUbicarEnMapa={() => {
                if (mostrarNueva) {
                  // Dirección nueva en progreso: si ya hay un pin capturado se
                  // abre el mapa para AJUSTARLO; si no, se vuelve a la hoja
                  // para capturarlo (botón de ubicación / mapa / buscador).
                  if (nuevaUbicacion) {
                    confirmarUbicacion(nuevaDireccion, nuevaUbicacion, (u, ctx) => {
                      if (u == null && ctx.motivo === "fuera_zona") {
                        setPermitirSinPin(true);
                        setNuevaUbicacion(null);
                        return;
                      }
                      setNuevaUbicacion(u);
                    }, "carrito");
                  } else {
                    abrirHojaDireccion("nueva", "fila");
                  }
                } else if (dirActiva) {
                  abrirMapaParaDireccion(dirActiva);
                }
              }}
              onEditarNotas={() => setHojaNotasVisible(true)}
            />

            {medioPagoActivo && (
              <View className="rounded-2xl" style={{ backgroundColor: colors.surface, ...shadows.card, paddingHorizontal: 14 }}>
                <FilaAccion
                  icono={iconoMedioActivo.icon}
                  colorIcono={iconoMedioActivo.color}
                  etiqueta="Método de pago"
                  valor={subtituloMedioPago}
                  placeholder="Elige cómo vas a pagar"
                  accion="Cambiar"
                  onPress={() => {
                    tracker.track('medio_pago_hoja_abierta', { medio_actual: medioPago }, 'cart');
                    setHojaMedioPagoVisible(true);
                  }}
                  a11yLabel={`Cambiar método de pago. Actual: ${subtituloMedioPago ?? "sin elegir"}`}
                />
              </View>
            )}

            {/* Cupón, colapsado: lo usa una minoría. Va ANTES de frío/puntos —
                es una decisión de "¿tengo un código?", no de "¿qué le agrego
                al pedido?", y se resuelve más rápido que esas dos. */}
            {cuponValidado ? (
              <View className="flex-row items-center p-3 rounded-xl" style={{ backgroundColor: colors.surface, ...shadows.card, borderWidth: 2, borderColor: colors.green }}>
                <Feather name="check-circle" size={18} color={colors.green} />
                <View className="flex-1 ml-3">
                  <Text style={{ fontSize: 13, fontFamily: fuentes.destacado, color: colors.green }}>
                    {cuponValidado.cupon.codigo}
                  </Text>
                  <Text style={{ fontFamily: fuentes.destacado, fontSize: 12, color: "#6D7B6C" }}>
                    {cuponValidado.cupon.descripcion || (cuponValidado.cupon.tipo === "porcentaje" ? `${cuponValidado.cupon.valor}% de descuento` : `${formatCOP(cuponValidado.cupon.valor)} de descuento`)}
                  </Text>
                </View>
                <Pressable onPress={handleQuitarCupon} accessibilityRole="button" accessibilityLabel="Quitar cupón" hitSlop={14}>
                  <Feather name="x-circle" size={18} color="#9E9E9E" />
                </Pressable>
              </View>
            ) : cuponAbierto ? (
              <View className="p-4 rounded-2xl" style={{ backgroundColor: colors.surface, ...shadows.card }}>
                <View className="flex-row" style={{ gap: 8 }}>
                  <TextInput
                    style={{
                      flex: 1,
                      backgroundColor: colors.lowfill,
                      borderRadius: 12,
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                      fontSize: 14,
                      color: "#1A1C1A",
                      fontFamily: "monospace",
                      textTransform: "uppercase",
                      letterSpacing: 2,
                    }}
                    placeholder="CODIGO"
                    placeholderTextColor="#BCCABA"
                    value={codigoCupon}
                    onChangeText={(t) => { setCodigoCupon(t.toUpperCase()); setCuponError(""); }}
                    autoCapitalize="characters"
                    autoFocus
                  />
                  <Pressable
                    onPress={handleValidarCupon}
                    disabled={validandoCupon || !codigoCupon.trim()}
                    accessibilityRole="button"
                    accessibilityLabel="Aplicar cupón"
                    accessibilityState={{ disabled: validandoCupon || !codigoCupon.trim() }}
                    style={{
                      backgroundColor: codigoCupon.trim() ? colors.green : "#E2E3DF",
                      borderRadius: 12,
                      paddingHorizontal: 16,
                      minHeight: 44,
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ color: "#fff", fontFamily: fuentes.destacado, fontSize: 13 }}>
                      {validandoCupon ? "..." : "Aplicar"}
                    </Text>
                  </Pressable>
                </View>
                {cuponError ? (
                  <Text style={{ fontFamily: fuentes.destacado, fontSize: 12, color: colors.danger, marginTop: 6, marginLeft: 4 }}>{cuponError}</Text>
                ) : null}
              </View>
            ) : (
              <Pressable
                onPress={() => setCuponAbierto(true)}
                accessibilityRole="button"
                accessibilityLabel="Agregar un cupón de descuento"
                className="flex-row items-center justify-between p-3 rounded-2xl"
                style={{ backgroundColor: colors.surface, ...shadows.card, minHeight: 44 }}
              >
                <View className="flex-row items-center" style={{ gap: 10 }}>
                  <Feather name="tag" size={16} color="#6D7B6C" />
                  <Text style={{ fontSize: 13, fontFamily: fuentes.destacado, color: "#1A1C1A" }}>¿Tienes un cupón?</Text>
                </View>
                <Feather name="chevron-right" size={18} color="#CBD3C7" />
              </Pressable>
            )}

            <BloqueExtras
              frioActivo={frioActivo}
              hayElegibles={hayElegibles}
              quiereFrio={quiereFrio}
              frioCosto={frioCosto}
              todosElegibles={todosElegibles}
              itemsElegibles={itemsElegibles}
              onToggleFrio={alternarFrio}
              mostrarPuntos={subtotal < envioGratisMinimo}
              puedeUsarPuntos={puedeUsarPuntos}
              puntosParaEnvioGratis={puntosParaEnvioGratis}
              puntos={puntos}
              usarPuntos={usarPuntos}
              onToggleUsarPuntos={setUsarPuntos}
            />

            <ResumenTotales
              resumen={resumen}
              envioCosto={envioCosto}
              envioGratisMinimo={envioGratisMinimo}
              cuponCodigo={cuponValidado?.cupon.codigo}
            />
          </View>
        }
      />

      {/* Barra inferior. Se esconde con el teclado abierto: en la pantalla base
          solo queda el input del cupón, y la barra lo taparía. */}
      {!tecladoVisible && (
      <View
        className="bg-white px-6 pt-4"
        style={{
          paddingBottom: respiroBarra,
          borderTopWidth: 1,
          borderTopColor: "#E8E8E5",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.06,
          shadowRadius: 12,
          elevation: 10,
        }}
      >
        {/* Banda de tienda cerrada (versión compacta, sin horario) */}
        <BandaCerrado tienda={tienda} compact style={{ marginBottom: 12 }} />
        <BandaOperativa tienda={tienda} compact style={{ marginBottom: 12 }} />

        {subtotal < pedidoMinimo && (
          <Text style={{ fontSize: 12, color: colors.offer, fontFamily: fuentes.destacado, marginBottom: 10, textAlign: "center" }}>
            Pedido mínimo: {formatCOP(pedidoMinimo)} (faltan {formatCOP(pedidoMinimo - subtotal)})
          </Text>
        )}

        <Pressable
          onPress={handlePedir}
          disabled={loading || !tienda.abierta || subtotal < pedidoMinimo}
          accessibilityRole="button"
          accessibilityLabel={`Confirmar pedido por ${formatCOP(total)}`}
          accessibilityState={{ disabled: loading || !tienda.abierta || subtotal < pedidoMinimo }}
        >
          <LinearGradient
            colors={
              !tienda.abierta ? ["#3D3D3D", "#2A2A2A"] :
              subtotal < pedidoMinimo ? ["#BCCABA", "#9EA89D"] :
              loading ? ["#9E9E9E", "#757575"] :
              ["#1FAF55", "#006D30"]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{
              borderRadius: 14,
              paddingVertical: 16,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              shadowColor: tienda.abierta ? "#1FAF55" : "#000",
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: tienda.abierta ? 0.3 : 0.1,
              shadowRadius: 16,
              elevation: 6,
            }}
          >
            <Text style={{ color: "#fff", fontFamily: fuentes.destacado, fontSize: 17, marginRight: 8 }}>
              {loading ? "Enviando..." : !tienda.abierta ? "Tienda cerrada" : subtotal < pedidoMinimo ? `Faltan ${formatCOP(pedidoMinimo - subtotal)}` : `Confirmar pedido · ${formatCOP(total)}`}
            </Text>
            {!loading && tienda.abierta && <ChevronRightIcon />}
          </LinearGradient>
        </Pressable>
      </View>
      )}

      <HojaDireccion
        visible={hojaDireccionVisible}
        modoInicial={hojaDireccionModo}
        direcciones={direcciones}
        direccionActivaId={mostrarNueva ? null : (dirActiva?.id ?? null)}
        onSeleccionar={seleccionarDireccion}
        onUbicarEnMapa={(d) => { setHojaDireccionVisible(false); abrirMapaParaDireccion(d); }}
        nuevaDireccion={nuevaDireccion}
        onNuevaDireccion={cambiarNuevaDireccion}
        nuevasNotas={nuevasNotas}
        onNuevasNotas={setNuevasNotas}
        nuevaUbicacion={nuevaUbicacion}
        onNuevaUbicacion={setNuevaUbicacion}
        silenciado={silenciadoDir}
        onSilenciado={setSilenciadoDir}
        permitirSinPin={permitirSinPin}
        onSinPin={() => setPermitirSinPin(true)}
        origen="carrito"
        onUsarNueva={usarNuevaDireccion}
        onCerrar={cerrarHojaDireccion}
      />

      <HojaMedioPago
        visible={hojaMedioPagoVisible}
        medios={mediosPagoDisponibles}
        medioSeleccionado={medioPago}
        onSeleccionar={(codigo) => {
          setMedioPago(codigo);
          // "efectivo" es el preseleccionado: cambio mide cuánta fricción
          // quita tener el default preseleccionado.
          tracker.track('medio_pago_elegido', { medio: codigo, cambio: codigo !== "efectivo" }, 'cart');
        }}
        onCerrar={() => setHojaMedioPagoVisible(false)}
      />

      <HojaNotas
        visible={hojaNotasVisible}
        valorInicial={notasVisibles}
        onGuardar={(texto) => { if (mostrarNueva) setNuevasNotas(texto); else setNotasOverride(texto); }}
        onCerrar={() => setHojaNotasVisible(false)}
      />

      {/* Última pregunta antes de cobrar. Los dos botones crean el pedido: la
          tarjeta es una bifurcación, no un desvío. */}
      <FrioRecordatorio
        visible={mostrarRecordatorioFrio}
        imagenUrl={configApp?.frio_imagen_url}
        costo={frioCosto}
        nombresElegibles={itemsElegibles.map((i) => i.nombre)}
        todosElegibles={todosElegibles}
        totalConFrio={total + (frioAplicado ? 0 : frioCosto)}
        enviando={loading}
        onAceptar={() => {
          tracker.track('frio_recordatorio_aceptado', { n_elegibles: itemsElegibles.length }, 'cart');
          setQuiereFrio(true);
          const datos = datosPedidoRef.current;
          if (datos) ejecutarPedido(datos, true);
        }}
        onRechazar={() => {
          tracker.track('frio_recordatorio_rechazado', { n_elegibles: itemsElegibles.length }, 'cart');
          const datos = datosPedidoRef.current;
          if (datos) ejecutarPedido(datos, false);
        }}
        // Tocar fuera o el botón atrás: solo cierra. No es "no me interesa" —
        // eso crea el pedido, y un roce en el borde no puede mover plata. Si
        // vuelve a darle a Confirmar, el pedido sale sin frío sin repreguntar.
        onCerrar={() => {
          tracker.track('frio_recordatorio_cerrado', { n_elegibles: itemsElegibles.length }, 'cart');
          setMostrarRecordatorioFrio(false);
        }}
      />
    </View>
    </KeyboardAvoidingView>
  );
}
