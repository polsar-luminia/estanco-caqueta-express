# Bug hunt — Estanco Caquetá Express
Fecha: 2026-04-19 · 6 agentes paralelos · 29 bugs identificados

## Totales
- **P0 (bloqueante):** 7
- **P1 (degrada):** 12
- **P2 (edge/cosmético):** 10

---

## P0 — bloqueantes

| ID | Área | Bug | Ubicación | Alcance del fix |
|---|---|---|---|---|
| CAT-001 | Catálogo | `/combos` no está montado ni existe el archivo — sección combos nunca carga | `packages/api/src/index.js` + crear `routes/combos.js` | **Backend** (requiere aprobación) |
| STAT-001 / AUTH-003 / PROF-001 | State+Auth+Profile | Logout no limpia carrito persistido — Usuario B ve carrito de A | `app/(tabs)/profile.tsx:handleLogout` | Mobile |
| AUTH-002 | Auth | Logout no limpia React Query cache → perfil/pedidos de A visibles para B | `src/stores/auth.ts:logout` o `profile.tsx` | Mobile |
| AUTH-001 | Auth | Redirect loop potencial entre `(auth)` y `(tabs)` si hydrate cae en estado inconsistente | `app/(auth)/_layout.tsx` + `(tabs)/_layout.tsx` | Mobile |
| UIAPI-001 | API | `apiFetch` swallow cuando body no es JSON (5xx HTML) — mensaje "Error del servidor" sin info | `src/lib/api.ts:65` | Mobile |
| CHECK-001 | Checkout | Pedido mínimo `30000` hardcoded en 6 lugares — si backend cambia, app no entera | `cart.tsx`, `api.ts`, `/configuracion-app` | Mobile + **Backend** |
| CHECK-002 | Checkout | Early return "tienda cerrada" no resetea `loading` ni `submitLockRef` → botón queda en "Enviando..." para siempre | `app/(tabs)/cart.tsx:142-145` | Mobile |

## P1 — degrada experiencia

| ID | Área | Bug |
|---|---|---|
| CAT-002 | Catálogo | `/catalogo/buscar` no retorna `precio_lista1` → no muestra precio tachado en búsqueda |
| STAT-002 | Nav | Push notification navega a ruta protegida sin check de autenticación |
| STAT-003 | State | `persist` de cart sin `version`/`migrate` — migración futura rompe datos |
| UIAPI-002 | API | Timeout 10s hardcoded, sin override para uploads/red lenta |
| UIAPI-003 | API | Tracker flush sin `AbortController` — requests colgadas si backend pendiente |
| UIAPI-004 | UI | `KeyboardAvoidingView` sin `keyboardVerticalOffset` en login/register/modales — teclado oculta inputs |
| AUTH-004 | Auth | Validación teléfono divergente cliente (10 díg) vs server (7-15) |
| AUTH-005 | Auth | Hydrate con `getPerfil()` timeout deja token huérfano sin cliente |
| AUTH-006 | Auth | OTP re-envío sin rate limit servidor (skipSuccessfulRequests=true) |
| AUTH-007 | Auth | Race condition en reset password — OTP reusable en requests concurrentes |
| PROF-002 | Profile | Badge de cupones muestra count stale |
| PROF-003 | Profile | Eliminar dirección sin validar si tiene pedidos activos |
| CHECK-003 | Checkout | Carrito permite incrementar cantidad sin validar stock → POST falla |
| CHECK-004 | Checkout | Post-pedido no invalida `["pedidos"]` → historial tarda 30s en mostrar nuevo |

## P2 — edge / cosmético

| ID | Bug |
|---|---|
| STAT-004 | React Query sin exponential backoff |
| UIAPI-005 | OfflineBanner no bloquea submits |
| UIAPI-006 | Tracker errors no se reportan a Sentry |
| AUTH-008 | `verify-otp.tsx` no valida param teléfono |
| AUTH-009 | Año de nacimiento inválido se borra sin Toast |
| AUTH-010 | Sin endpoint logout server — sesión persiste 7d en DB |
| PROF-004 | Copy referral sin try/catch si permiso denegado |
| PROF-005 | Backend no normaliza cupones con espacios |
| CHECK-005 | `/orders/[id]` con id inválido: pantalla silenciosa sin error |

---

## Plan de ataque recomendado

### Fase 1 — Fixes mobile autónomos (sin tocar backend prod)
Aplicar ahora vía commit + push + OTA:
- CHECK-002 (trivial, 2 min)
- STAT-001/AUTH-003/PROF-001 (2 min — una línea en logout)
- AUTH-002 (2 min — `queryClient.clear()` en logout)
- UIAPI-001 (5 min — mejorar parser de error en apiFetch)
- AUTH-001 (10 min — audit de redirects)
- UIAPI-004 (10 min — offsets en KeyboardAvoidingView)
- STAT-002 (5 min — check auth antes de navigate)
- CAT-002 (2 min en backend — pero pequeño)
- CHECK-003 (10 min — validar cantidad contra stock)
- CHECK-004 (2 min — invalidateQueries)

### Fase 2 — Fixes backend (requiere aprobación del dueño)
- CAT-001 — crear `routes/combos.js` + montar. Asumir tabla `combos` ya existe.
- CHECK-001 — añadir `pedido_minimo` a `/configuracion-app` y consumirlo en mobile.
- CAT-002 — una línea en `catalogo.js`.
- AUTH-006 — rate limit OTP en backend.
- AUTH-007 — lock de OTP durante verificación.
- PROF-005 — trim cupón en backend.

### Fase 3 — Observabilidad y hardening (P1/P2 menores)
- Sentry capture en tracker, timeout configurable, backoff, AbortController.
- Versionado del persist.
- Endpoint logout server-side.
- Validaciones de param en rutas dinámicas.
