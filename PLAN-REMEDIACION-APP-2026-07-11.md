# 📱 Plan de Remediación — App Estanco Caquetá Express

> **Fecha:** 2026-07-11
> **Alcance:** frontend React Native/Expo (`estanco-caqueta-express`) + un cambio de contrato en el backend (`polo-api`) para el Ítem #5, y el **rebuild del binario para el SDK de Meta**.
> **Contexto previo:** la auditoría de seguridad del VPS/backend ya se ejecutó y cerró (ver `REPORTE-REMEDIACION-2026-07-11.md`). **Este plan cubre lo que quedó del lado de la app.**
> **Objetivo de negocio:** dejar la app lista para **meterle pauta paga** (Meta Ads) sin fugas de conversión ni bugs en el funnel.

---

## ⭐ Decisión de release (2026-07-11, final)

**La app aún NO salió en forma a ventas.** Por eso se descarta el enfoque de parchar por OTA en vivo. **Estrategia definitiva: dejar TODO implementado, probado y listo, y lanzar con un único build nativo limpio** (`1.0.2`) que incluye absolutamente todo — los fixes de la app **+ el SDK de Meta + el backend del #5 + el Ítem 8 coordinado**. Sin apuro, hecho bien de una.

**Implicaciones:**
- **Se acaba la distinción "Tren A / Tren B".** Todo entra en el **mismo build de lanzamiento**. Las etiquetas "OTA-safe" de abajo quedan solo como referencia (indican qué *podría* ir por OTA en el futuro post-lanzamiento), pero **ahora todo se buildea junto**.
- **El SDK de Meta ya NO está diferido** — entra en el build de lanzamiento, que es justo lo que se quiere para que la pauta arranque con alcance iOS y atribución correctos desde el día 1.
- **Backend del #5** (`precio_vigente` en catálogo + cobro en `pedidos.js`) y **parche Ítem 8** se despliegan al servidor coordinados con el lanzamiento.
- **Meta de calidad:** cada ítem se implementa **con su prueba** (unit donde aplique + QA en dispositivo físico) antes de marcar ✅. La checklist de §5 es la puerta de salida al lanzamiento.

**Objetivo:** que el día que enciendan la pauta, el funnel completo (invitado → carrito → login → checkout → oferta) esté impecable y medido, sin deuda pendiente.

---

## 0. Contexto para quien llega sin historia

**La app.** E-commerce de domicilios (licores/snacks) en Florencia, Caquetá. Stack: React Native + Expo SDK 55, expo-router (rutas en `/app`), Zustand (`/src/stores`), TanStack Query, NativeWind. Cliente API en `src/lib/api.ts`. Backend REST propio en `https://api.estancocaqueta.com/api/v1` (Node/Express + PostgreSQL, monorepo `/opt/polo` en el VPS `38.242.248.138`). Auth: JWT Bearer de 7 días en `expo-secure-store` (clave `auth_token`), con **sesiones revocables server-side**.

**Qué YA se arregló en el backend** (no repetir, ya está vivo y verificado):
- ✅ `DELETE /clientes/push-token` existe; `logout` desactiva push tokens; `push_tokens` con `UNIQUE(token)`; crons de marketing exigen sesión viva → **el bug de notificaciones a sesiones cerradas está cerrado desde el server**.
- ✅ `idempotency()` montado en `POST /pedidos` (la tabla `idempotency_keys` cachea por `(key, cliente_id)`, TTL 24h).
- ✅ Guard `usar_puntos`: el backend ya **no** quema 200 puntos si el envío ya era gratis por monto.

**Qué queda (este plan):** los fixes que son puramente de la app, más un cambio de contrato de precios (#5) y el rebuild del SDK de Meta. **Ninguno de estos lo resuelve el backend por sí solo.**

**Dos trenes de release** (ver §5 — es la decisión operativa clave):
- **Tren A — OTA (EAS Update):** todo lo que es JS puro. `runtimeVersion` es `appVersion` = `1.0.1`, así que un `eas update` llega a los binarios `1.0.1` que ya están en las tiendas **sin pasar por review**. Aquí entran #1, #5-frontend, #6, #8, #10, #12, #13, 🔵 y el Ítem 8.
- **Tren B — Build nativo + reenvío a tiendas:** el **SDK de Meta** exige un binario nuevo (no se puede OTA). Sube `version` a `1.0.2` / `buildNumber` 55 / `versionCode` 55 y pasa por App Store + Play review.

---

## 1. Tablero de ítems

Todo va en el **build de lanzamiento `1.0.2`**. La columna "OTA-safe" es solo referencia futura (post-lanzamiento); ahora se buildea todo junto.

| # | Sev | Ítem | Capa | OTA-safe | Estado |
|---|-----|------|------|----------|--------|
| 1 | 🔴 | Login fallido borra el carrito | Frontend | sí | ✅ hecho (`release/1.0.2`, +2 tests) |
| 5 | 🟠 | Precio de oferta se revierte (latente) | Backend + Frontend | sí | 🟡 **frontend hecho** / backend pendiente |
| 6 | 🟠 | Sesión no se re-hidrata al volver la red | Frontend | sí | ✅ hecho |
| 8 | 🟠 | Reintento de checkout duplica direcciones | Frontend | sí | ✅ hecho |
| 10 | 🟡 | Término de búsqueda no llega a analytics | Frontend | sí | ✅ hecho (+2 tests) |
| 12 | 🟡 | `addItem` con stock 0 crea item fantasma | Frontend | sí | ✅ hecho |
| 13 | 🟡 | Polling 15s en pedido ya entregado | Frontend | sí | ✅ hecho |
| 🔵 | 🔵 | Voseo, versión hardcodeada, fallback img, a11y, safe-area | Frontend | sí | ✅ hecho |
| **M** | 🔴 | **SDK de Meta: rebuild + config** | Nativo | no (build) | ✅ **config hecha** (fijado 13.4.3, v1.0.2/55, 2 bugs del SDK corregidos) — falta el `eas build`+submit |
| 8-be | 🟡 | Anti-enumeración reset (coordinar con backend) | Front + Backend | sí | 🟡 **frontend hecho** / deploy backend pendiente |
| ★ | — | Fix harness de tests (cart/auth rotos desde commit de Meta) | Frontend | sí | ✅ hecho (mocks fbsdk/ATT) |

**Orden de implementación:** #1 → #6/#8/#5 → 🟡 → 🔵 → Ítem 8 → **M (Meta)** → build `1.0.2` → QA completa → lanzamiento.

**Pendiente (todo lo demás ✅ en `release/1.0.2`):**
1. **Backend #5** — `precio_vigente` en `catalogo.js` + cobrarlo en `pedidos.js` (deploy de servidor). ⚠️ Toca el path de cobro en producción — requiere revisión/confirmación antes de aplicar.
2. **Deploy backend Ítem 8** — parche anti-enumeración (`Seguridad DistriPolsar/PENDIENTE-item8-...`). El frontend ya tolera ambas respuestas, así que se puede desplegar en cualquier momento.
3. **`eas build --platform all` + `eas submit`** del `1.0.2`, luego QA en dispositivo físico (checklist §5) y verificación en Meta Events Manager.

---

## 2. Ítems de frontend (detalle accionable)

### 🔴 #1 — Un login fallido borra el carrito

**Problema.** El handler global de 401 en `apiFetch` se dispara ante **cualquier** 401, incluido el de `/clientes/login` con contraseña incorrecta. Ese handler corre `runLogoutHandlers()`, que **limpia el carrito y la cache de queries**.

**Impacto al usuario / negocio.** Invitado llena el carrito → `cart.tsx` lo manda a login → se equivoca de contraseña **una vez** → carrito borrado. Al entrar bien, el carrito está vacío. Con pauta activa, cada carrito borrado es plata de anuncio quemada en el paso más caliente del funnel. **Es la prioridad #1 de la app.**

**Causa raíz.** [`src/lib/api.ts:72-87`](src/lib/api.ts) — el bloque `if (res.status === 401)` llama `removeToken()` + `_onUnauthorized?.()` sin discriminar el endpoint ni si la request llevaba token.

**Fix.** Solo invalidar la sesión cuando la request **iba autenticada a un endpoint protegido**. Un login fallido no lleva token de sesión válido; los endpoints de auth nunca deben tumbar la sesión.

```ts
// src/lib/api.ts — dentro de apiFetch, reemplazar el bloque 401
if (res.status === 401) {
  // Los 401 de endpoints de autenticación (login/registro/reset) NO deben
  // disparar el logout global: son "credenciales inválidas", no "sesión caída".
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
```

**Criterios de aceptación.**
- Con carrito lleno (invitado o logueado), un login con contraseña incorrecta muestra el toast de error **y el carrito sigue intacto**.
- Un 401 real en un endpoint protegido (token vencido/revocado) **sí** desloguea (comportamiento actual preservado).
- El mensaje "Teléfono o contraseña incorrectos" se sigue mostrando en la pantalla de login.

**Prueba manual.** 1) Agregar 2 productos. 2) Ir a checkout → login. 3) Meter contraseña mala → ver error. 4) Meter contraseña buena → **carrito con los 2 productos**. 5) Aparte: forzar token inválido (editar SecureStore o esperar expiración) y confirmar que un GET protegido sí desloguea.

**Test unitario** (hay `src/lib/__tests__/api.test.ts`): agregar caso "401 en /clientes/login no llama al unauthorized handler; 401 en /clientes/perfil sí".

---

### 🟠 #5 — El precio de oferta se revierte en el carrito (hoy LATENTE)

**Estado real (importante).** A hoy, **no hay ofertas ni combos activos con precio menor a `precio_app`**: el negocio hornea el descuento dentro de `precio_app` y usa `precio_oferta`/`precio_anterior` solo para el tachado. Por eso el bug **no está causando cobros de más hoy**. Pero el modelo de datos permite que `ofertas.precio_oferta` / `combos.precio_combo` sean **menores** que `precio_app`, y **el primer día que creen una oferta "real" así, la app cobra de más**:

1. La UI agrega al carrito con el precio rebajado (`precio_oferta` / `?ofertaPrecio=` del combo).
2. `cart.tsx` refresca precios contra `GET /catalogo/productos/:id`, que devuelve `precio_app` (el alto) y **sobrescribe** el precio de oferta → toast "Algunos productos cambiaron de precio".
3. `POST /pedidos` **también** cobra `precio_app` ([`pedidos.js`](../../opt/polo/src/packages/api/src/routes/pedidos.js): `precioUnitario = Number(producto.precio_app)`), ignorando la oferta.

**Impacto.** El cliente que entró por un anuncio de oferta ve el descuento esfumarse al abrir el carrito y **paga el precio full**. Erosiona la conversión del tráfico más caro y genera reclamos ("me subieron el precio"). Como la pauta va a empujar ofertas, es una bomba de tiempo.

**Causa raíz.** No hay una **única fuente de verdad de precio**. Tres capas usan fuentes distintas:
- Display de oferta: `ofertas.precio_oferta` / `combos.precio_combo`.
- Refresh del carrito: [`app/(tabs)/cart.tsx:57-87`](app/(tabs)/cart.tsx) usa `q.data.precio_app`.
- Cobro: `pedidos.js` usa `p.precio_app`.

**Fix — contrato `precio_vigente` (una sola fuente de verdad).**

**Backend (parte 1/2).** En `GET /catalogo/productos/:id` (y `/productos`, `/destacados`, `/buscar`, `/sugerencias`) agregar `precio_vigente` = el menor entre `precio_app` y cualquier oferta/combo activo:

```sql
-- Fragmento reutilizable en catalogo.js (definir como const PRECIO_VIGENTE)
LEAST(
  p.precio_app,
  COALESCE((
    SELECT MIN(o.precio_oferta) FROM ofertas o
     WHERE o.producto_id = p.id AND o.activo = true
       AND o.precio_oferta IS NOT NULL
       AND (o.fecha_inicio IS NULL OR o.fecha_inicio <= now())
       AND (o.fecha_fin    IS NULL OR o.fecha_fin    >= now())
  ), p.precio_app),
  COALESCE((
    SELECT MIN(co.precio_combo) FROM combos co
     WHERE co.producto_id = p.id AND co.precio_combo IS NOT NULL
       AND (co.fecha_inicio IS NULL OR co.fecha_inicio <= now())
       AND (co.fecha_fin    IS NULL OR co.fecha_fin    >= now())
  ), p.precio_app)
) AS precio_vigente
```

**Backend (parte 2/2 — la crítica).** `pedidos.js` debe **cobrar `precio_vigente`, no `precio_app`**, recomputándolo dentro de la transacción (mismo `FOR UPDATE`). Sin esto, aunque la app muestre bien, el backend seguiría cobrando de más. Aplicar el mismo `LEAST(...)` en la query de productos del checkout y usar ese valor como `precioUnitario`.

> ⚠️ **Decisión de negocio requerida:** confirmar con el dueño que las ofertas **deben honrarse al cobrar** (esperado para e-commerce). Si por alguna razón el modelo es "el descuento siempre va en `precio_app`", entonces la tabla `ofertas.precio_oferta` no debe poder ser menor que `precio_app` — agregar un `CHECK`/validación en el admin. Recomendado: honrar `precio_vigente` en ambos lados.

**Frontend.** En `cart.tsx`, comparar contra `precio_vigente` (con fallback a `precio_app` para builds viejos del backend):

```ts
// app/(tabs)/cart.tsx — dentro del useEffect de productosCheck (~línea 63)
const nuevoPrecio = q.data.precio_vigente ?? q.data.precio_app;   // antes: q.data.precio_app
```

Y en `src/lib/api.ts`, agregar el campo al tipo:

```ts
export interface Producto {
  // ...
  precio_app: number;
  precio_vigente?: number;   // precio efectivo con oferta/combo aplicado (backend nuevo)
  // ...
}
```

**Criterios de aceptación.** Crear una oferta de prueba con `precio_oferta < precio_app`; agregarla al carrito; el precio en el carrito **no cambia** al refrescar; el pedido creado cobra el **precio de oferta**; `numero_orden`/total coinciden en app y en el detalle del pedido.

**Prueba.** Requiere data de oferta real (hoy no hay). Coordinar con el admin para crear una oferta test con descuento real y validar el flujo completo add→cart→checkout→detalle.

---

### 🟠 #6 — La sesión no se re-hidrata al volver la red

**Problema.** Si `hydrate()` falla por red (app abierta sin señal), el store marca `isAuthenticated: false` pero **conserva** el token en SecureStore (correcto). Pero **no hay reintento al recuperar conexión**: el usuario queda como "invitado" hasta matar y reabrir la app. Peor: `cartSync`/`tracker` sí adjuntan el token guardado, así que el estado de UI y el de auth divergen.

**Causa raíz.** [`src/stores/auth.ts:114-122`](src/stores/auth.ts) setea `lastHydrateError: 'network'` pero nada re-dispara `hydrate()` al reconectar. [`app/_layout.tsx:62-68`](app/_layout.tsx) solo llama `hydrate()` una vez al montar.

**Fix.** Listener de `NetInfo` que reintente `hydrate()` cuando (a) vuelve la conexión y (b) `lastHydrateError === 'network'` y (c) hay token guardado.

```ts
// app/_layout.tsx — nuevo useEffect (importar NetInfo y getToken)
import NetInfo from "@react-native-community/netinfo";
import { getToken } from "../src/lib/api";

// ...dentro de RootLayout, junto a los otros efectos:
useEffect(() => {
  const unsub = NetInfo.addEventListener(async (state) => {
    const online = state.isConnected === true && state.isInternetReachable !== false;
    if (!online) return;
    const st = useAuthStore.getState();
    if (st.lastHydrateError === 'network' && !st.isAuthenticated) {
      if (await getToken()) st.hydrate();   // reintento silencioso
    }
  });
  return () => unsub();
}, []);
```

`hydrate()` ya es idempotente y limpia `lastHydrateError` al éxito (`clearHydrateError` / al setear estado). Verificar que un `hydrate()` exitoso ponga `lastHydrateError: null` (hoy solo lo limpia el toast diferido — **agregar `lastHydrateError: null` en el `set` del caso éxito** de `hydrate`, línea ~90).

**Criterios de aceptación.** Abrir la app en modo avión con sesión previa → splash → queda "deslogueado" con toast "Sin conexión". Activar red → **en segundos la sesión se rehidrata sola** (perfil, pedidos, etc.) sin reabrir la app.

**Prueba.** Simulador: activar modo avión, abrir app, desactivar avión, observar rehidratación.

---

### 🟠 #8 — Reintento de checkout crea direcciones duplicadas

**Problema.** En `handlePedir`, `crearDireccion()` corre **antes** de `crearPedido()` y **fuera** del paraguas del idempotency key. Si `crearPedido` falla (timeout, stock) y el usuario reintenta, se crea la misma dirección otra vez (y otra), cada una `predeterminada: true`.

**Causa raíz.** [`app/(tabs)/cart.tsx:246-253`](app/(tabs)/cart.tsx).

**Fix.** Guardar en un ref el `id` de la dirección creada en este intento; saltarse `crearDireccion` en reintentos.

```ts
// app/(tabs)/cart.tsx — junto a submitIdempotencyKeyRef (~línea 192)
const direccionCreadaIdRef = useRef<number | null>(null);

// dentro de handlePedir, reemplazar el bloque "Guardar nueva dirección":
if (mostrarNueva && dirFinal && direccionCreadaIdRef.current == null) {
  try {
    const nueva = await crearDireccion({
      direccion: dirFinal, barrio: barFinal || undefined, barrio_id: barIdFinal,
      notas: notFinal || undefined, predeterminada: true,
    });
    direccionCreadaIdRef.current = nueva.id;   // recordar para no duplicar en reintentos
    try { await refetchDirs(); } catch { /* best-effort */ }
  } catch { /* si falla, el pedido igual puede continuar con la dir inline */ }
}
```

Y al **éxito** del pedido (donde se libera `submitIdempotencyKeyRef.current = null`), resetear también `direccionCreadaIdRef.current = null`.

**Criterios de aceptación.** Con "Nueva dirección", forzar un fallo de `crearPedido` (p.ej. cerrar tienda / sin stock) y reintentar 2-3 veces: **se crea una sola dirección**, no N.

---

### 🟡 #10 — El término de búsqueda nunca llega a analytics

**Problema.** `search.tsx` envía `{ q, resultados }`, pero el allowlist del tracker descarta `q` (para `busqueda` solo permite `resultados`; para `busqueda_sin_resultado`, nada). Pierden el dato más valioso: qué buscan los usuarios y no encuentran.

**Causa raíz.** [`src/lib/tracker.ts:60-61`](src/lib/tracker.ts) — `ALLOWED_KEYS`.

**Fix.**
```ts
// src/lib/tracker.ts — ALLOWED_KEYS
busqueda_sin_resultado: ['q'],          // antes: []
busqueda: ['q', 'resultados'],          // antes: ['resultados']
```
> El backend `/eventos` tiene su propio allowlist; confirmar que acepta `q` para esos tipos (si no, agregarlo allá también). Es dato de comportamiento, no PII.

**Criterio.** Buscar "xyzabc" (sin resultados) y "whisky" → en el panel de eventos aparecen ambos con el término.

---

### 🟡 #12 — `addItem` con stock 0 inserta un item fantasma

**Problema.** `Math.min(1, max)` con `stockMaximo: 0` crea un item de cantidad 0 que ensucia carrito y sync.

**Causa raíz.** [`src/stores/cart.ts:70-71`](src/stores/cart.ts) (y `addItemWithQuantity`, 91-92).

**Fix.** Defensa en el store (además del botón deshabilitado en UI):
```ts
// src/stores/cart.ts — al inicio de addItem y addItemWithQuantity
if ((product.stockMaximo ?? Infinity) <= 0) return state;   // no agregar agotados
```

**Criterio.** Intentar agregar un producto con `stock_total = 0` no cambia el carrito.

---

### 🟡 #13 — Polling de 15s en un pedido ya entregado/cancelado

**Problema.** El detalle de pedido refetcha cada 15s incluso cuando el estado es final. Gasta red/batería sin necesidad.

**Causa raíz.** [`app/(tabs)/orders/[id].tsx:48`](app/(tabs)/orders/[id].tsx) — `refetchInterval: 15000` fijo.

**Fix.**
```ts
// app/(tabs)/orders/[id].tsx
refetchInterval: (query) =>
  ["entregado", "cancelado"].includes(query.state.data?.estado ?? "") ? false : 15000,
```

**Criterio.** Un pedido "entregado" deja de hacer requests (verificar en el inspector de red que no hay polling).

---

### 🔵 Bajos (batch rápido, mismo tren OTA)

- **Voseo.** [`app/error.tsx:49`](app/error.tsx): "Podés intentar de nuevo" → **"Puedes"**. (Colombia no vosea.)
- **Versión hardcodeada.** [`app/(tabs)/profile.tsx:361`](app/(tabs)/profile.tsx): "Versión 1.0.0" → `Versión ${Constants.expoConfig?.version}` (import `expo-constants`). Hoy dice 1.0.0 mientras la app va en 1.0.1.
- **Fallback image en CDN de terceros.** [`app/(tabs)/index.tsx:35`](app/(tabs)/index.tsx): `FALLBACK_IMG` apunta a `cdn.shopify.com/...`; si esa colección cambia, el hero por defecto se rompe. Empaquetar un asset local (`require('../../assets/...')`).
- **Accesibilidad.** Agregar `accessibilityLabel` a botones de solo-ícono: el "+" de [`ProductCard.tsx:153`](src/components/ProductCard.tsx), el quitar-cupón de [`cart.tsx:476`](app/(tabs)/cart.tsx), el minus de [`product/[id].tsx:364`](app/product/[id].tsx).
- **Safe-area en headers.** [`product/[id].tsx:251`](app/product/[id].tsx), [`category/[id].tsx:86`](app/category/[id].tsx), `profile/direcciones.tsx` usan `paddingTop: 56` fijo. Migrar a `useSafeAreaInsets()` (como login/search) para no desalinear en notches distintos.

---

## 3. 🔴 SDK de Meta — los dos avisos del Events Manager  ✅ EN SCOPE

> **Estado (decisión 2026-07-11):** entra en el **build de lanzamiento `1.0.2`** junto con todo lo demás. Es justo lo que se quiere para que la pauta arranque con alcance iOS 14.5+ y atribución de campaña correctos desde el día 1.

El panel de Meta muestra dos alertas sobre el conjunto de datos **"Estanco Caquetá Express APP"**:

1. **"Actualiza tus apps a la última versión del SDK de Facebook"** (para que usuarios iOS 14.5+ vean los anuncios).
2. **"Corregir errores de configuración del SDK"** — no se envían suficientes eventos con el parámetro **"Identificador de la campaña"**, degradando la calidad de eventos.

**Diagnóstico.** El paquete JS `react-native-fbsdk-next` **ya está en la última versión (13.4.3)** — no hay bump de dependencia que hacer. Lo que Meta detecta es que el **binario publicado en las tiendas** (build 54) reporta eventos con una versión del **SDK nativo** más vieja / configuración incompleta. **La acción es reconstruir y reenviar el binario**, no un OTA (el SDK nativo no se actualiza por EAS Update).

> ⚠️ **Revisión de una recomendación previa:** en la auditoría de la app sugerí poner `autoLogAppEventsEnabled: false` / `isAutoInitEnabled: false`. **Eso ahora sería contraproducente:** el aviso #2 dice que faltan eventos con identificador de campaña — necesitan **más y mejores** eventos automáticos, no menos. Para medir campañas, el auto-logging debe quedar **ENCENDIDO**; el consentimiento IDFA se controla aparte vía ATT. Mantener el config actual.

**Pasos.**

1. **Fijar la versión exacta** (evita sorpresas de un `^` que suba en el build):
   ```jsonc
   // package.json
   "react-native-fbsdk-next": "13.4.3"   // sin caret
   ```
2. **Revisar `app.json`** (el plugin ya está bien configurado; confirmar, no cambiar sin motivo):
   ```jsonc
   // app.json → plugins → react-native-fbsdk-next
   {
     "appID": "2300234794051494",
     "clientToken": "f8d003d5ce1a72049fa446a67e2c6353",
     "advertiserIDCollectionEnabled": true,   // ✅ dejar true
     "autoLogAppEventsEnabled": true,         // ✅ dejar true (necesario para medición)
     "isAutoInitEnabled": true,               // ✅ dejar true
     "iosUserTrackingPermission": "Usamos tu actividad para medir nuestras campañas..."
   }
   ```
3. **Confirmar el flujo ATT** en [`src/lib/metaEvents.ts:44-58`](src/lib/metaEvents.ts): `initMetaAnalytics()` pide `requestTrackingPermissionsAsync()` y setea `setAdvertiserTrackingEnabled(status === 'granted')` antes de `initializeSDK()` + `activateApp()`. Está correcto — dejarlo.
4. **Subir versión y reconstruir:**
   ```jsonc
   // app.json
   "version": "1.0.2",
   "ios":     { "buildNumber": "55" },
   "android": { "versionCode": 55 }
   ```
   ```bash
   eas build --platform all --profile production
   eas submit --platform all --latest      # o subir manual a App Store Connect / Play Console
   ```
5. **Verificar en Meta Events Manager** (24-48h tras adopción del build): que el evento `Purchase`/`AddToCart`/`CompleteRegistration` reporte la **versión de SDK actual** y que baje el aviso de "identificador de campaña". Comprobar que llegan eventos de test con el **AEM/SKAdNetwork** configurado.

**Criterios de aceptación.** Ambos avisos del panel desaparecen tras propagarse el build 55; los eventos de Meta muestran la versión de SDK actual; las conversiones de campaña se atribuyen.

> ⏱️ **Empieza este tren primero en el tiempo:** el review de App Store + Play tarda **días**. Arráncalo en paralelo con los fixes OTA para no ser el cuello de botella.

---

## 4. 🟡 Ítem 8 — Anti-enumeración del reset (acoplamiento con backend)

**Qué preparó el backend (sin desplegar).** El parche cambia `POST /clientes/reset-password/solicitar` para devolver **200 genérico idéntico** exista o no el número (hoy devuelve **404 "Este número no está registrado."**). Está listo en `Seguridad DistriPolsar/PENDIENTE-item8-reset-anti-enumeracion/` pero **no desplegado a propósito**.

**Por qué está acoplado.** La app en vivo depende de ese **404 exacto** para mostrar el CTA "Crea una cuenta":
- [`app/(auth)/forgot-password.tsx:44-52`](app/(auth)/forgot-password.tsx): `if (msg === "Este número no está registrado.")` → muestra toast con CTA a registro.
- [`src/lib/api.ts:118`](src/lib/api.ts): el mensaje está en el whitelist `ERRORES_USUARIO`.

**Riesgo de desincronía:**
- Backend primero (200 genérico) + app vieja: `solicitarResetPassword` resuelve OK para números inexistentes → navega a `verify-otp` a esperar un código que nunca llega. UX degradada.
- App nueva (sin el manejo del 404) + backend viejo (404): mostraría un toast de error genérico en vez del CTA. También degradada.

**Fix recomendado — hacer el frontend tolerante a AMBAS respuestas** (mejor que "mismo release exacto"): así el orden de deploy deja de importar.

```ts
// app/(auth)/forgot-password.tsx — handleSolicitar
try {
  await solicitarResetPassword(tel);
  router.push({ pathname: "/(auth)/verify-otp", params: { telefono: tel } });
} catch (err: unknown) {
  const msg = err instanceof Error ? err.message : "No se pudo enviar el código";
  // Backend legacy (404): número no registrado → CTA a registro.
  // Backend nuevo (200 genérico): este branch ya no se ejecuta y navegamos a verify-otp.
  if (msg === "Este número no está registrado.") {
    Toast.show({ type: "info", text1: "Número no registrado",
      text2: "Crea una cuenta para empezar a pedir.",
      onPress: () => router.replace("/(auth)/register") });
    return;
  }
  Sentry.captureException(/* ... */);
  Toast.show({ type: "error", text1: "Error", text2: msg });
}
```

**Y agregar un link de registro PERSISTENTE** (no dependiente del 404) en `forgot-password.tsx` y `verify-otp.tsx`, del tipo:
```tsx
<Pressable onPress={() => router.replace("/(auth)/register")} className="items-center mt-4">
  <Text style={{ color: "#6D7B6C", fontSize: 13 }}>¿No tienes cuenta? <Text style={{ color: "#D33587", fontWeight: "700" }}>Regístrate</Text></Text>
</Pressable>
```
Así, cuando el backend pase al 200 genérico y el CTA del 404 deje de aparecer, el usuario sin cuenta **igual** tiene una salida clara.

**Secuencia de deploy.** 1) Publicar la app con el manejo tolerante + link persistente (OTA). 2) Una vez adoptada, desplegar el parche backend del Ítem 8 en cualquier momento. **No requieren ser simultáneos** si el frontend tolera ambas respuestas.

---

## 5. Plan de release y QA

**Un único release de lanzamiento — build nativo `1.0.2`, todo incluido.** No hay OTA en vivo (la app aún no salió a ventas).

**Secuencia:**
1. **Implementar todo en una rama** (`release/1.0.2`): #1, #5-frontend, #6, #8, #10, #12, #13, 🔵, Ítem 8-frontend, y el SDK de Meta (`app.json` version `1.0.2` / build 55 / versionCode 55).
2. **Backend coordinado** (deploy de servidor, PM2 reload): `precio_vigente` en `catalogo.js` + cobro en `pedidos.js` (#5), y parche Ítem 8 (`PENDIENTE-item8-...`). El frontend usa `?? precio_app` como fallback, así que el orden servidor↔app no es frágil.
3. **Calidad:** `npm run test` (vitest) + `npm run lint` en verde; QA en dispositivo físico según la checklist de abajo.
4. **Build y envío:**
   ```bash
   npm run test && npm run lint
   eas build --platform all --profile production
   eas submit --platform all --latest      # o subida manual a App Store Connect / Play Console
   ```
5. **Verificar Meta** (24-48h tras aprobación): avisos del Events Manager desaparecen; eventos con SDK actual + atribución de campaña.
6. **Lanzar** y recién ahí encender la pauta.

> Post-lanzamiento, los ítems marcados "OTA-safe" en el tablero sí se pueden parchar por `eas update` sin review; el SDK de Meta y cualquier cambio nativo siempre exigen build nuevo.

### Checklist QA (dispositivo físico, no solo simulador)
- [ ] **#1** Carrito sobrevive a un login fallido.
- [ ] **#1** Un 401 real (token vencido) sí desloguea.
- [ ] **#5** Con oferta de prueba real, precio se mantiene en carrito y se cobra el de oferta (requiere data del admin).
- [ ] **#6** Modo avión → sin sesión → red vuelve → rehidrata sola.
- [ ] **#8** Reintento de checkout con dirección nueva no duplica direcciones.
- [ ] **#10** Términos de búsqueda aparecen en el panel de eventos.
- [ ] **#12** Producto agotado no entra al carrito.
- [ ] **#13** Pedido entregado deja de hacer polling.
- [ ] **M** Ambos avisos de Meta desaparecen; eventos con SDK actual + atribución de campaña.
- [ ] **Ítem 8** Reset con número inexistente muestra una salida clara con backend viejo Y nuevo.
- [ ] **Regresión push** (ya arreglado en backend): logout en cuenta A, login cuenta B en el mismo celular → A deja de recibir push, B los recibe.

---

## 6. Riesgos y rollback

- **OTA rollback:** `eas update` es reversible — republicar el update anterior por `branch`. Mantener el commit previo tageado.
- **#1 — riesgo de sobre-filtrar:** si el regex de endpoints auth se equivoca, un 401 real podría no desloguear. Mitigación: el test unitario cubre ambos casos (auth vs protegido).
- **#5 — riesgo de contrato:** desplegar el backend `precio_vigente` **antes** del OTA frontend evita cualquier ventana rara (el frontend con `?? precio_app` tolera backend viejo, pero no al revés si el frontend nuevo asumiera el campo sin fallback → por eso el `??` es obligatorio).
- **Meta build:** si el build 55 es rechazado en review, el 54 sigue vivo; los avisos de Meta persisten hasta aprobar. No hay pérdida, solo demora.
- **Ítem 8:** al ser el frontend tolerante a ambas respuestas, el deploy del backend no puede romper la app. Riesgo residual nulo si se sigue el orden (frontend primero).

---

## Apéndice — Mapa de archivos a tocar

| Ítem | Archivos |
|------|----------|
| #1 | `src/lib/api.ts` (bloque 401) · `src/lib/__tests__/api.test.ts` |
| #5 | **backend:** `catalogo.js` (`precio_vigente`), `pedidos.js` (cobrar `precio_vigente`) · **app:** `src/lib/api.ts` (tipo `Producto`), `app/(tabs)/cart.tsx` |
| #6 | `app/_layout.tsx`, `src/stores/auth.ts` |
| #8 | `app/(tabs)/cart.tsx` |
| #10 | `src/lib/tracker.ts` (+ allowlist backend `/eventos` si aplica) |
| #12 | `src/stores/cart.ts` |
| #13 | `app/(tabs)/orders/[id].tsx` |
| 🔵 | `app/error.tsx`, `app/(tabs)/profile.tsx`, `app/(tabs)/index.tsx`, `src/components/ProductCard.tsx`, `app/product/[id].tsx`, `app/category/[id].tsx` |
| Meta | `package.json`, `app.json`, (verificar `src/lib/metaEvents.ts`) |
| Ítem 8 | `app/(auth)/forgot-password.tsx`, `app/(auth)/verify-otp.tsx` + deploy backend `PENDIENTE-item8-...` |

---

*Fin del plan. Los fixes de frontend son de horas; el cuello de botella real es el review de tiendas del build de Meta — arráncalo primero.*
