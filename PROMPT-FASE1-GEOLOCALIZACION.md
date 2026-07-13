# PROMPT — Implementar Fase 1 de geolocalización (rama aislada, sin tocar producción)

## Tu rol
Eres un ingeniero senior React Native/Expo + Node. Vas a **implementar la Fase 1** del plan de
geolocalización de Estanco Caquetá Express. El diseño YA está decidido y documentado — **lee
primero `PLAN-GEOLOCALIZACION.md` en la raíz del repo** (fechado 2026-07-12) y síguelo; no
re-abras decisiones de diseño (librería, proveedor, esquema de BD, contratos de API).

Repo app: `/Users/polsar23/Desktop/Desarrollo/estanco-caqueta-express`
Backend: VPS `ssh polo`, monorepo `/opt/polo/src/packages/api` (rutas en `src/routes/`),
PostgreSQL `polo_dashboard` (acceso: `sudo -u postgres psql polo_dashboard`).

## REGLAS DE AISLAMIENTO (innegociables — el objetivo es no dañar nada)

**App (repo git):**
1. Crea la rama `feature/geolocalizacion-fase1` a partir de `release/1.0.2` (verifica antes con
   `git status` que no haya trabajo sin commitear de otra cosa; si `release/1.0.2` ya se mergeó a
   `master`, parte de `master`). Si `PLAN-GEOLOCALIZACION.md` y este prompt aparecen untracked,
   commitéalos como primer commit de la rama.
2. **NUNCA** commitees ni hagas merge a `master` ni a `release/1.0.2`. Todo vive en la feature
   branch. Push a `origin/feature/geolocalizacion-fase1` al final de cada sesión de trabajo.
3. **NO ejecutes** `eas build --auto-submit`, `eas submit` ni `eas update` (OTA) bajo ninguna
   circunstancia: la 1.0.2 está en curso en las tiendas y este feature requiere build nativo.
   El build de prueba, si llega a hacerse, es solo `eas build --profile development` (o
   `preview`) y lo decide el usuario, no tú.
4. Commits pequeños y descriptivos en español (convención del repo: `feat:`, `chore:`, `docs:`).

**Backend (VPS — ⚠ NO es repo git, no hay rama que te proteja):**
5. Antes de editar cualquier archivo en el VPS: copia de seguridad con la convención existente,
   ej. `cp clientes.js clientes.js.bak.geo.$(date +%Y%m%d)`. Igual para `pedidos.js` y
   `pedidos-staff.js`.
6. Antes de la migración SQL: `pg_dump` de `polo_dashboard` (al menos schema+data de
   `direcciones_cliente`, `pedidos`, `clientes`) a un archivo con fecha en `/root/backups/` (crea
   el directorio si no existe). Verifica que el dump existe y pesa >0 antes de ejecutar el ALTER.
7. La migración es **solo aditiva** (columnas nullable + tabla nueva `zonas_reparto`, ver §3 del
   plan). Prohibido: DROP, ALTER de columnas existentes, UPDATE masivos.
8. Escribe el SQL de la migración también en el repo de la app bajo `docs/migrations/` (para que
   quede versionado en git, ya que el VPS no tiene git).
9. Tras desplegar el API, verifica de inmediato que los endpoints viejos siguen respondiendo
   igual (smoke test: `GET /barrios`, login, `GET /clientes/direcciones` con un token de prueba)
   — los campos nuevos son opcionales, un cliente 1.0.x NO debe notar ningún cambio. Si algo
   falla, restaura los `.bak` y reinicia el servicio.
10. Pregunta al usuario **antes** de reiniciar el servicio del API en el VPS (es producción).

## Alcance — EXACTAMENTE la Fase 1 del plan (§7), nada más

1. **Migración BD** (§3 del plan): columnas nullable en `direcciones_cliente` y `pedidos`
   (`lat`, `lng`, `precision_m`, `metodo_ubicacion`, `geocoded_direccion`, `fuera_zona`,
   `ubicacion_at` solo en direcciones) + tabla `zonas_reparto` + CHECKs. Sin PostGIS, sin índices geo.
2. **Backend** (§4): extender `POST/GET /clientes/direcciones` (el GET además corrige la omisión
   de `barrio_id`), `POST /pedidos` (snapshot lat/lng), SELECTs de `pedidos-staff.js`; nuevo
   `GET /cobertura?lat=&lng=` con bounding box de Florencia (1.55..1.68 / -75.68..-75.55) y
   rate-limit; el servidor calcula `fuera_zona` (nunca lo acepta del cliente). En Fase 1
   `fuera_zona=true` NO rechaza pedidos, solo marca.
3. **App** (§2.1): `npx expo install expo-location` + config plugin en `app.json` con el purpose
   string exacto del plan (§6.1); botón "Usar mi ubicación actual" en el formulario de nueva
   dirección (en `app/(tabs)/cart.tsx` y `app/profile/direcciones.tsx`); permiso SOLO al tocar el
   botón (`requestForegroundPermissionsAsync` → `getCurrentPositionAsync({ accuracy: High })`,
   timeout 8 s); reverse geocode con `Location.reverseGeocodeAsync` UNA vez al capturar; estados
   capturando/±X m/quitar; fallbacks completos (denegado, `canAskAgain===false` → abrir Ajustes,
   timeout → manual). La dirección escrita SIGUE siendo obligatoria. Tipos nuevos en
   `src/lib/api.ts` (§4.8). NO agregues pantalla de mapa ni `react-native-maps` (eso es Fase 2).
4. **Admin** (`/opt/polo/src/packages/app-admin/src/views/Pedidos.jsx`): bloque de ubicación solo
   si `lat != null` — precisión, `geocoded_direccion`, aviso fuera de zona, y botones
   `https://www.google.com/maps/dir/?api=1&destination=lat,lng`,
   `https://waze.com/ul?ll=lat,lng&navigate=yes` y copiar coordenadas (§5). Haz backup del build
   anterior antes de desplegar a `/var/www/estanco-admin`.
5. **Privacidad/objetos de tienda**: NO los hagas tú — deja un checklist en el PR/resumen final
   (Nutrition Label, Data Safety, política de privacidad, ver §6 y §8 del plan) para que el
   usuario los complete en las consolas.

## Restricciones técnicas
- UI y comentarios en español (Colombia). Sin coordenadas en AsyncStorage, logs del API, Sentry
  ni eventos de Meta (`src/lib/metaEvents.ts` — verifica con grep que ningún evento incluya lat/lng).
- No subas la versión todavía (el bump a 1.1.0 + buildNumber/versionCode 56 se hace al preparar
  el release, no en la feature branch — o hazlo en un commit separado y claramente marcado).
- Tests: el repo usa vitest — agrega tests para los tipos/helpers nuevos de `api.ts` y corre
  `npm test` y `npm run lint` antes de cada commit importante.
- Orden de trabajo recomendado: (a) migración SQL escrita y revisada → (b) backend en VPS con
  backups → smoke test → (c) app en la rama → (d) admin. El backend puede salir antes que la app
  sin romper nada (campos opcionales).

## Definición de "terminado"
- [ ] Rama `feature/geolocalizacion-fase1` pusheada, con migración SQL versionada en `docs/migrations/`.
- [ ] Migración aplicada en `polo_dashboard` con dump previo verificado.
- [ ] Endpoints extendidos + `GET /cobertura` funcionando; smoke test de endpoints viejos OK.
- [ ] Botón "Usar mi ubicación" con todos los fallbacks; probado al menos en un simulador/dispositivo
      (en iOS Simulator: Features > Location para simular; ideal dispositivo real).
- [ ] Admin muestra links Maps/Waze en pedidos con pin; pedidos viejos se ven igual que antes.
- [ ] `npm test` y `npm run lint` en verde en la rama.
- [ ] Resumen final con: qué se tocó en el VPS (archivos + backups creados), checklist pendiente
      de tiendas/privacidad, y qué falta para el release 1.1.0.

Si algo del plan contradice lo que encuentras en el código real, detente, reporta la discrepancia
y propón el ajuste antes de seguir (el plan se escribió verificando el código el 2026-07-12).
