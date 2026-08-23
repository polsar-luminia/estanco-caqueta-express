# Changelog — Estanco Caquetá Express (mobile)

Todos los cambios notables del app móvil. Formato basado en [Keep a Changelog](https://keepachangelog.com/).

> **Cambio de esquema de versiones.** Hasta `v5.1` (mayo 2026) se numeraba `vN` siguiendo el
> `versionCode`. Desde el lanzamiento público se usa SemVer en `expo.version` (1.0.x, 1.1.x) con el
> `buildNumber`/`versionCode` como número aparte. Las entradas de abajo de `[1.0.2]` conservan la
> numeración vieja; **`v5` no es posterior a `1.1.5`.**

> **Este archivo estuvo congelado entre 2026-05-07 y 2026-07-26.** Las entradas de `1.0.2` a `1.1.5`
> se reconstruyeron desde el historial de git el 2026-07-26, así que resumen el cambio pero no
> tienen el nivel de detalle de las entradas escritas en su momento.

## [Unreleased / configuración 1.3.1, builds 91–92]

Los números existen en `app.json`, pero al verificar EAS el 21/08/2026 no existía build 91
ni 92. Los OTA del runtime 1.3.1 no tenían receptor binario verificado. No reclasificar esta
entrada como publicada hasta comprobar EAS y cada tienda; ver `docs/RELEASE-ESTADO.md`.

## [1.1.5 / build 64] — 2026-07-22 (binario) · OTAs hasta 2026-07-25

Rama viva: `release/1.1.5`. El binario 64 se compiló en `057e247`; todo lo posterior se entregó
por OTA sobre el runtime 1.1.5 (y se repitió para los runtimes 1.1.3 y 1.1.2).

### Added
- **Límite de unidades por cliente, completo** (`c54bb6e`, `2b6a36a`, `e1b3019`, `984331a`,
  `a37a363`, `14e3d62`): aviso en la ficha, tope real en el carrito, cupo respetado por las cards
  de los listados y refresco del cupo (no solo del stock) al volver al carrito. La ventana móvil
  ya no está quemada en el bundle: llega del backend (`limite_ventana_dias`).
- **Meta: `ViewContent`, `Search` y SKAdNetwork** para iOS 14+ (`5617a5a`) — es el cambio nativo
  que obligó al build 64.
- **`device_id` anónimo** en el tracker (`629e64a`) para medir uso previo al registro.
- **Banda de tienda cerrada con motivo** — ley seca / almuerzo / genérico (`b9a2966`). El motivo
  se lee en vivo de `/opt/polo/config/aviso-tienda.json` en el VPS.

### Fixed
- `logPurchase` descartaba la venta cuando el total llegaba como string (`0958dd5`).

## [1.1.4 / build 63] — 2026-07-21 — **nunca se compiló**

Existe como commit (`097caec`, en `master`) pero no hay build en EAS: se pasó directo al 64.
Es la razón de que `master` esté 12 commits detrás de `release/1.1.5`.

### Added
- Evento Meta `InitiateCheckout` al confirmar pedido, que cierra el embudo de conversión
  (`0a30e29`). Se entregó por OTA sobre el runtime 1.1.3 (tag `ota-1.1.3-initiate-checkout`).

## [1.1.3 / build 62] — 2026-07-21

### Added
- Tope de unidades por cliente en oferta + errores del backend mostrables al usuario (`cd42c55`).
- Perfil de EAS para APK de emulador (`896f09f`).

### Fixed
- Prompt de ATT: esperar a que la app esté activa antes de lanzarlo (`7e4d06b`). Era el rechazo
  2.1 de Apple.
- `react-native-maps` renderizaba gris en Android: `PROVIDER_GOOGLE` + overlay de carga (`67fbf0e`).

## [1.1.1 / builds 57–58] — 2026-07-14

### Added
- **Checkout GPS-first**: se quitó el barrio por completo (`ac7040a`, build 58).
- Banda "Ver carrito" en Categoría y Buscar; badges de Inicio editables desde la DB (`3a2bf6f`).
- Diálogo con acciones cuando el número ya tiene cuenta (`90f787a`).
- Idempotencia al crear dirección y al solicitar OTP (`865f6c4`).
- Registro más simple: fecha de nacimiento en un solo campo + aceptación implícita de políticas
  (`02e7d16`).

## [1.1.0 / build 56] — 2026-07-13

### Added
- **Rediseño Vibrante completo**: sistema de tokens en `src/constants/theme.ts` y todas las
  pantallas migradas (Inicio, Buscar, Ofertas, Seguimiento, Perfil, Carrito, Checkout, Categoría,
  Detalle, Direcciones, autenticación). ~15 commits del `f6e42fd` al `6001761`.
- **Geolocalización Fase 1 y 2**: `expo-location`, botón "Usar mi ubicación", pantalla de mapa con
  pin arrastrable, auto-llenado de dirección, captura instantánea estilo Rappi
  (`abf875f`…`6121546`). Migración SQL en `docs/migrations/2026-07-12_geolocalizacion.sql`.
- Retención de coordenadas a 12 meses por Ley 1581 (`7e27722`) y finalidad de ubicación en la
  política de privacidad (`19565bd`).

### Fixed
- El teclado ya no tapa los inputs (`automaticallyAdjustKeyboardInsets`, `7c8a1e6`).

## [1.0.2 / build 55] — 2026-07-11 — Remediación pre-lanzamiento

### Fixed
- Paquete de remediación previo al lanzamiento: embudo, sesión, analytics y SDK de Meta
  (`0f59354`). Plan de respaldo en `PLAN-REMEDIACION-APP-2026-07-11.md`.

### Changed
- Submit de Android a producción como `draft` en vez de publicación automática (`9dcb184`).

---

## [v5.1] — 2026-05-07 — Fixes seguridad deep links + observabilidad

### Fixed
- **M-NAV-09 (Sev 4)** — `app/ofertas.tsx` ahora requiere sesión activa y edad confirmada
  antes de renderizar. Un deep link directo (`estancocaqueta://ofertas` — la entrada original decía
  `eslestanco://`, scheme que nunca existió) bypassaba el guard de
  `(tabs)/_layout` y mostraba el catálogo de licores a usuarios anónimos o menores.
  Doble violación: Apple §1.4.3 + Ley colombiana 124/1994. Guard canónico insertado al
  inicio del componente (patrón idéntico al de `app/(tabs)/_layout.tsx:7-26`).
- **M-NAV-10 (Sev 3)** — Creado `app/profile/_layout.tsx` con guard de auth para las 4
  rutas de perfil (`cupones`, `direcciones`, `metodos-pago`, `notificaciones`). Antes, un
  deep link a `profile/cupones` montaba el componente sin sesión; solo fallaba reactivamente
  al recibir 401 de la API.
- **M-CART-11 (Sev 3)** — `cancelMutation.onError` en `orders/[id].tsx` ahora llama a
  `Sentry.captureException` con `tags: {flow:orders, action:cancelar}` además del Toast.
  Las cancelaciones fallidas ya no se pierden en observabilidad.

## [v5] — 2026-05-02 — Release v5

### Added
- `OfertasSection.tsx` carousel horizontal en home con ofertas activas desde
  `/api/v1/ofertas` (público).
- Prop `oferta` en `ProductCard` (badge magenta + precio tachado opcional).
- `getOfertas()` en `lib/api.ts`.
- `CartFloatingBar.tsx` montado en `product/[id].tsx` para acceso rápido al carrito.
- 4 tests nuevos para `verify-otp` (39/39 totales).
- `WHATSAPP_NEGOCIO_LINK` en `src/constants/config.ts`.
- 3 `__DEV__` guards en `usePushNotifications.ts` (evita ruido en producción).

### Changed
- `EXPO_PUBLIC_API_URL` ahora env-driven por profile en `eas.json` (preview, preview-ios,
  production). (Se citaba `docs/api-url-environments.md`, que nunca se escribió — la fuente real
  es `eas.json`.)
- Selectores Zustand inline en `_layout.tsx`, `cart.tsx`, `index.tsx`. Antes con métodos
  no reactivos del store — los cambios de state no disparaban re-render.
- Post-pedido: `router.replace("/orders") + router.push("/orders/[id]")` para que el back
  button vuelva al listado de órdenes (no al checkout).
- `paddingBottom: 100` en `orders/[id].tsx` para que el botón Cancelar no quede tapado
  por el tab bar absoluto.
- `forgot-password.tsx`: workaround `wa.me` que abre WhatsApp del negocio antes de
  disparar el OTP en paralelo (cumple ventana 24h del template UTILITY).
- `verify-otp.tsx`: botón Reenviar también re-abre `wa.me`.
- `verify-otp.tsx`: hooks ordenados antes del guard (rules of hooks).
- `app.json`: `versionCode` 4 → 5.
- `app.json`: `UIViewControllerBasedStatusBarAppearance: true` para arreglar RedBox iOS
  en builds nativos (no afecta Expo Go).

### Removed
- `codeSigningCertificate` y `codeSigningMetadata` de la sección `updates` en `app.json`.
  Code signing OTA requiere EAS Enterprise ($99/mes); riesgo MITM mitigado por TLS.
  Archivos en `code-signing/` preservados en disco para futura reactivación.
  (Se citaba `docs/release-v5-decisions.md`, que nunca se escribió.)

### Backend (live, no afecta build mobile pero relacionado)
- `api.estancocaqueta.com` activo con TLS Let's Encrypt + HSTS.
- WhatsApp OTP con retry+backoff y endpoint `GET /api/v1/health/whatsapp`.
- Cluster Ofertas: tabla, endpoints, admin UI desplegado en `https://admin.estancocaqueta.com/ofertas`.
- Migración 020 (embajadores FK CASCADE) y 021 (ofertas) aplicadas en prod.

## [v4] — anterior

Build base previo. Ver historial git.
