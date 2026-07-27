import { useState, useRef, useEffect } from "react";
import { View, Text, FlatList, TextInput, Pressable, Switch, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter, Redirect } from "expo-router";
import * as Sentry from "@sentry/react-native";
import { useQuery, useQueries, useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
import { Feather } from "@expo/vector-icons";
import Toast from "react-native-toast-message";
import { useCartStore } from "../../src/stores/cart";
import { useAuthStore } from "../../src/stores/auth";
import { useTiendaAbierta } from "../../src/hooks/useTiendaAbierta";
import { crearPedido, getDirecciones, crearDireccion, validarCupon, getConfigApp, getEstadoTienda, getProducto, ubicacionABody, validarCobertura, getFrioCarrito, getEtaActual, type DireccionGuardada, type CuponValidado, type UbicacionCapturada } from "../../src/lib/api";
import { calcularResumen, envioDeZona } from "../../src/lib/resumenPedido";
import { FrioRecordatorio } from "../../src/components/FrioRecordatorio";
import { UbicacionButton } from "../../src/components/UbicacionButton";
import { nuevoUuidV4 } from "../../src/lib/uuid";
import { tracker } from "../../src/lib/tracker";
import { metaLogInitiateCheckout, metaLogPurchase } from "../../src/lib/metaEvents";
import { TruckIcon, TagIcon } from "../../src/components/icons/AppIcons";
import { CartIcon } from "../../src/components/icons/TabIcons";
import { formatCOP } from "../../src/lib/format";
import { CartItem } from "../../src/components/CartItem";
import { BandaCerrado } from "../../src/components/BandaCerrado";
import { colors, shadows } from "../../src/constants/theme";

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

export default function CartScreen() {
  const router = useRouter();
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
    if (huboCambioPrecio || huboCambioStock) {
      Toast.show({
        type: "info",
        text1: huboCambioStock && !huboCambioPrecio ? "Stock actualizado" : "Carrito actualizado",
        text2: huboCambioStock
          ? "Algunos productos cambiaron de stock o precio"
          : "Algunos productos cambiaron de precio",
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productosCheck.map((q) => q.dataUpdatedAt).join(","), items.length]);
  const [loading, setLoading] = useState(false);
  const [usarPuntos, setUsarPuntos] = useState(false);
  const [mostrarNueva, setMostrarNueva] = useState(false);
  const [nuevaDireccion, setNuevaDireccion] = useState("");
  const [nuevasNotas, setNuevasNotas] = useState("");
  const [nuevaUbicacion, setNuevaUbicacion] = useState<UbicacionCapturada | null>(null);
  // Frío asegurado: intención del cliente. No se persiste entre sesiones.
  const [quiereFrio, setQuiereFrio] = useState(false);
  const [mostrarRecordatorioFrio, setMostrarRecordatorioFrio] = useState(false);
  const [codigoCupon, setCodigoCupon] = useState("");
  const [cuponValidado, setCuponValidado] = useState<CuponValidado | null>(null);
  const [cuponError, setCuponError] = useState("");
  const [validandoCupon, setValidandoCupon] = useState(false);
  const cuponSubtotalRef = useRef<number | null>(null);
  const queryClient = useQueryClient();

  const tienda = useTiendaAbierta();

  const { data: configApp } = useQuery({
    queryKey: ['config-app'],
    queryFn: getConfigApp,
    staleTime: 5 * 60 * 1000,
  });

  const { data: direcciones = [], refetch: refetchDirs } = useQuery({
    queryKey: ["direcciones"],
    queryFn: getDirecciones,
    enabled: isAuthenticated,
  });

  const dirPredeterminada = direcciones.find((d) => d.predeterminada) || direcciones[0];
  const dirSeleccionada = direccionId ? direcciones.find((d) => d.id === direccionId) ?? null : null;
  const dirActiva = dirSeleccionada || dirPredeterminada;

  const subtotal = subtotalComputed;
  const puntos = cliente?.puntos || 0;
  const puedeUsarPuntos = puntos >= 200;
  const envioGratisMinimo = configApp?.envio_gratis_minimo ?? 150000;
  const envioCostoGlobal = configApp?.envio_costo ?? 5000;
  const pedidoMinimo = configApp?.pedido_minimo ?? 30000;

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
  const envio = resumen.envio;
  const total = resumen.total;

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
      tracker.track('cupon_aplicado', { cupon_codigo: result.cupon.codigo, descuento: result.descuento }, 'cart');
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
  // checkout_iniciado: una sola vez por intento de pedido, igual que el de Meta.
  // Se libera al crear el pedido para que el siguiente pedido vuelva a contarse.
  const checkoutIniciadoRef = useRef(false);
  // Composición de carrito para la que ya se mostró el recordatorio de frío. Un
  // modal que reaparece encima del botón de comprar es la forma más rápida de que
  // desinstalen la app.
  const recordatorioMostradoRef = useRef<string | null>(null);
  // Datos ya validados del pedido, a la espera de que el cliente responda la tarjeta.
  const datosPedidoRef = useRef<DatosPedido | null>(null);

  const handlePedir = async () => {
    if (submitLockRef.current) return;

    // A.2 — base del embudo de checkout: intención real de pedir. Una vez por
    // intento; un reintento tras un fallo no vuelve a contarlo.
    if (!checkoutIniciadoRef.current) {
      checkoutIniciadoRef.current = true;
      tracker.track('checkout_iniciado', { items_count: items.length, subtotal }, 'cart');
    }

    // Guía 5.1.1(v) — requerir login solo al momento del checkout
    if (!cliente) {
      tracker.track('checkout_abandonado', { paso: 'login', items_count: items.length }, 'cart');
      router.push("/(auth)/login");
      return;
    }

    if (subtotal < pedidoMinimo) {
      tracker.track('checkout_abandonado', { paso: 'pedido_minimo', items_count: items.length }, 'cart');
      Toast.show({ type: "error", text1: "Pedido mínimo", text2: `Agrega ${formatCOP(pedidoMinimo - subtotal)} más para continuar` });
      return;
    }

    const dir = dirActiva?.direccion || direccion.trim();
    const not = dirActiva?.notas || notas.trim();

    if (!dir && !mostrarNueva) {
      tracker.track('checkout_abandonado', { paso: 'sin_direccion', items_count: items.length }, 'cart');
      Toast.show({ type: "error", text1: "Falta direccion", text2: "Selecciona o agrega una direccion" });
      return;
    }
    // GPS-first: en una dirección nueva basta con la ubicación capturada O una
    // dirección escrita. Ya no se pide barrio (la cobertura se calcula del GPS).
    if (mostrarNueva && !nuevaDireccion.trim() && !nuevaUbicacion) {
      tracker.track('checkout_abandonado', { paso: 'sin_ubicacion', items_count: items.length }, 'cart');
      Toast.show({ type: "error", text1: "Falta la ubicación", text2: "Usa tu ubicación actual o escribe la dirección" });
      return;
    }
    if (items.length === 0) return;

    const dirFinal = mostrarNueva
      ? (nuevaDireccion.trim() || nuevaUbicacion?.geocoded_direccion || "Ubicación en el mapa")
      : dir;
    const notFinal = mostrarNueva ? nuevasNotas.trim() : not;

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
      setNuevaUbicacion(null);
      tracker.track('pedido_creado', { pedido_id: pedido.id, total: pedido.total, items_count: items.length, uso_cupon: !!cuponValidado, uso_puntos: usarPuntos && puedeUsarPuntos }, 'cart');
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
      Toast.show({ type: "error", text1: "Error al crear pedido", text2: msg });
    } finally {
      submitLockRef.current = false;
      setLoading(false);
    }
  };

  // Apple §5.1.1(v): el catálogo es público pero el checkout requiere sesión.
  // Items en el cart (Zustand persistido) sobreviven el login y se mantienen
  // disponibles al volver. Bloqueamos cart únicamente cuando hay items pendientes
  // (un guest que solo abre el tab ve la pantalla vacía y puede volver a explorar).
  if (isAuthLoading) return null;
  if (!isAuthenticated && items.length > 0) {
    return <Redirect href="/(auth)/login" />;
  }

  if (items.length === 0) {
    return (
      <View className="flex-1 items-center justify-center px-6" style={{ backgroundColor: colors.bg }}>
        <CartIcon color="#BCCABA" size={48} />
        <Text style={{ fontSize: 20, fontWeight: "700", color: "#6D7B6C", marginBottom: 6 }}>Carrito vacío</Text>
        <Text style={{ color: "#BCCABA", textAlign: "center", fontSize: 14 }}>
          Agrega productos desde el catálogo para hacer tu pedido
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={80}
      style={{ flex: 1 }}
    >
    <View className="flex-1" style={{ backgroundColor: colors.bg }}>
      <FlatList automaticallyAdjustKeyboardInsets keyboardDismissMode="interactive"
        data={items}
        keyExtractor={(item) => String(item.productoId)}
        contentContainerStyle={{ padding: 16, paddingBottom: 200 }}
        ListHeaderComponent={
          <Text style={{ fontSize: 22, fontWeight: "800", color: "#1A1C1A", marginBottom: 16, letterSpacing: -0.5 }}>
            Tu Carrito
          </Text>
        }
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        renderItem={({ item }) => <CartItem item={item} />}
        ListFooterComponent={
          <View style={{ gap: 24, marginTop: 24 }}>
            {/* Delivery - Direcciones Guardadas */}
            <View className="p-5 rounded-2xl" style={{ backgroundColor: colors.surface, ...shadows.card }}>
              <View className="flex-row items-center justify-between mb-4">
                <View className="flex-row items-center">
                  <TruckIcon color="#1A1C1A" size={20} />
                  <Text style={{ fontSize: 18, fontWeight: "700", color: "#1A1C1A" }}>Entrega</Text>
                </View>
                <Pressable
                  onPress={() => setMostrarNueva(!mostrarNueva)}
                  accessibilityRole="button"
                  accessibilityLabel={mostrarNueva ? "Usar una dirección guardada" : "Agregar una dirección nueva"}
                  // Es solo un texto de 12 px dentro del encabezado: crece el
                  // objetivo táctil sin mover la fila.
                  hitSlop={12}
                >
                  <Text style={{ fontSize: 12, fontWeight: "700", color: "#1FAF55" }}>
                    {mostrarNueva ? "Usar guardada" : "+ Nueva"}
                  </Text>
                </Pressable>
              </View>

              {!mostrarNueva ? (
                <>
                  {/* Direcciones guardadas */}
                  {direcciones.length > 0 ? (
                    <View style={{ gap: 8 }}>
                      {direcciones.map((d) => {
                        const selected = dirActiva?.id === d.id;
                        return (
                          <Pressable
                            key={d.id}
                            onPress={() => {
                              setDireccionId(d.id);
                              // con_pin responde si la dirección ya tiene coordenadas: es
                              // el numerador de "cuántas hay que mandar al mapa" (bloque F).
                              tracker.track('direccion_seleccionada', { direccion_id: d.id, con_pin: d.lat != null }, 'cart');
                            }}
                            accessibilityRole="radio"
                            accessibilityState={{ checked: selected }}
                            accessibilityLabel={`Entregar en ${d.etiqueta}: ${d.direccion}`}
                            className="flex-row items-center p-3 rounded-xl"
                            style={{
                              backgroundColor: "#fff",
                              borderWidth: 2,
                              borderColor: selected ? "#1FAF55" : "transparent",
                              minHeight: 44,
                            }}
                          >
                            <Feather name="map-pin" size={16} color={selected ? "#1FAF55" : "#9E9E9E"} />
                            <View className="flex-1 ml-3">
                              <View className="flex-row items-center" style={{ gap: 6 }}>
                                <Text style={{ fontSize: 13, fontWeight: "700", color: "#1A1C1A" }}>{d.etiqueta}</Text>
                                {d.predeterminada && (
                                  <View style={{ backgroundColor: "rgba(31,175,85,0.1)", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 }}>
                                    <Text style={{ fontSize: 12, fontWeight: "700", color: "#1FAF55" }}>DEFAULT</Text>
                                  </View>
                                )}
                                {d.lat != null && (
                                  <View style={{ flexDirection: "row", alignItems: "center", gap: 2, backgroundColor: "rgba(31,175,85,0.1)", borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}>
                                    <Feather name="map-pin" size={8} color="#1FAF55" />
                                    <Text style={{ fontSize: 12, fontWeight: "700", color: "#1FAF55" }}>CON UBICACIÓN</Text>
                                  </View>
                                )}
                              </View>
                              <Text style={{ fontSize: 12, color: "#6D7B6C", marginTop: 2 }} numberOfLines={1}>
                                {d.direccion}
                              </Text>
                            </View>
                            {selected && <Feather name="check-circle" size={18} color="#1FAF55" />}
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : (
                    <Pressable
                      onPress={() => setMostrarNueva(true)}
                      accessibilityRole="button"
                      accessibilityLabel="Agregar una dirección de entrega"
                      className="items-center py-6 rounded-xl bg-white"
                    >
                      <Feather name="plus-circle" size={24} color="#1FAF55" />
                      <Text style={{ fontSize: 13, fontWeight: "600", color: "#1FAF55", marginTop: 6 }}>
                        Agregar dirección
                      </Text>
                    </Pressable>
                  )}
                </>
              ) : (
                <>
                  {/* Nueva dirección */}
                  {/* Ubicación GPS (opcional): al capturar, auto-llena la dirección (editable). */}
                  <UbicacionButton
                    value={nuevaUbicacion}
                    onChange={(u) => {
                      setNuevaUbicacion(u);
                      // Punto del mapa (pin_mapa) siempre reescribe; GPS solo si está vacía.
                      if (u?.geocoded_direccion && (u.metodo_ubicacion === "pin_mapa" || !nuevaDireccion.trim())) {
                        setNuevaDireccion(u.geocoded_direccion);
                      }
                    }}
                  />
                  <Text style={{ fontSize: 12, fontWeight: "700", color: "#6D7B6C", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 6, marginLeft: 4 }}>
                    Dirección (referencia)
                  </Text>
                  <TextInput
                    style={{ backgroundColor: "#fff", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 14, color: "#1A1C1A", marginBottom: 12 }}
                    placeholder="Se llena con tu ubicación (o escríbela)"
                    placeholderTextColor="#BCCABA"
                    value={nuevaDireccion}
                    onChangeText={setNuevaDireccion}
                  />
                  <Text style={{ fontSize: 12, fontWeight: "700", color: "#6D7B6C", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 6, marginLeft: 4 }}>
                    Notas (Opcional)
                  </Text>
                  <TextInput
                    style={{ backgroundColor: "#fff", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 14, color: "#1A1C1A" }}
                    placeholder="Portería, dejar con vigilante..."
                    placeholderTextColor="#BCCABA"
                    value={nuevasNotas}
                    onChangeText={setNuevasNotas}
                    multiline
                    maxLength={200}
                  />
                </>
              )}
            </View>

            {/* Cupon de descuento */}
            <View className="p-5 rounded-2xl" style={{ backgroundColor: colors.surface, ...shadows.card }}>
              <View className="flex-row items-center mb-3">
                <TagIcon color="#1A1C1A" size={20} />
                <Text style={{ fontSize: 18, fontWeight: "700", color: "#1A1C1A" }}>Cupon</Text>
              </View>

              {cuponValidado ? (
                <View className="flex-row items-center p-3 rounded-xl bg-white" style={{ borderWidth: 2, borderColor: "#1FAF55" }}>
                  <Feather name="check-circle" size={18} color="#1FAF55" />
                  <View className="flex-1 ml-3">
                    <Text style={{ fontSize: 13, fontWeight: "700", color: "#1FAF55" }}>
                      {cuponValidado.cupon.codigo}
                    </Text>
                    <Text style={{ fontSize: 12, color: "#6D7B6C" }}>
                      {cuponValidado.cupon.descripcion || (cuponValidado.cupon.tipo === "porcentaje" ? `${cuponValidado.cupon.valor}% de descuento` : `${formatCOP(cuponValidado.cupon.valor)} de descuento`)}
                    </Text>
                  </View>
                  <Pressable onPress={handleQuitarCupon} accessibilityRole="button" accessibilityLabel="Quitar cupón" hitSlop={14}>
                    <Feather name="x-circle" size={18} color="#9E9E9E" />
                  </Pressable>
                </View>
              ) : (
                <View className="flex-row" style={{ gap: 8 }}>
                  <TextInput
                    style={{
                      flex: 1,
                      backgroundColor: "#fff",
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
                  />
                  <Pressable
                    onPress={handleValidarCupon}
                    disabled={validandoCupon || !codigoCupon.trim()}
                    accessibilityRole="button"
                    accessibilityLabel="Aplicar cupón"
                    accessibilityState={{ disabled: validandoCupon || !codigoCupon.trim() }}
                    style={{
                      backgroundColor: codigoCupon.trim() ? "#1FAF55" : "#E2E3DF",
                      borderRadius: 12,
                      paddingHorizontal: 16,
                      minHeight: 44,
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>
                      {validandoCupon ? "..." : "Aplicar"}
                    </Text>
                  </Pressable>
                </View>
              )}

              {cuponError ? (
                <Text style={{ fontSize: 12, color: colors.danger, marginTop: 6, marginLeft: 4 }}>{cuponError}</Text>
              ) : null}
            </View>

            {/* Barra progreso envio gratis */}
            {subtotal < envioGratisMinimo && envio > 0 ? (
              <View style={{ backgroundColor: '#F4F4F0', borderRadius: 12, padding: 12, marginBottom: 0 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={{ fontSize: 12, color: '#6D7B6C' }}>Faltan {formatCOP(envioGratisMinimo - subtotal)} para envío gratis</Text>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#1FAF55' }}>{formatCOP(envioGratisMinimo)}</Text>
                </View>
                <View style={{ height: 4, borderRadius: 2, backgroundColor: '#E2E3DF' }}>
                  <View style={{ height: 4, borderRadius: 2, backgroundColor: '#1FAF55', width: `${Math.min(100, (subtotal / envioGratisMinimo) * 100)}%` }} />
                </View>
              </View>
            ) : subtotal >= envioGratisMinimo ? (
              <View style={{ backgroundColor: '#F4F4F0', borderRadius: 12, padding: 12, alignItems: 'center' }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#1FAF55' }}>🎉 ¡Envío gratis!</Text>
              </View>
            ) : null}

            {/* Puntos + Envio */}
            <View className="rounded-2xl p-4 bg-white" style={{ ...shadows.card, gap: 12 }}>
              <View className="flex-row justify-between">
                <Text style={{ fontSize: 14, color: "#6D7B6C" }}>Subtotal</Text>
                <Text style={{ fontSize: 14, fontWeight: "600", color: "#1A1C1A" }}>{formatCOP(subtotal)}</Text>
              </View>
              {descuentoCupon > 0 && (
                <View className="flex-row justify-between">
                  <Text style={{ fontSize: 14, color: "#1FAF55" }}>Descuento cupon</Text>
                  <Text style={{ fontSize: 14, fontWeight: "600", color: "#1FAF55" }}>-{formatCOP(descuentoCupon)}</Text>
                </View>
              )}
              {eta && (
                <View className="flex-row justify-between items-center">
                  <Text style={{ fontSize: 14, color: "#6D7B6C" }}>Llega en</Text>
                  <Text style={{ fontSize: 14, fontWeight: "600", color: "#1A1C1A" }}>
                    {eta.min}–{eta.max} min
                  </Text>
                </View>
              )}
              <View className="flex-row justify-between items-center">
                <Text style={{ fontSize: 14, color: "#6D7B6C" }}>Envio</Text>
                <Text style={{ fontSize: 14, fontWeight: "600", color: envio === 0 ? "#1FAF55" : "#1A1C1A" }}>
                  {envio === 0 ? "¡Gratis!" : formatCOP(envio)}
                </Text>
              </View>

              {/* Frío asegurado. Si no hay nada elegible el check no se muestra:
                  nunca cobrar por aire. El texto dice exactamente qué va frío y
                  qué no, que es lo que pidió el negocio. */}
              {frioActivo && hayElegibles && (
                <View
                  className="rounded-xl p-3"
                  style={{ backgroundColor: quiereFrio ? "rgba(15,58,107,0.08)" : colors.lowfill }}
                >
                  {/* El Switch va como hermano del Pressable, no dentro: anidado,
                      un tap sobre él dispararía los dos handlers y el check
                      quedaría igual que antes. */}
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <Pressable
                      onPress={() => alternarFrio(!quiereFrio)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: quiereFrio }}
                      accessibilityLabel={`Asegurar frío por ${formatCOP(frioCosto)}`}
                      // Es un cargo, no una nota al pie: 44 pt de objetivo táctil.
                      style={{ flex: 1, minHeight: 44, justifyContent: "center" }}
                    >
                      <Text style={{ fontSize: 15, fontWeight: "700", color: "#1A1C1A" }}>
                        ¿Lo quieres frío? +{formatCOP(frioCosto)}
                      </Text>
                      <Text style={{ fontSize: 14, lineHeight: 19, color: "#6D7B6C", marginTop: 3 }}>
                        {todosElegibles
                          ? "Todo tu pedido va frío."
                          : `Aseguramos frío para: ${itemsElegibles.map((i) => i.nombre).slice(0, 3).join(", ")}${itemsElegibles.length > 3 ? ` y ${itemsElegibles.length - 3} más` : ""}. El resto de tu pedido va a temperatura ambiente.`}
                      </Text>
                    </Pressable>
                    <Switch
                      value={quiereFrio}
                      onValueChange={alternarFrio}
                      accessibilityLabel={`Asegurar frío por ${formatCOP(frioCosto)}`}
                      trackColor={{ false: "#E2E3DF", true: "#0F3A6B" }}
                      thumbColor="#fff"
                    />
                  </View>
                </View>
              )}

              {resumen.frio > 0 && (
                <View className="flex-row justify-between items-center">
                  <Text style={{ fontSize: 14, color: "#6D7B6C" }}>Frío asegurado</Text>
                  <Text style={{ fontSize: 14, fontWeight: "600", color: "#0F3A6B" }}>
                    {formatCOP(resumen.frio)}
                  </Text>
                </View>
              )}
              {puedeUsarPuntos && subtotal < envioGratisMinimo && (
                <View className="flex-row justify-between items-center rounded-xl p-3" style={{ backgroundColor: colors.lowfill }}>
                  <View className="flex-1">
                    <Text style={{ fontSize: 13, fontWeight: "600", color: "#1A1C1A" }}>Usar 200 puntos</Text>
                    <Text style={{ fontSize: 12, color: "#6D7B6C" }}>Envío gratis (tienes {puntos} pts)</Text>
                  </View>
                  <Switch
                    value={usarPuntos}
                    onValueChange={setUsarPuntos}
                    trackColor={{ false: "#E2E3DF", true: "#1FAF55" }}
                    thumbColor="#fff"
                  />
                </View>
              )}
              {!puedeUsarPuntos && puntos > 0 && subtotal < envioGratisMinimo && (
                <Text style={{ fontSize: 12, color: "#6D7B6C", fontStyle: "italic" }}>
                  Tienes {puntos} pts. Necesitas 200 para envío gratis.
                </Text>
              )}
            </View>

            {/* Express Banner */}
            <LinearGradient
              colors={["#1FAF55", "#006D30"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ borderRadius: 16, padding: 20, overflow: "hidden" }}
            >
              <View className="flex-row items-center">
                <View className="flex-1">
                  <Text style={{ fontSize: 12, fontWeight: "700", color: "rgba(255,255,255,0.7)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>
                    Express Delivery
                  </Text>
                  <Text style={{ fontSize: 17, fontWeight: "700", color: "#fff", lineHeight: 22 }}>
                    Domicilio en Florencia
                  </Text>
                  <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.85)", marginTop: 4 }}>
                    Efectivo, QR o datáfono contra entrega.
                  </Text>
                </View>
                <Text style={{ fontSize: 40, opacity: 0.2 }}>⚡</Text>
              </View>
            </LinearGradient>
          </View>
        }
      />

      {/* Sticky Bottom */}
      <View
        className="bg-white px-6 pt-4"
        style={{
          paddingBottom: 80,
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

        <View className="flex-row justify-between items-end mb-4">
          <View>
            <Text style={{ fontSize: 12, fontWeight: "600", color: "#6D7B6C", textTransform: "uppercase", letterSpacing: 1.5 }}>
              Total a pagar
            </Text>
            <Text style={{ fontSize: 28, fontWeight: "800", color: colors.ink, letterSpacing: -1 }}>
              {formatCOP(total)}
            </Text>
            {(() => {
              const ahorroEnvio = envio === 0 ? envioCosto : 0;
              const totalAhorro = descuentoCupon + ahorroEnvio;
              return totalAhorro > 0 ? (
                <Text style={{ fontSize: 12, fontWeight: "700", color: "#1FAF55", marginTop: 2 }}>
                  Ahorras {formatCOP(totalAhorro)} 🎉
                </Text>
              ) : null;
            })()}
          </View>
          <View>
            <Text style={{ fontSize: 12, color: "#6D7B6C", fontStyle: "italic" }}>
              {envio === 0 ? "Envío gratis con puntos 🎉" : `Incluye domicilio (${formatCOP(envio)})`}
            </Text>
            {resumen.frio > 0 && (
              <Text style={{ fontSize: 12, color: "#0F3A6B", fontWeight: "600", marginTop: 2 }}>
                Incluye frío asegurado ({formatCOP(resumen.frio)})
              </Text>
            )}
            {subtotal < pedidoMinimo && (
              <Text style={{ fontSize: 12, color: colors.offer, fontWeight: "600", marginTop: 2 }}>
                Pedido mínimo: {formatCOP(pedidoMinimo)} (faltan {formatCOP(pedidoMinimo - subtotal)})
              </Text>
            )}
          </View>
        </View>

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
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 17, marginRight: 8 }}>
              {loading ? "Enviando..." : !tienda.abierta ? "Tienda cerrada" : subtotal < pedidoMinimo ? `Faltan ${formatCOP(pedidoMinimo - subtotal)}` : "Confirmar pedido"}
            </Text>
            {!loading && tienda.abierta && <ChevronRightIcon />}
          </LinearGradient>
        </Pressable>
      </View>

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
      />
    </View>
    </KeyboardAvoidingView>
  );
}
