# PLAN — Geolocalización de entrega (v1.1.0+)

**Fecha:** 2026-07-12 · **App:** Estanco Caquetá Express (Expo SDK 55.0.24, RN 0.83.6) ·
**Backend:** Node/Express + PostgreSQL 16.14 (`polo_dashboard`, VPS) · **Admin:** `app-admin` (React/Vite → `/var/www/estanco-admin`)

Documento de diseño para capturar **lat/lng del punto de entrega** (pin en mapa, con GPS como
punto de partida), manteniendo la entrada manual como fallback. **No implementa nada**; define
qué, cómo, en qué orden y cuánto cuesta.

---

## 0. Estado actual VERIFICADO (2026-07-12) y correcciones al supuesto inicial

Verificado contra el repo y la BD del VPS (`ssh polo`):

| Supuesto | Realidad verificada |
|---|---|
| Tabla `barrios` | **Se llama `barrios_florencia`** (`id`, `nombre`, `comuna`, `activo`; UNIQUE en `lower(nombre)`). FK desde `clientes`, `direcciones_cliente` y `pedidos`. Sin polígonos. ✔ |
| Rutas API en `/opt/polo/src/packages/api/routes/` | Están en **`/opt/polo/src/packages/api/src/routes/`** (`clientes.js`, `pedidos.js`, `barrios.js`, `pedidos-staff.js`). |
| Endpoints direcciones GET/POST/PUT/DELETE | **No existe PUT de edición.** Solo: `GET /clientes/direcciones`, `POST`, `PUT /:id/predeterminada`, `DELETE /:id` (soft-delete `activo=false`). La app tampoco edita (solo crear/eliminar/predeterminada). |
| — | `GET /clientes/direcciones` **no devuelve `barrio_id`** (solo `id, etiqueta, direccion, barrio, notas, predeterminada`), aunque el tipo `DireccionGuardada` de la app lo declara opcional. Bug menor a corregir de paso. |
| Sin lat/lng en BD | Confirmado: **cero columnas geo** en `direcciones_cliente`, `clientes`, `pedidos`. Solo extensión `plpgsql` (sin PostGIS). |
| Sin expo-location / mapas | Confirmado: no están en `package.json` ni en plugins de `app.json`. Sí están `expo-secure-store` y `expo-tracking-transparency`. |
| Volumen | **La app está recién lanzada**: ~2 pedidos en los últimos 90 días, 13 direcciones activas. 1.0.2 en curso (buildNumber/versionCode 55). Cualquier free tier sobra por años. |
| Flujo checkout | `app/(tabs)/cart.tsx` → `handlePedir()`: usa dirección guardada activa o crea una nueva (`crearDireccion`) y luego `crearPedido` (idempotency key). El pedido **copia** dirección/barrio como snapshot de texto. |
| Admin | Fuente en `/opt/polo/src/packages/app-admin` (la vista relevante es `src/views/Pedidos.jsx`). `pedidos-staff.js` sirve `GET /`, `GET /:id`, `PUT /:id/estado`, etc. |

Implicación de diseño nueva: **"editar dirección con mapa" requiere crear el endpoint
`PUT /clientes/direcciones/:id`** (hoy inexistente) o mantener el patrón actual crear+eliminar.
Se recomienda crear el PUT (Fase 2).

---

## 1. Decisiones: librería + proveedor + costo

### 1.1 Recomendación (una decisión por capa)

| Capa | Fase 1 (MVP) | Fase 2 | Por qué |
|---|---|---|---|
| Captura GPS | **`expo-location@55.1.11`** (dist-tag `sdk-55`) | igual | Oficial, estable, foreground-only. Config plugin escribe permisos iOS+Android. $0. |
| Mapa | **Ninguno** (sin pantalla de mapa) | **`react-native-maps@^1.29.0`** | Ver 1.2. |
| Proveedor de mapa iOS | — | **Apple Maps** (`PROVIDER_DEFAULT`) | Sin API key, sin costo, sin billing. |
| Proveedor de mapa Android | — | **Google Maps SDK for Android** | Cargas de mapa móviles **gratis e ilimitadas** (pricing oficial vigente). Requiere API key + billing account (mitigación: cuotas + alertas, ver 1.4). |
| Reverse geocoding | **`Location.reverseGeocodeAsync()`** (servicio nativo del SO: Apple en iOS, Google en Android) | igual; **LocationIQ** (5.000 req/día gratis, uso comercial permitido) como plan B server-side si se necesita re-geocodificar desde el admin | $0, sin key, se llama UNA vez al capturar (no por render). En Florencia el reverse es solo texto aproximado de apoyo — el pin es la verdad. |
| Autocomplete de direcciones | **NO usar** | NO usar | En Florencia OSM tiene 24 números de placa y 0 barrios mapeados; Google no garantiza nivel de placa. El pin + texto libre del usuario + catálogo propio de barrios (`barrios_florencia`) es superior y gratis. |
| Geocerca | Bounding box en servidor | **Polígono único de zona de reparto, point-in-polygon en Node** | Sin PostGIS: innecesario a este volumen (ver §5). |

### 1.2 Por qué `react-native-maps` y NO `expo-maps` (verificado 2026-07-12)

- `expo-maps@55.0.20` sigue **en alpha** ("subject to breaking changes", README oficial rama sdk-55).
- En iOS exige **deployment target 18.0** → excluiría iPhones viejos, relevantes en Florencia.
- **No soporta marker arrastrable en Apple Maps (iOS)** — falla justo el requisito de Fase 2.
- `react-native-maps` 1.29.0 (28/06/2026): estable, `draggable` **en ambas plataformas**, Apple Maps
  sin key en iOS, Nueva Arquitectura OK vía interop. El bug del config plugin con el AppDelegate de
  SDK 55 ([react-native-maps#5843](https://github.com/react-native-maps/react-native-maps/issues/5843))
  está corregido desde **1.27.2** (11/03/2026) y solo afectaba Google-Maps-en-iOS, que no usaremos.
- Plan B sin Google: `@maplibre/maplibre-react-native` + tiles OpenFreeMap. Reevaluar `expo-maps`
  cuando salga de alpha + baje de iOS 18 + soporte draggable en iOS (hoy no cumple ninguna).

Fuentes: [Changelog SDK 55](https://expo.dev/changelog/sdk-55) (25/02/2026) · [docs expo-maps v55](https://docs.expo.dev/versions/v55.0.0/sdk/maps/) · [docs map-view v55](https://docs.expo.dev/versions/v55.0.0/sdk/map-view/) · [docs expo-location v55](https://docs.expo.dev/versions/v55.0.0/sdk/location/) — consultadas 2026-07-12.

### 1.3 Costo mensual estimado: **US$0**

Volumen actual ≈ decenas de pedidos/mes; proyección optimista 15–40 pedidos/día (~500–1.200/mes,
~1–3 geocodes/pedido). Precios verificados 2026-07-12:

| Componente | Free tier vigente | Nuestro consumo | Costo |
|---|---|---|---|
| Apple Maps / MapKit (iOS) | Ilimitado, sin key | — | $0 |
| Google Maps SDK Android (mapa) | **Ilimitado** ("All mobile usage… is unlimited", docs oficiales) | — | $0 |
| Reverse geocode nativo (`reverseGeocodeAsync`) | Servicio del SO, sin cuota facturable | 1×/captura | $0 |
| (Plan B) LocationIQ | 5.000 req/día gratis, comercial OK, sin tarjeta | <100/día | $0 |
| (No usar) Google Geocoding API | 10.000 gratis/mes (modelo Essentials post-marzo-2025), luego US$5/1.000 | 0 | $0 |

Puntos de quiebre lejanos: Google Geocoding empezaría a cobrar a ~333 pedidos/día; LocationIQ a
~1.600+/día. **El feature no introduce ningún costo recurrente** — compatible con el margen ~7%.
Fuentes: [Google pricing](https://developers.google.com/maps/billing-and-pricing/pricing) · [cambios marzo 2025](https://developers.google.com/maps/billing-and-pricing/march-2025) · [Maps SDK Android usage & billing](https://developers.google.com/maps/documentation/android-sdk/usage-and-billing) · [LocationIQ](https://locationiq.com/pricing) · [Mapbox](https://www.mapbox.com/pricing) — 2026-07-12.

### 1.4 Único costo/riesgo administrativo: billing de Google Cloud (solo Fase 2, solo Android)

La API key del Maps SDK for Android exige cuenta de facturación con tarjeta aunque el uso sea $0.
Mitigación obligatoria al crearla:
1. Restringir la key por **package name + huella SHA-1** y por API (solo "Maps SDK for Android").
2. Cuotas: límite diario bajo en cada API no usada (0) y alerta de presupuesto en US$1.
3. La key vive en `app.json` (plugin `react-native-maps`) — es pública por naturaleza; la
   restricción por package+SHA-1 es la defensa real.

---

## 2. Flujos UX (nivel wireframe)

Principio rector (validado con datos de OSM/Google en Florencia): **el pin es la fuente de verdad;
el texto (dirección + barrio + referencias) es lo que el domiciliario lee; el reverse geocode es
solo prellenado editable.** Nunca bloquear un pedido por falta de GPS.

### 2.1 Fase 1 — "Usar mi ubicación" (sin pantalla de mapa)

**Dónde:** formulario de nueva dirección (en `cart.tsx` inline y en `app/profile/direcciones.tsx`).

```
┌─────────────────────────────────────────┐
│ Nueva dirección                         │
│                                         │
│ [📍 Usar mi ubicación actual]   ← botón │
│    ├─ tocado → pide permiso (1ª vez)    │
│    ├─ capturando… (spinner ~2-4 s)      │
│    └─ ✔ Ubicación guardada (±12 m)      │
│       "Cra 15, Comuna Norte" (aprox.)   │  ← reverse geocode, solo informativo
│       [Quitar ubicación ✕]              │
│                                         │
│ Dirección *   [Carrera 15 # 12-34    ]  │  ← SIGUE SIENDO OBLIGATORIA
│ Barrio        [BarrioSelector actual ]  │
│ Referencias   [Portón café, 2º piso  ]  │
│ Etiqueta      [Casa ▾]                  │
│                                         │
│            [Guardar dirección]          │
└─────────────────────────────────────────┘
```

- Permiso: `requestForegroundPermissionsAsync()` **solo al tocar el botón** (nunca al abrir la app
  — protege guest-browsing y review). Si `granted` → `getCurrentPositionAsync({ accuracy: High })`.
- Si `accuracy > 50 m`: mostrar "ubicación aproximada (±X m) — revisa las referencias" y guardar
  igual con su `precision_m`.
- **Fallback permiso denegado:** el botón muestra "Sin acceso a tu ubicación — puedes escribir la
  dirección normalmente". Si `canAskAgain === false`, enlace "Abrir Ajustes" (`Linking.openSettings()`).
  El formulario manual es idéntico al actual: **nada se rompe**.
- **Fallback sin señal/timeout (8 s):** toast "No pudimos obtener tu ubicación" + formulario manual.
- **Fuera de zona (validación al guardar, ver §5):** aviso no bloqueante en Fase 1 —
  "Esta ubicación parece estar fuera de Florencia. Verifica el pin o escribe bien tu dirección."
  Se guarda con flag `fuera_zona` para que el staff lo vea (el negocio hoy confirma pedidos
  manualmente; no queremos falsos negativos de GPS bloqueando ventas reales).

### 2.2 Fase 2 — pantalla de mapa con pin (patrón "mapa se mueve bajo pin fijo")

Nueva ruta `app/ubicacion.tsx` (modal expo-router), abierta desde el formulario de dirección.
Se usa **pin fijo centrado + mover el mapa** (patrón Rappi/Uber): más preciso con el dedo que
arrastrar un marker y evita diferencias iOS/Android de `draggable`.

```
┌─────────────────────────────────────────┐
│ ← Ubica tu punto de entrega             │
│ ┌─────────────────────────────────────┐ │
│ │                                     │ │
│ │              🗺 MAPA                │ │
│ │               📍  ← pin FIJO centro │ │
│ │                                     │ │
│ │                      [⌖] ← recentrar│ │
│ └─────────────────────────────────────┘ │
│ Cra 15 # 12-30 aprox., Comuna Norte     │ ← reverse geocode al soltar (debounce 600 ms)
│ ⚠ solo si aplica: "Fuera de la zona de  │
│    reparto de Florencia"                │
│         [Confirmar este punto]          │ ← deshabilitado si fuera de zona
└─────────────────────────────────────────┘
```

- Apertura: centra en GPS si hay permiso; si no, centra en Florencia (1.6144, -75.6062, zoom 15)
  y el usuario navega manualmente — **el mapa funciona sin permiso de ubicación**.
- `onRegionChangeComplete` → coordenada del centro → validación de cobertura **client-side**
  (polígono descargado de `GET /cobertura/zona`, cacheado con TanStack Query) para feedback
  inmediato + reverse geocode nativo para el texto.
- "Confirmar" devuelve `{lat, lng, precision_m: null, metodo: 'pin_mapa', geocoded_direccion}` al
  formulario. La `precision_m` solo aplica a capturas GPS (`metodo: 'gps'`).
- **Fuera de zona (Fase 2, bloqueante en el mapa):** banner rojo + botón deshabilitado + CTA
  "Escribir dirección manualmente" (algún cliente pide para un tercero en el borde de la zona —
  el texto manual sigue disponible, y el servidor marca `fuera_zona` en vez de rechazar).
- Editar dirección guardada: mismo modal, centrado en el pin existente (requiere el nuevo
  `PUT /clientes/direcciones/:id`).
- Checkout: la tarjeta de dirección seleccionada muestra un badge "📍 con ubicación" para que el
  usuario sepa qué direcciones ya tienen pin; tocarlo abre el mapa en modo edición.

### 2.3 Diferencias iOS vs Android (ambas plataformas son primera clase)

| Tema | iOS | Android |
|---|---|---|
| Permiso | `NSLocationWhenInUseUsageDescription` (string en español, escrito por el config plugin) | `ACCESS_FINE_LOCATION` + `ACCESS_COARSE_LOCATION` (config plugin); Android 12+ permite al usuario elegir "aproximada" → leer `accuracy` devuelto |
| Mapa (F2) | Apple Maps, sin key | Google Maps, key restringida por package+SHA-1 |
| Reverse geocode nativo | Apple (CLGeocoder) | Google (Geocoder del SO) |
| Deep link navegación | `LSApplicationQueriesSchemes`: agregar `comgooglemaps` y `waze` (para `canOpenURL`); fallback universal `https://` | Intents estándar, sin declaración extra |
| Reducción de precisión | iOS puede dar "precisión reducida" (SDK 55 la reporta en la respuesta del permiso) → tratar como `accuracy` alto y avisar | usuario puede elegir "coarse" → ídem |

---

## 3. Migración de BD (retrocompatible, todo nullable)

Sin PostGIS (PG 16.14 solo tiene `plpgsql`): a este volumen `numeric` + point-in-polygon en Node
sobra; instalar PostGIS es mantenimiento sin retorno. Reevaluar solo si algún día se necesita
ruteo/distancias masivas.

```sql
-- 2026-07-XX_geolocalizacion.sql
BEGIN;

ALTER TABLE direcciones_cliente
  ADD COLUMN lat                numeric(9,6),
  ADD COLUMN lng                numeric(9,6),
  ADD COLUMN precision_m        numeric(6,1),          -- accuracy GPS en metros; NULL si metodo='pin_mapa' o 'manual'
  ADD COLUMN metodo_ubicacion   text NOT NULL DEFAULT 'manual'
      CHECK (metodo_ubicacion IN ('manual','gps','pin_mapa')),
  ADD COLUMN geocoded_direccion text,                  -- texto del reverse geocode al capturar (solo display)
  ADD COLUMN fuera_zona         boolean,               -- resultado de la validación server-side al guardar
  ADD COLUMN ubicacion_at       timestamptz,           -- cuándo se capturó (retención Ley 1581)
  ADD CONSTRAINT chk_dir_latlng_par CHECK ((lat IS NULL) = (lng IS NULL)),
  ADD CONSTRAINT chk_dir_latlng_rango CHECK (
    lat IS NULL OR (lat BETWEEN -4.5 AND 13.5 AND lng BETWEEN -82 AND -66)  -- sanity: Colombia
  );

ALTER TABLE pedidos                                     -- snapshot al momento del pedido (igual que direccion/barrio hoy)
  ADD COLUMN lat                numeric(9,6),
  ADD COLUMN lng                numeric(9,6),
  ADD COLUMN precision_m        numeric(6,1),
  ADD COLUMN metodo_ubicacion   text,
  ADD COLUMN geocoded_direccion text,
  ADD COLUMN fuera_zona         boolean,
  ADD CONSTRAINT chk_ped_latlng_par CHECK ((lat IS NULL) = (lng IS NULL));

-- Zona de reparto (un solo polígono; editable sin deploy)
CREATE TABLE zonas_reparto (
  id         serial PRIMARY KEY,
  nombre     text NOT NULL,                 -- 'Florencia'
  poligono   jsonb NOT NULL,                -- [[lat,lng],...] anillo cerrado GeoJSON-like
  activo     boolean NOT NULL DEFAULT true,
  updated_at timestamptz DEFAULT now()
);

COMMIT;
```

Decisiones:
- **`clientes` NO recibe lat/lng.** Sus campos `direccion/barrio/notas_direccion` son legado del
  perfil (pre-`direcciones_cliente`); duplicar geo ahí crea una tercera copia de la verdad. La
  dirección predeterminada del cliente ya vive en `direcciones_cliente.predeterminada`.
- `pedidos` copia lat/lng como **snapshot** (consistente con cómo hoy copia `direccion`/`barrio`):
  si el cliente edita la dirección después, el pedido histórico no cambia.
- Sin índices geo: no hay consultas espaciales (solo lectura por pedido). `numeric(9,6)` ≈ 11 cm.
- Direcciones viejas: quedan `lat=NULL, metodo='manual'` — todo el código debe tratar NULL como
  "sin pin" (la app y el admin muestran el bloque de mapa/link solo si `lat != null`).
- Polígono inicial de `zonas_reparto`: dibujar en [geojson.io](https://geojson.io) sobre Florencia
  (30 min de trabajo del negocio, ~20-40 vértices cubriendo el perímetro urbano + veredas donde sí
  se entrega). Hasta que exista, el servidor usa bounding box `1.55..1.68 / -75.68..-75.55`.

Retención (Ley 1581, principio de temporalidad) — job mensual (cron ya existente en el VPS o
`pg_cron` no disponible → cron de sistema):

```sql
-- Disociar coordenadas de pedidos viejos (la factura no necesita lat/lng)
UPDATE pedidos SET lat = NULL, lng = NULL, precision_m = NULL, geocoded_direccion = NULL
WHERE entregado_at < now() - interval '12 months' AND lat IS NOT NULL;
-- direcciones_cliente: viven mientras la cuenta exista; DELETE /clientes/me ya las borra (verificado).
```

---

## 4. Contrato de API (antes / después)

Todos los campos nuevos son **opcionales** → clientes 1.0.x siguen funcionando sin cambios.
Validación server-side común: `lat`/`lng` llegan juntos o ninguno, números finitos, dentro del
sanity-check de Colombia; si vienen, el servidor calcula `fuera_zona` él mismo (**el cliente nunca
manda `fuera_zona`** — el servidor es la autoridad).

### 4.1 `POST /clientes/direcciones` (existente, se extiende)

```jsonc
// ANTES                                  // DESPUÉS (campos nuevos opcionales)
{                                         {
  "etiqueta": "Casa",                       "etiqueta": "Casa",
  "direccion": "Cra 15 # 12-34",            "direccion": "Cra 15 # 12-34",
  "barrio": "Centro",                       "barrio": "Centro",
  "barrio_id": 7,                           "barrio_id": 7,
  "notas": "Portón café",                   "notas": "Portón café",
  "predeterminada": true                    "predeterminada": true,
}                                           "lat": 1.614400,
                                            "lng": -75.606200,
                                            "precision_m": 12.5,          // solo metodo='gps'
                                            "metodo_ubicacion": "gps",    // 'gps' | 'pin_mapa'
                                            "geocoded_direccion": "Cra 15, Comuna Norte, Florencia"
                                          }
// Respuesta: la fila completa (RETURNING *) — ya incluye los campos nuevos + fuera_zona calculado.
```

### 4.2 `GET /clientes/direcciones` (existente, se extiende el SELECT)

```sql
-- ANTES: id, etiqueta, direccion, barrio, notas, predeterminada
-- DESPUÉS (+ corrige la omisión actual de barrio_id):
SELECT id, etiqueta, direccion, barrio, barrio_id, notas, predeterminada,
       lat, lng, precision_m, metodo_ubicacion, geocoded_direccion, fuera_zona
FROM direcciones_cliente WHERE cliente_id = $1 AND activo = true ...
```

### 4.3 `PUT /clientes/direcciones/:id` (**NUEVO** — hoy no existe edición)

Mismo body que el POST; actualiza solo campos presentes (`COALESCE` como en `PUT /perfil`).
Necesario para "editar pin de una dirección guardada" (Fase 2) sin el hack crear+eliminar.
`WHERE id = $N AND cliente_id = $M AND activo = true`.

### 4.4 `POST /pedidos` (existente, se extiende)

```jsonc
// DESPUÉS — añade al body actual (direccion, barrio, barrio_id, notas_cliente, lineas, ...):
{
  ...,
  "lat": 1.614400, "lng": -75.606200,
  "precision_m": 12.5, "metodo_ubicacion": "gps",
  "geocoded_direccion": "Cra 15, Comuna Norte, Florencia"
}
```
El INSERT de `pedidos.js` añade las 6 columnas nuevas. La app manda el snapshot de la dirección
seleccionada (igual que hoy manda su texto). El servidor recalcula `fuera_zona` — nunca confía en
el cliente. Fase 1: `fuera_zona=true` **no rechaza** el pedido, solo lo marca (el staff confirma
por WhatsApp/llamada como hoy); esto evita perder ventas por deriva de GPS.

### 4.5 `GET /cobertura?lat=&lng=` (**NUEVO**, público con rate-limit)

```jsonc
// 200 → { "dentro": true, "zona": "Florencia" }
// 200 → { "dentro": false, "zona": null }
// 400 → { "error": "lat/lng inválidos" }
```
Implementación: ray-casting (~15 líneas de JS puro) contra `zonas_reparto.poligono` cacheado en
memoria del proceso (recarga cada 10 min). Sin PostGIS, sin dependencias.

### 4.6 `GET /cobertura/zona` (**NUEVO**, Fase 2)

Devuelve el polígono activo para la validación client-side del mapa (UX instantánea). El servidor
sigue siendo la autoridad al guardar.

### 4.7 `pedidos-staff.js` — `GET /` y `GET /:id` (existente, se extiende)

Añadir `lat, lng, precision_m, metodo_ubicacion, geocoded_direccion, fuera_zona` a los SELECT.
Es lo que alimenta el link de navegación del admin (§5).

### 4.8 Cambios en `src/lib/api.ts` (app)

```ts
export interface DireccionGuardada {
  // ... campos actuales
  lat?: number | null; lng?: number | null;
  precision_m?: number | null;
  metodo_ubicacion?: 'manual' | 'gps' | 'pin_mapa';
  geocoded_direccion?: string | null;
  fuera_zona?: boolean | null;
}
// CrearPedidoInput: mismos 5 campos opcionales.
// Nueva: validarCobertura(lat, lng) → GET /cobertura
```

---

## 5. Lado admin / domiciliario (el mayor ROI — va en Fase 1)

En `app-admin/src/views/Pedidos.jsx`, en la tarjeta/detalle del pedido, **solo si `lat != null`**:

```
📍 Ubicación del cliente (GPS ±12 m)          ← precision_m + metodo
   Cra 15, Comuna Norte (aprox.)              ← geocoded_direccion
   ⚠ FUERA DE ZONA                            ← solo si fuera_zona
   [🗺 Google Maps]  [🚗 Waze]  [📋 Copiar coords]
```

Deep links (funcionan desde el navegador móvil del domiciliario — el admin es una SPA web, así
que se usan URLs universales, no schemes):

```js
const gmaps = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
const waze  = `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
// (Si algún día hay app nativa de domiciliario: geo:lat,lng?q=lat,lng(Pedido #id) en Android,
//  y comgooglemaps:// / waze:// con LSApplicationQueriesSchemes en iOS.)
```

Fase 2 (opcional, barato): mini-mapa estático en el detalle con **Leaflet + tiles OSM** (gratis,
atribución "© OpenStreetMap contributors") — solo visualización puntual, dentro de la política de
uso de tiles. Sin API keys en el admin.

Los pedidos sin coordenadas (histórico y fallback manual) se ven exactamente como hoy.

---

## 6. Permisos, review y privacidad

### 6.1 `app.json` (Fase 1 — solo expo-location)

```jsonc
"plugins": [
  // ... existentes
  ["expo-location", {
    "locationWhenInUsePermission":
      "Usamos tu ubicación únicamente para fijar el punto de entrega de tu pedido y facilitar el domicilio."
  }]
]
// Fase 2 añade: ["react-native-maps", { "androidGoogleMapsApiKey": "AIza..." }]
// y en ios.infoPlist.LSApplicationQueriesSchemes: + "comgooglemaps", "waze" (solo si la app
// cliente llegara a abrir navegación; el admin web no lo necesita).
```

Nunca pedir background (`isIosBackgroundLocationEnabled`/`ACCESS_BACKGROUND_LOCATION`): no se
necesita, y en Play **su sola presencia en el manifest mergeado dispara el formulario de permisos
sensibles**. Verificar el AAB final (`aapt dump permissions`) porque una librería podría inyectarlo.

### 6.2 Review (investigado 2026-07-12, fuentes en informes)

| | Apple | Google Play |
|---|---|---|
| Alcohol | Permitido vender legalmente a adultos (1.4.3 prohíbe fomentar exceso/menores). La app ya tiene age gate (`edad_confirmada`) ✔ y rating 17+/18+ | Permitido; en el cuestionario **"Age-Restricted Physical Goods" responder SÍ** (la app se centra en licores). Target audience: solo 18+ |
| Ubicación | 5.1.5: while-in-use para entregas es "directamente relevante" → sin fricción. Riesgo real de rechazo: **purpose string vago** — usar el texto específico de arriba | **Foreground/while-in-use NO requiere el formulario de declaración ni "prominent disclosure"** (eso es solo background). Cumplir "minimum scope" |
| Declaración de datos | Privacy Nutrition Label: **Location → Precise Location → Data Linked to You → App Functionality** | Data Safety: **Location → Precise location, Collected (no ephemeral), App functionality**, borrado disponible (ya existe `DELETE /clientes/me`) |
| Guest browsing | El permiso se pide solo al tocar "Usar mi ubicación" dentro del checkout — el browsing anónimo no toca ubicación ✔ §5.1.1(v) | n/a |

### 6.3 Ley 1581 de 2012 (Colombia)

- Coordenadas de entrega = **dato personal ordinario, no sensible** (art. 5 no incluye ubicación;
  lectura conservadora: tratarlas con seguridad reforzada). No es asesoría legal — validar la
  política final con abogado.
- **Autorización informada:** actualizar la Política de Tratamiento de Datos (URL en la app y en
  ambas fichas de tienda) añadiendo la finalidad "ubicación del punto de entrega para gestionar el
  domicilio". El purpose string del SO + aceptación de política con timestamp cubren la prueba de
  autorización.
- **RNBD: no aplica** (umbral 100.000 UVT ≈ $5.237M COP de activos en 2026; Decreto 090/2018).
- **Almacenamiento:** solo server-side (ya es así por diseño — la app no persiste direcciones en
  AsyncStorage; verificado que el store de carrito no guarda coordenadas). Nunca loguear lat/lng
  en logs del API ni mandarlas a Sentry/Meta (revisar `metaEvents.ts`: los eventos de compra NO
  deben incluir coordenadas).
- **Retención:** disociar lat/lng de pedidos a los 12 meses de entregados (job §3); direcciones
  guardadas viven con la cuenta y mueren con `DELETE /clientes/me` (ya borra `direcciones_cliente` ✔).

---

## 7. Plan por fases, esfuerzo y riesgos

### Fase 1 — MVP "captura + link para el domiciliario" (release 1.1.0) — **3.5–5 días-dev**

| # | Tarea | Est. |
|---|---|---|
| 1 | Migración SQL §3 (columnas + `zonas_reparto` + bounding box provisional) | 0.5 d |
| 2 | Backend: extender POST/GET direcciones, POST pedidos, pedidos-staff; `GET /cobertura` con bbox; cálculo `fuera_zona` | 1 d |
| 3 | App: `expo-location` + plugin + botón "Usar mi ubicación" en formulario de dirección (cart + direcciones), reverse geocode de prellenado, fallbacks de permiso/timeout, tipos en `api.ts` | 1.5 d |
| 4 | Admin: bloque ubicación + links Google Maps/Waze/copiar en `Pedidos.jsx` | 0.5 d |
| 5 | Política de privacidad + Data Safety + Nutrition Label + strings; build EAS 1.1.0 (iOS 56 / Android 56) + QA en dispositivos reales (iOS y Android, permiso concedido/denegado/reducido) | 0.5–1 d |

**Sin pantalla de mapa** — el cliente no "ve" el pin todavía, pero el domiciliario ya recibe
navegación exacta, que es el 80% del valor. La dirección escrita sigue siendo obligatoria.

### Fase 2 — mapa con pin + geocerca real (release 1.2.0) — **5–7 días-dev**

| # | Tarea | Est. |
|---|---|---|
| 1 | `react-native-maps` 1.29+, API key Android (restringida, cuotas, alerta $1), prebuild, pantalla `app/ubicacion.tsx` (pin fijo centrado, recentrar, reverse con debounce) | 2.5 d |
| 2 | Polígono real de zona (dibujar en geojson.io con el negocio), `GET /cobertura/zona`, point-in-polygon server + client, UX fuera-de-zona bloqueante en mapa | 1 d |
| 3 | `PUT /clientes/direcciones/:id` + edición de pin en direcciones guardadas + badge "📍" en checkout | 1 d |
| 4 | Admin: mini-mapa Leaflet/OSM en detalle de pedido | 0.5 d |
| 5 | Job de retención 12 meses + QA + build 1.2.0 | 1 d |

**Futuro (fuera de alcance, solo mencionado):** tracking en vivo del domiciliario, ruteo
multi-pedido, polígonos por barrio para tarifas de domicilio dinámicas.

### Riesgos y mitigaciones

| Riesgo | Prob. | Mitigación |
|---|---|---|
| Deriva de GPS (30–100 m en interiores) manda al domiciliario a la casa equivocada | Alta | `precision_m` visible para el staff ("±80 m" = confiar más en el texto); referencias siguen obligatorias; pin editable en Fase 2 |
| Cliente pide "para otra dirección" usando su GPS actual | Media | Copy claro: "¿Entregar donde estás ahora?"; en F2 el mapa permite mover el pin a cualquier punto |
| Falsos "fuera de zona" bloquean ventas | Media | F1: marcar sin bloquear; F2: bloquea solo el mapa, el fallback manual siempre existe; polígono generoso |
| Billing Google Cloud (key Android) genera cobro inesperado | Baja | Solo Fase 2; key restringida package+SHA-1, cuotas a 0 en APIs no usadas, alerta US$1; mapa móvil es ilimitado-gratis por contrato de precios vigente |
| Rechazo de review por purpose string / declaración de datos | Baja | Strings específicos §6.1, labels §6.2; permiso solo bajo gesto del usuario |
| Prebuild/AppDelegate SDK 55 con react-native-maps | Baja | Bug ya corregido en ≥1.27.2 (usaremos 1.29+); no usamos Google-en-iOS que era el caso afectado |
| `expo-updates`: mandar por OTA código que importa módulos nativos nuevos | Media | Disciplina de release: TODO lo de F1/F2 sale en build nativo (`runtimeVersion: appVersion` ya protege — 1.1.0 es runtime distinto); no publicar OTA de estas ramas sobre 1.0.x |
| Coordenadas filtradas a Meta/Sentry | Media | Checklist de PR: grep de `lat`/`lng` en `metaEvents.ts` y breadcrumbs de Sentry; test unitario del payload de eventos |

---

## 8. Checklist de rollout 1.1.0

1. Migración SQL en `polo_dashboard` (backup previo con `pg_dump`).
2. Deploy API (los campos son opcionales → puede salir **antes** que la app sin romper 1.0.x).
3. Deploy admin con links de navegación (funciona apenas llegue el primer pedido con pin).
4. App: `npx expo install expo-location`, plugin + purpose string, feature, bump a **1.1.0**
   (buildNumber 56 / versionCode 56), `eas build` ambas plataformas.
5. App Store Connect: Nutrition Label (Precise Location/Linked/App Functionality) + nota de review:
   "La ubicación (solo while-in-use) fija el punto de entrega del pedido; se solicita únicamente al
   tocar 'Usar mi ubicación' en el checkout".
6. Play Console: Data Safety (Precise location, collected, app functionality) + verificar que el
   AAB final NO contiene `ACCESS_BACKGROUND_LOCATION`.
7. Publicar Política de Tratamiento de Datos actualizada (misma URL ya enlazada en las fichas).
8. QA en dispositivo real: conceder/denegar/`canAskAgain=false`/precisión reducida/avión;
   pedido con y sin pin; links Maps/Waze desde el celular del domiciliario.
9. Post-release: monitorear en Sentry los errores de `expo-location` y el % de pedidos con pin
   (query simple sobre `pedidos.lat IS NOT NULL`) para decidir prioridad de Fase 2.

---

## Apéndice — fuentes principales (todas consultadas 2026-07-12)

**Librerías:** [Expo SDK 55 changelog](https://expo.dev/changelog/sdk-55) · [expo-location v55](https://docs.expo.dev/versions/v55.0.0/sdk/location/) · [expo-maps v55](https://docs.expo.dev/versions/v55.0.0/sdk/maps/) (alpha, iOS 18+, sin draggable iOS) · [map-view v55](https://docs.expo.dev/versions/v55.0.0/sdk/map-view/) · [react-native-maps releases](https://github.com/react-native-maps/react-native-maps/releases) (1.29.0, 28/06/2026) · [issue #5843 fix SDK 55](https://github.com/react-native-maps/react-native-maps/issues/5843)
**Precios:** [Google Maps pricing](https://developers.google.com/maps/billing-and-pricing/pricing) · [modelo marzo 2025](https://developers.google.com/maps/billing-and-pricing/march-2025) · [Maps SDK Android — uso móvil ilimitado](https://developers.google.com/maps/documentation/android-sdk/usage-and-billing) · [Mapbox](https://www.mapbox.com/pricing) · [LocationIQ](https://locationiq.com/pricing) · [política Nominatim OSMF](https://operations.osmfoundation.org/policies/nominatim/)
**Florencia (verificación empírica):** consultas en vivo a Nominatim y Overpass API sobre el bbox urbano — 24 `addr:housenumber`, 0 barrios mapeados, reverse devuelve solo comuna.
**Review:** [App Review Guidelines 1.4.3 / 5.1.1 / 5.1.5](https://developer.apple.com/app-store/review/guidelines/) · [Apple privacy details](https://developer.apple.com/app-store/app-privacy-details/) · [Play — location permissions](https://support.google.com/googleplay/android-developer/answer/9799150) · [Play — restricted content alcohol](https://support.google.com/googleplay/android-developer/answer/9878810) · [Play — age-restricted goods](https://support.google.com/googleplay/android-developer/answer/7444750) · [Play — Data Safety](https://support.google.com/googleplay/android-developer/answer/10787469)
**Ley 1581:** [texto de la ley](http://www.secretariasenado.gov.co/senado/basedoc/ley_1581_2012.html) · [Decreto 1377/2013](https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=53646) · [Decreto 090/2018 — umbral RNBD](https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=85039) · UVT 2026 $52.374 (Res. DIAN 000238 de 15-12-2025)
