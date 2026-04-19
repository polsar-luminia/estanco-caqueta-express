# Checkout — Bug hunt

## Resumen
- Total: 5 (P0: 2, P1: 2, P2: 1)
- Cobertura: `app/(tabs)/cart.tsx`, `app/(tabs)/orders/index.tsx`, `app/(tabs)/orders/[id].tsx`, `src/stores/cart.ts`, `src/lib/api.ts`, `src/components/CartItem.tsx`

## P0 — bloqueantes

### [CHECK-001] Monto mínimo pedido hardcodeado diverge de configuración servidor
- **Archivo:** `app/(tabs)/cart.tsx:69-73, 106-108, 525-527, 535, 540, 560`
- **Síntoma:** App solo consulta `envio_gratis_minimo` y `envio_costo` de `/configuracion-app` pero NOT `pedido_minimo`. Usa hardcodeado 30000 en 6 lugares. Si servidor cambia monto mínimo a 50000 (ej. promoción flash), app permite crear pedido con 30000 que luego falla con "Cantidad inválida" en POST.
- **Causa raíz:** Endpoint `/configuracion-app` devuelve: `{ envio_gratis_minimo, envio_costo }` pero NO incluye `pedido_minimo`. Interfaz `getConfigApp()` en `api.ts:394-396` no lo define. Frontend implementó fallback hardcodeado.
- **Reproducción:** 1) Cambiar monto mínimo en backend a 50000. 2) User agrega items por 35000. 3) Button "Confirmar pedido" está habilitado. 4) User hace click. 5) POST `/pedidos` falla con "Cantidad inválida" o similar error de validación servidor. 6) Carrito NO se limpia, quedando con items y estado corrupto.
- **Fix propuesto:** Extender respuesta de `/configuracion-app` para incluir `pedido_minimo: number`. Actualizar tipo en `api.ts`. Reemplazar todos los hardcodeados 30000 con `configApp?.pedido_minimo ?? 30000`.
- **Esfuerzo:** trivial (backend: +1 field, frontend: search-replace + 1 constante)

### [CHECK-002] Tienda cerrada sin resetear UI lock causa botón congelado
- **Archivo:** `app/(tabs)/cart.tsx:140-146`
- **Síntoma:** Si `getEstadoTienda()` retorna `abierta: false` en línea 142, se hace `return` en línea 145 pero `setLoading(false)` NO se ejecuta. Botón queda con spinner "Enviando..." indefinidamente. User no puede intentar de nuevo sin recargar. `submitLockRef` SÍ se resetea en `finally` pero `setLoading` no.
- **Causa raíz:** Early return en línea 145 salta el `finally` block. Aunque `finally` ejecuta, `setLoading` es true desde línea 139 y nunca se pone en false.
- **Reproducción:** 1) Tienda abierta. 2) User llena carrito, confirma pedido. 3) EXACTAMENTE en ese moment tienda se cierra (cambio en backend). 4) getEstadoTienda() retorna closed. 5) Toast muestra "Tienda cerrada" pero botón queda congelado con "Enviando..."
- **Fix propuesto:** Antes de `return` en línea 145, ejecutar: `submitLockRef.current = false; setLoading(false);` O refactorizar para NO usar early returns y confiar en finally.
- **Esfuerzo:** trivial

## P1

### [CHECK-003] CartItem permite incrementar cantidad SIN validación de stock
- **Archivo:** `src/components/CartItem.tsx:84, src/stores/cart.ts:6-12`
- **Síntoma:** User puede hacer click en + ilimitadamente para aumentar cantidad de un producto. Interfaz CartItem NO almacena ni valida `stock_total`. Si hay 5 unidades en stock y user incrementa a 10, carrito acepta. POST `/pedidos` falla con "Stock insuficiente" luego.
- **Causa raíz:** Estructura `CartItem` (interface en `cart.ts:6-12`) no incluye `stock_total`. Botón + (línea 84) no tiene `disabled` attribute. Componente CartItem no conoce stock de producto.
- **Reproducción:** 1) User abre producto con 5 stock. 2) Agrega cantidad 5 al carrito. 3) En Cart, hace 10x click en +. 4) Cantidad llega a 15. 5) Intenta confirmar pedido. 6) POST falla, pero carrito ya mostró cantidad 15 y cálculo de total.
- **Fix propuesto:** Pasar `stock_total` en CartItem. Deshabilitar botón + cuando `item.cantidad >= item.stock_total`. (O mejor: refetch stock fresco en crearPedido() para double-check antes de POST.)
- **Esfuerzo:** medio

### [CHECK-004] Nuevo pedido NO invalida query cache, retrasa aparición en pantalla órdenes
- **Archivo:** `app/(tabs)/cart.tsx:184`
- **Síntoma:** User confirma pedido. POST exitoso. Router empuja a `/(tabs)/orders`. Pero pantalla muestra lista vieja (cached) hasta 30 segundos (refetchInterval). Usuario no ve su pedido recién creado inmediatamente aunque debería.
- **Causa raíz:** `crearPedido()` en cart.tsx NO importa `useQueryClient` ni invalida `["pedidos"]` query. Orders screen usa `refetchInterval: 30_000` pero sin `staleTime` explícito, cache está "fresh" por defecto.
- **Reproducción:** 1) User abre Orders (lista vacía o 2 pedidos viejos). 2) Va a Cart, confirma pedido. 3) Aparece Toast "Pedido confirmado #123". 4) Router.push a Orders. 5) Sigue mostrando lista vieja. 6) Espera 30s o hace manual refresh para ver #123.
- **Fix propuesto:** En cart.tsx handlePedir(), después de `crearPedido()` exitoso, importar `useQueryClient` y hacer: `queryClient.invalidateQueries({ queryKey: ["pedidos"] })` ANTES de `router.push()`.
- **Esfuerzo:** trivial

## P2

### [CHECK-005] Navegación a detalle de pedido con ID inválido no valida entrada
- **Archivo:** `app/(tabs)/orders/[id].tsx:40-48`
- **Síntoma:** Si URL es `/orders/abc` (string no-numérico), código valida `Number.isFinite(pedidoId) && pedidoId > 0` pero `Number("abc")` es `NaN`, query nunca se ejecuta. User ve pantalla en blanco o "Pedido no encontrado". Es manejo correcto pero sin feedback UI claro en rutas malformadas.
- **Causa raíz:** No es un bug per se; la validación funciona. Pero `enabled: Number.isFinite(pedidoId) && pedidoId > 0` desactiva query silenciosamente sin user feedback durante el disabled state. Debería mostrar una UI de error específica.
- **Reproducción:** 1) User deep-links a /orders/xyz o recibe URL malformada. 2) Pantalla se queda en skeleton de carga indefinido. 3) No hay error message.
- **Fix propuesto:** Cambiar lógica de `enabled` para siempre ejecutar la query pero en queryFn validar e informar al user. O mostrar ErrorState cuando `pedidoId` no es válido ANTES del query.
- **Esfuerzo:** medio (mejor UX pero no critical)

## Observaciones
- **Ya arreglados:** Doble-submit (submitLockRef), /tienda/estado 404, /configuracion-app 404, SQL precio_lista1
- **Bajo prueba:** El lock de submitLockRef funciona bien en handlePedir, pero BUG #2 lo puede saltar parcialmente vía early return + loading state
- **Recomendación:** Configurar getConfigApp() para devolver `{ pedido_minimo, envio_gratis_minimo, envio_costo }` y extender tipo. Esto también permite futuras promos con monto dinámico.
- **Risk: Stock en carrito** es P1 porque user experience se degrada: calcula total incorrecto, intenta confirmar, falla. No es P0 porque servidor valida, pero requiere user experiencia mejorada.
