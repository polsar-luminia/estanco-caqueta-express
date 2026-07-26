# Auditoría de seguridad — Estanco Caquetá Express

**Fecha:** 2026-07-22
**Alcance:** App móvil (Expo/RN), Backend API (Express en VPS) y host del VPS.
**Método:** Revisión manual de código + inspección del host. (El plugin `security-guidance`
de Claude Code es *reactivo* — solo cubre código nuevo que se escriba/commitee; NO se usó
como escáner aquí.)

## Veredicto general

Postura **muy sólida**. **Sin vulnerabilidades críticas ni altas.** Los hallazgos son
mejoras de defensa en profundidad. Referencia de estado a la fecha; si un archivo/línea
cambió, re-verificar antes de actuar.

---

## Hallazgos y estado

| # | Sev | Área | Archivo / Ubicación | Hallazgo | Estado |
|---|-----|------|---------------------|----------|--------|
| A1 | 🟡 Media | App | `.easignore` (falta la línea) · `play-service-account.json` (raíz) · `eas.json:65,72,78` | Clave privada de service account de Google Play NO está en `.easignore` → se sube a servidores EAS en cada `eas build`. **Verificado.** | ⬜ Pendiente |
| B1 | 🟡 Media-baja | Backend | `routes/clientes.js` `/reset-password/verificar` (~L644) | OTP de 6 dígitos sin contador de intentos por código; depende solo del rate-limit por IP (`loginLimiter`, 5/15min). Fuerza bruta distribuida teóricamente posible en la ventana de 15 min. | ⬜ Pendiente |
| A2 | 🔵 Baja | App | `app.json:81` | Google Maps Android API key embebida en el APK (inevitable). Solo segura si está **restringida** en Google Cloud (paquete `co.estancocaqueta.express` + SHA-1 del cert de firma + "Maps SDK for Android"). | ⬜ Verificar en consola |
| V1 | 🔵 Baja | VPS | Puerto `3003` (`/home/devuser/polo-dashboard/proxy/index.js`) | Proxy node escucha en `*:3003` (todas las interfaces); hoy solo lo protege `ufw`. Si el firewall fallara, quedaría expuesto. | ⬜ Bindear a `127.0.0.1` |
| V2 | 🔵 Baja | VPS | SO | 4 actualizaciones de **seguridad** pendientes. | ⬜ `apt-get upgrade` |
| B2 | 🔵 Baja | Backend | `routes/clientes.js` `/reset-password/solicitar` (404) y `/registrar` (409) | Enumeración de teléfonos registrados. Documentado como aceptado por el equipo; en un estanco el padrón es dato sensible. | ℹ️ Aceptado / opcional |
| B3 | ⚪ Info | Backend | `routes/sms-ack.js` (comparación de token con `!==`) | Token comparado sin `timingSafeEqual`. Riesgo despreciable (token largo en path, webhook de bajo valor). | ℹ️ Opcional |
| B4 | ⚪ Info | Backend | `routes/webhooks-shopify.js` | No aparece montado en `index.js` → posible código muerto. | ⬜ Confirmar/eliminar |
| A3 | ⚪ Info | App | `app/product/[id].tsx` | Precios por deep link manipulables solo en visualización; **no explotable** (pedido manda `{producto_id, cantidad}`, servidor recalcula). | ✅ Sin acción |

---

## Plan de acción priorizado

1. **A1** — Añadir `play-service-account.json` a `.easignore` (1 línea, cero riesgo; no rompe `eas submit`, que lee la clave por separado). Si hay dudas de builds previos, rotar la clave en Google Cloud Console.
2. **A2** — Verificar restricciones de la Google Maps key en Google Cloud.
3. **B1** — Contador de intentos por código OTP: columna `intentos` en `password_reset_tokens`, invalidar tras 5 fallos (~15 líneas + migración).
4. **V1 + V2** — Bindear proxy `:3003` a localhost; `apt-get update && apt-get upgrade`.
5. **B4** — Confirmar/eliminar `webhooks-shopify.js` si es código muerto.

---

## Controles verificados como CORRECTOS (no regresionar)

### Backend (API Express)
- **SQL** 100% parametrizado (`$1,$2`). Único SQL dinámico (`stores.js:46`) usa columnas de whitelist hardcodeada → no inyectable.
- **Auth**: JWT `HS256` explícito + validación de sesión en DB por hash SHA-256 (sesiones **revocables**). `JWT_SECRET` sin fallback (proceso muere si falta — `shared/src/config.js:25`).
- **Sin IDOR**: pedidos/carritos filtran por `cliente_id = req.cliente.id`. `requireRole('admin')` en todas las rutas de staff (incl. `notificaciones` broadcast/dispatch).
- **Passwords**: bcrypt, bloqueo por intentos (`locked_until`), `FOR UPDATE` anti-race.
- **OTP**: `crypto.randomInt` (CSPRNG), expiración 15 min, verificación atómica, invalida TODAS las sesiones tras el cambio.
- **Upload**: MIME + **magic bytes** (`file-type`) + nombre aleatorio + extensión whitelist.
- **Webhook Shopify**: HMAC con `timingSafeEqual`.
- **Error handler**: en producción oculta stack traces y mensajes 500.
- `helmet()`, CORS con whitelist, rate-limit global (300/min) + login (5/15min) + OTP (3/15min).

### VPS (host)
- PostgreSQL (5432) y API (3002) escuchan **solo en `127.0.0.1`** — no expuestos.
- `ufw` activo: default deny incoming, solo 22/80/443 abiertos.
- SSH: `PasswordAuthentication no`, root solo por llave, **fail2ban activo**.
- `.env` con permisos `-rw-r-----` (no world-readable).

### App móvil (código cliente)
- **JWT en `expo-secure-store`** (Keychain/Keystore), nunca en AsyncStorage.
- **Carrito persistido sin PII** (`cart.ts` `partialize` excluye dirección).
- **Red 100% HTTPS**, sin `usesCleartextTraffic` ni bypass de TLS.
- **Sentry `beforeSend`** elimina `Authorization`/`Cookie`/`request.data`.
- **Precios server-authoritative**; telemetría con **allowlist default-deny**; logs de token solo bajo `__DEV__`; errores fail-closed con whitelist.
- Secretos públicos por diseño (Facebook `clientToken`, Sentry DSN) — sin acción.

---

## El plugin `security-guidance` (instalado)

Instalado en esta sesión (`/plugin install security-guidance@claude-plugins-official`).
Corre `/reload-plugins` para activarlo. Es **reactivo**: 3 capas (regex en Edit/Write →
revisión LLM del diff al terminar turno → revisión agéntica en `git commit`). Protege el
código nuevo de aquí en adelante; NO audita la base existente. Kill switch:
`SECURITY_GUIDANCE_DISABLE=1`. Reglas propias: `.claude/claude-security-guidance.md`.
