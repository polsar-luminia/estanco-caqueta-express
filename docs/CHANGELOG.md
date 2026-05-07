# Changelog — Estanco Caquetá Express (mobile)

Todos los cambios notables del app móvil. Formato basado en [Keep a Changelog](https://keepachangelog.com/),
versionado SemVer alineado con `versionCode` nativo.

## [v5.1] — 2026-05-07 — Fixes seguridad deep links + observabilidad

### Fixed
- **M-NAV-09 (Sev 4)** — `app/ofertas.tsx` ahora requiere sesión activa y edad confirmada
  antes de renderizar. Un deep link directo (`eslestanco://ofertas`) bypassaba el guard de
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
  production). Ver `docs/api-url-environments.md`.
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
  Ver `docs/release-v5-decisions.md`.

### Backend (live, no afecta build mobile pero relacionado)
- `api.estancocaqueta.com` activo con TLS Let's Encrypt + HSTS.
- WhatsApp OTP con retry+backoff y endpoint `GET /api/v1/health/whatsapp`.
- Cluster Ofertas: tabla, endpoints, admin UI desplegado en `https://admin.estancocaqueta.com/ofertas`.
- Migración 020 (embajadores FK CASCADE) y 021 (ofertas) aplicadas en prod.

## [v4] — anterior

Build base previo. Ver historial git.
