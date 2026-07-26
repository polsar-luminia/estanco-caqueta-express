# Plan de release 1.2.0 — Estanco Caquetá Express

> Acordado 2026-07-25. **Ejecución: semana del 27-jul (lunes).** El fin de semana no se toca nada.
> Sustituye a `PLAN-3-FUNCIONALIDADES.md`.

## Alcance

Siete bloques. Los tres primeros son lo que pidió el negocio; los demás salieron de la
investigación y de revisar los datos reales.

| | Bloque | Estado hoy |
|---|---|---|
| **A** | Zonas de reparto (multi-zona + editor) + **tarifa por zona** + **telemetría total** | Infra 65% construida, tabla vacía |
| **B** | Herramienta de domiciliarios | 30% (base en `pedidos-staff.js`) |
| **C** | Reseñas post-entrega | 0% |
| **D** | Motor de tiempo estimado (ETA) | 0% |
| **E** | Accesibilidad Nivel 1 | 25% de cobertura |
| **F** | Ubicación obligatoria en checkout | Opcional hoy |
| **G** | Release 1.2.0: build + bloqueo de versión | — |

## Estado verificado (2026-07-25)

**Geolocalización — ya construida (Fases 1 y 2, en producción):**
- `direcciones_cliente` y `pedidos` con `lat`, `lng`, `precision_m`, `metodo_ubicacion`,
  `geocoded_direccion`, `fuera_zona`, `ubicacion_at`
- `app/ubicacion.tsx`: mapa con pin fijo al centro (**el patrón correcto de la industria**),
  reverse geocoding con debounce 600 ms, valida cobertura y bloquea el botón fuera de zona
- `lib/cobertura.js`: ray-casting point-in-polygon, caché 10 min, autoridad server-side
- `GET /cobertura?lat&lng`, `GET /cobertura/zona`

**Los huecos:**
1. `zonas_reparto` **VACÍA** → hoy corre con un bounding box rectangular. **No hay bloqueo real.**
2. El modelo lee **un solo polígono** → no soporta exclusiones (el requisito difícil).
3. Ubicación **opcional** en checkout.
4. `recentrar()` en `ubicacion.tsx:118-125` **muere en silencio** si el permiso está negado.

**Datos que mandan sobre el diseño:**

| | Valor |
|---|---|
| Direcciones activas / con coordenadas | 69 / 27 (**39%**) |
| Pedidos últimos 30d / con coordenadas | 41 / 19 (46%) |
| Preparación (pedido→despacho) | promedio 59 min · **mediana 49** |
| Viaje (despacho→entrega) | promedio 102 min · **mediana 42** |
| Horas pico reales | 17h, 18h, 16h, 15h, 12h |
| Accesibilidad: tocables / con etiqueta | 110 / 27 (**25%**), 0 con hint |

> El abismo entre promedio (102) y mediana (42) del viaje confirma que `entregado_at` se sella
> cuando alguien le da clic en el admin, no cuando el domiciliario llega. **Usar siempre mediana.**
> Y preparación (49) pesa tanto como viaje (42): la cola y los domiciliarios disponibles son la
> mitad del ETA, no un ajuste menor.

## Decisiones tomadas

| Tema | Decisión |
|---|---|
| Versión | **1.2.0** (build 65), no 1.1.6 |
| Zonas | Editor de mapa en el admin (Leaflet + leaflet-draw, sin API key) |
| Direcciones sin coordenadas | Forzar el pin al siguiente pedido |
| Domiciliarios | Dentro del admin en `/domiciliario`, rol nuevo, cuenta por persona |
| Reseñas | Push al entregar + tarjeta en detalle + banner en Inicio |
| Tarifa dinámica | **Montada pero apagada** (`NULL` = precio global de hoy) |
| ETA | Motor completo con override manual; rangos anchos al inicio |
| Librerías nativas | **Ninguna nueva** — todo debe poder viajar por OTA |
| Bloqueo de versión | Sí, tras 1.2.0 vivo en **ambas** tiendas |

---

# A — Zonas de reparto + tarifa por zona

### Esquema
```sql
ALTER TABLE zonas_reparto
  ADD COLUMN tipo text NOT NULL DEFAULT 'incluida'
    CHECK (tipo IN ('incluida','excluida')),
  ADD COLUMN prioridad           integer NOT NULL DEFAULT 0,
  ADD COLUMN color               text,
  ADD COLUMN notas               text,
  -- Tarifa dinámica: NULL = usar el envio_costo global. Apagado por construcción.
  ADD COLUMN costo_envio         integer,
  -- Tiempo de viaje de la zona (mediana histórica). NULL = usar el global.
  ADD COLUMN tiempo_viaje_min    integer;
```

### `lib/cobertura.js` — evaluación multi-zona
1. Si el punto cae en **cualquier zona `excluida`** → fuera. **Las exclusiones ganan siempre**,
   sin importar prioridad. Esto resuelve la zona peligrosa pegada a una buena.
2. Si no, si cae en alguna `incluida` → dentro, con su nombre, `costo_envio` y `tiempo_viaje_min`.
3. **Si no hay ninguna zona definida → mantener el fallback al bounding box.** Sin esto, aplicar la
   migración bloquearía todos los pedidos de golpe.
4. Si hay incluidas definidas y el punto no cae en ninguna → fuera.

`GET /cobertura?lat&lng` pasa a devolver `{ dentro, zona, costo_envio, tiempo_viaje_min }`.
`GET /cobertura/zona` debe devolver **todas** las zonas, manteniendo la forma vieja en paralelo
(`{ zona: <primera incluida>, zonas: [...] }`) para no romper apps viejas.

### Admin — vista `Zonas.jsx`
- Leaflet + react-leaflet + leaflet-draw, tiles de OpenStreetMap (sin API key ni facturación).
- Dibujar/editar/borrar polígonos; marcar incluida (verde) / excluida (rojo); nombre, notas,
  **costo de envío** y **tiempo de viaje** por zona.
- `GET/POST/PUT/DELETE /zonas` (admin), validando ≥3 puntos y rango Colombia.
- Botón **"probar punto"**: pegar lat/lng y ver el veredicto antes de activar.

### Cobro correcto (no negociable)
Hoy `cart.tsx` calcula el envío en el cliente desde la config global. Con tarifa por zona **el
carrito debe preguntarle al servidor**, o muestra $5.000 y se cobra $8.000. `POST /pedidos` calcula
el envío server-side desde la zona del punto — el servidor es la autoridad, igual que con el cupón.

### Telemetría total (regla principal del proyecto — ver CLAUDE.md)

Va en el bloque A porque es lo primero que se construye y porque **los cinco bloques siguientes
dependen de tener el dato desde el día uno**. Sin esto, el viernes se decide sobre F a ciegas.

**A.1 — Versión de app en todos los eventos.** Agregar `app_version` (de `Updates.runtimeVersion`,
que sale del binario y no se puede falsear por OTA) al payload de cada evento. Responde la pregunta
que hoy no se puede responder: *¿cuánta gente hay en cada versión?* Prerrequisito para decidir
cuándo prender `exigir_ubicacion` y `version_minima`.

**A.2 — Cerrar los huecos del embudo.** Eventos que faltan, priorizados por decisión que habilitan:

| Evento nuevo | Pregunta que responde |
|---|---|
| `pantalla_vista` (genérico, con nombre de ruta) | ¿Qué pantallas se usan y cuáles no? |
| `checkout_iniciado` / `checkout_abandonado` (con paso) | ¿Dónde exactamente se cae el pedido? |
| `ubicacion_permiso_pedido` / `_concedido` / `_negado` | **Crítico para F**: cuánta gente niega GPS |
| `ubicacion_pin_movido` / `_confirmado` | ¿Usan el mapa o se rinden? |
| `fuera_de_zona` (con lat/lng aproximada) | **Dónde abrir cobertura** — growth hacking directo |
| `direccion_creada` / `direccion_seleccionada` | Fricción del paso de dirección |
| `login_iniciado` / `login_fallido` | ¿Se pierde gente en el login del checkout? |
| `producto_agotado_visto` | Demanda insatisfecha por producto |
| `eta_mostrado` (con rango) | Base para el reporte de cumplimiento del bloque D |
| `resena_enviada` (con estrellas) | Satisfacción medible |

Cada uno exige registrar tipo + `ALLOWED_KEYS` (default-deny, TypeScript lo fuerza).

**A.3 — Guardarraíles.** Cero PII: en `fuera_de_zona` la coordenada va **redondeada a 3 decimales**
(~100 m) — suficiente para mapear demanda, insuficiente para identificar una casa. Medir intención,
no gestos continuos: nada de scroll ni arrastre del mapa (solo el pin confirmado), o la cola se
llena y se gasta batería y datos de gente con planes limitados.

**A.4 — Panel.** Extender `/analitica` con distribución por versión y embudo de checkout.

---

# B — Herramienta de domiciliarios

### Esquema
```sql
ALTER TABLE pedidos
  ADD COLUMN domiciliario_id  integer REFERENCES usuarios(id),
  ADD COLUMN foto_entrega_url text,
  ADD COLUMN entrega_lat      numeric(9,6),
  ADD COLUMN entrega_lng      numeric(9,6),
  ADD COLUMN despachado_por   integer REFERENCES usuarios(id);
```
Rol nuevo en el CHECK de `usuarios.rol`: `admin | cajero | domiciliario`.

### Backend
- `GET /domiciliario/pedidos` — `en_preparacion`/`en_camino`, con dirección, `lat/lng`, teléfono y
  notas. Ve los suyos + los sin asignar.
- `PUT /domiciliario/pedidos/:id/despachar` → `en_camino`, sella `domiciliario_id`.
- `POST /domiciliario/pedidos/:id/entregar` → `multipart/form-data` con la foto; pasa a `entregado`,
  dispara push de entrega **y** de reseña.
- **No duplicar la máquina de estados de `pedidos-staff.js`**: extraer a un helper compartido. El
  descuento de `stock_manual` está cuidadosamente hecho para ocurrir exactamente una vez.
- Fotos en `/opt/polo/src/uploads/entregas/` con **nombre UUID no adivinable** (son las casas de los
  clientes: nunca `pedido-123.jpg`). Máx 5 MB, jpeg/png/webp, recompresión a ~1280 px.

### Admin — `/domiciliario`
- **Móvil primero**: tarjetas grandes, botones de pulgar, alto contraste (se usa en la calle, con
  sol, a una mano). Objetivos táctiles ≥44 pt desde el día uno.
- Por pedido: nombre, dirección + referencia, total a cobrar, y tres botones:
  **Ir** (`https://www.google.com/maps/dir/?api=1&destination=<lat>,<lng>`),
  **Llamar** (`tel:`), y **Despachar** / **Entregar** (abre la cámara con
  `<input type="file" capture="environment">` — sin módulo nativo).
- Login con rol `domiciliario` → redirige a `/domiciliario` y **bloquea el resto de rutas**
  (guard por rol en `App.jsx`, hoy inexistente).

### App del cliente
- Foto de entrega en el detalle del pedido ("Así se entregó tu pedido"), visible solo al dueño.

**Este bloque es el que produce sellos de tiempo limpios — de él depende calibrar D.**

---

# C — Reseñas

```sql
CREATE TABLE resenas (
  id         serial PRIMARY KEY,
  pedido_id  integer NOT NULL UNIQUE REFERENCES pedidos(id),
  cliente_id integer NOT NULL REFERENCES clientes(id),
  estrellas  smallint NOT NULL CHECK (estrellas BETWEEN 1 AND 5),
  comentario text,
  created_at timestamptz NOT NULL DEFAULT now()
);
```
`UNIQUE(pedido_id)` = idempotente por construcción.

- `POST /pedidos/:id/resena` (auth cliente): valida que sea **suyo** y esté `entregado`; 409 si ya existe.
- `GET /pedidos/:id/resena`; admin `GET /resenas` con promedio y filtro por estrellas.
- Push tipo `solicitud_resena` al pasar a `entregado`. **Registrarlo como transaccional** en
  `notificaciones.js` para que no caiga en el cap de marketing (2/semana).
- App: componente de 5 estrellas + comentario; tarjeta en `orders/[id]`, banner descartable en
  Inicio, deep link `/(tabs)/orders/[id]?calificar=1`.
- Admin: vista `Resenas.jsx`.

---

# D — Motor de tiempo estimado (ETA)

### Fórmula
```
prep  = eta_prep_base + (pedidos_en_cola / domiciliarios_en_turno) × eta_min_por_pedido
viaje = zona.tiempo_viaje_min           (mediana histórica de la zona)
ETA   = (prep + viaje) × factor_hora
mostrado = [ETA + holgura, ETA + holgura + ancho]      → redondeado a 5 min
```

### Parámetros (en `configuracion`, editables sin deploy)
| Clave | Arranque |
|---|---|
| `eta_prep_base_min` | 20 |
| `eta_min_por_pedido_cola` | 8 |
| `eta_holgura_min` | 10 |
| `eta_rango_ancho_min` | 20 |
| `eta_factor_hora` | `{"12":1.2,"15":1.2,"16":1.3,"17":1.4,"18":1.3}` |
| `eta_visible_cliente` | `true` (bandera de apagado) |

### Entradas vivas
- `pedidos_en_cola` = `COUNT(*) WHERE estado IN ('recibido','en_preparacion')`
- `domiciliarios_en_turno` = **selector en el admin** (`[1][2][3][4]`) que fija el turno.
  Rudimentario pero exacto; deducirlo automáticamente sería adivinar. Cuando B tenga a los
  domiciliarios logueados, se puede derivar.

### Override manual
`pedidos.eta_override_min` / `eta_override_max` — quien alista ve el calculado y puede pisarlo.
Gana siempre sobre la fórmula.

### El bucle que hace que aprenda
```sql
ALTER TABLE pedidos
  ADD COLUMN eta_prometido_min integer,
  ADD COLUMN eta_prometido_max integer;
```
Se **congela al crear el pedido**. Después se compara contra `entregado_at` real y sale un reporte
de cumplimiento en el admin ("acertamos el 78%"). **Sin esto el sistema nunca mejora**: estarías
ajustando coeficientes a ciegas para siempre.

### Las cuatro reglas de presentación
1. **Rango, nunca número exacto** — "50–70 min", no "58 min".
2. **Sesgo hacia tarde** — llegar antes deleita, llegar tarde enfurece; el costo es asimétrico.
3. **El ETA nunca se mueve hacia adelante después de confirmar.** Solo puede adelantarse.
4. **Redondear a 5 min** — "37 min" finge una precisión que no existe.

### Calibración
Arrancar **ancho y conservador** (la mediana de hoy suma ~90 min; empezar mostrando algo como
60–90) y apretar con el reporte de cumplimiento cuando B dé sellos limpios. Estrechar después se
siente como mejora; ensanchar después se siente como que empeoraste.

---

# E — Accesibilidad Nivel 1

Va **antes** de F: si vamos a obligar a todos a usar el mapa, el mapa tiene que ser usable por todos.

- Todo objetivo táctil a **≥44 pt** (iOS) / 48 dp (Android). Donde el diseño no dé, `hitSlop`
  (agranda el área sin cambiar el visual). Hoy hay botones de 16, 20, 26, 30, 32, 36, 38 y 40 px —
  los `+`/`−` del carrito entre los más pequeños, y son los que más se usan.
- **Piso de fuente en 12 px** (hoy hay 9 usos de 8 px, 14 de 9 px, 36 de 10 px, 34 de 11 px);
  textos informativos importantes a 14+.
- Quitar `adjustsFontSizeToFit` de `search.tsx:76`.
- `accessibilityLabel` en los 83 tocables que no lo tienen (prioridad: carrito, checkout, mapa).
- `accessibilityRole="button"` en todo `Pressable`; `accessibilityState={{disabled}}` en los que se
  apagan (hoy solo 4 lo declaran → el lector anuncia como activos botones que no lo están).
- `accessibilityLiveRegion="polite"` en el mensaje de fuera de zona, y subirlo a 14 px.
- Lenguaje llano: "Fuera de zona de reparto" → **"Por ahora no llegamos hasta aquí"**.
- No tocar el escalado de fuente del sistema (hoy está bien: no hay `allowFontScaling={false}`).

---

# F — Ubicación obligatoria

El único bloque con riesgo de venta. Lo que lo hace seguro es la bandera y las salidas de emergencia.

- **Permission priming**: hoja propia antes del diálogo del sistema — *"Usamos tu ubicación solo
  para llevarte el pedido al punto exacto"* con **Usar mi ubicación** / **Lo pongo a mano**. El
  diálogo nativo solo se puede pedir **una vez**; quemarlo obliga a mandar al usuario a Ajustes.
- **Arreglar el `return` silencioso** de `ubicacion.tsx:120`. Si el permiso está negado, mostrar el
  mapa centrado en Florencia con *"Mueve el mapa hasta tu casa"*.
- **El pin manual funciona sin ningún permiso** — es la salida de emergencia.
  **Regla: ningún camino puede terminar sin manera de completar el pedido.**
- El texto libre se reetiqueta como **referencia** ("apto 301, portería azul"), no como alternativa
  al pin. Se elimina el *"usa tu ubicación **o** escribe la dirección"*.
- Dirección guardada sin `lat` → abrir el mapa al confirmar; al volver se guarda
  (**falta crear el `PUT` de direcciones — hoy no existe**).
- `POST /pedidos` rechaza sin `lat/lng` y rechaza zona excluida, **detrás de la bandera
  `exigir_ubicacion` (default `false`)**.
- Fuera de zona: lenguaje llano + **botón de WhatsApp** + **registrar el intento con coordenadas**.
  Cada bloqueo te dice dónde abrir cobertura — eso es growth hacking directo.

---

# G — Release 1.2.0 + bloqueo de versión

### Bloqueo de versión (force update)
`expo-updates`, `expo-constants` y `expo-linking` ya están instalados → **el candado viaja por OTA,
sin módulo nativo nuevo**.

- Backend: `version_minima` + `version_minima_mensaje` en `GET /configuracion-app`.
- App: compara `Updates.runtimeVersion` (sale del binario, **no se puede falsear por OTA**) contra
  el mínimo. Si está por debajo → pantalla completa sin cerrar, botón que abre la tienda según
  plataforma.
- **Secuencia obligatoria:**
  1. Publicar el candado **dormido** por OTA a los 5 runtimes (`version_minima = "1.0.0"`).
  2. Build 1.2.0 → enviar a ambas tiendas.
  3. **Esperar a que esté vivo en las DOS** (iOS tarda 1–3 días; Android va más rápido).
  4. Recién ahí subir `version_minima` a `1.2.0`.
  5. Opcional: unos días de aviso descartable antes del bloqueo duro.

### Riesgos del bloqueo
- Activarlo antes de que 1.2.0 esté vivo **deja a la gente encerrada sin app**.
- Quien tenga un teléfono demasiado viejo para 1.2.0 **pierde la app para siempre** — revisar el
  mínimo de iOS/Android del build antes de prender.
- Es un interruptor nuclear: si 1.2.0 sale con bug, todos quedan ahí. Mitigación: `version_minima`
  vive en el servidor y se puede bajar en segundos.

### Build
- Tras cerrar A–F: commitear todo, **taggear**, y construir **desde ese tag** — así el binario vivo
  es reproducible desde git (deuda que viene de la auditoría del 20-jul).
- `version: 1.2.0`, `buildNumber`/`versionCode` **65**.
- `eas build --platform all --profile production --auto-submit --non-interactive`.
- **GOTCHA:** `eas update` NO lee el `env` de `eas.json` (solo los builds) → exportar
  `EXPO_PUBLIC_API_URL` y `EXPO_PUBLIC_SENTRY_DSN` en el shell antes de publicar OTAs.

---

# Orden de ejecución

| Día | Bloque | Riesgo |
|---|---|---|
| 1 | **A** — zonas + editor + tarifa por zona + **telemetría (OTA el mismo día)** | Ninguno |
| 2–3 | **B** — domiciliarios | Bajo (aislado del funnel) |
| 3 | **C** — reseñas | Bajo |
| 4 | **D** — motor ETA | Bajo (rangos anchos) |
| 4 | **E** — accesibilidad Nivel 1 | Ninguno |
| 5 | **F** — ubicación obligatoria | **Alto** — con bandera, día flojo |
| 5 | **G** — OTA del candado dormido + build 1.2.0 | Bajo |
| +2–4 días | Activar `version_minima` cuando esté vivo en ambas tiendas | Medio |

**Racional del orden:** A primero porque D (viaje), F (bloqueo) y la tarifa dependen de las zonas.
B antes que la calibración de D porque es lo único que produce sellos de tiempo limpios. E antes
que F por la razón obvia. F de último, con la semana entera de margen y con interruptor de reversa.

# Verificación

- **A:** dibujar una excluida sobre un barrio y probar con `GET /cobertura?lat=&lng=` → `dentro:false`;
  un punto vecino sigue en `true`. Con `zonas_reparto` vacía, el bbox debe comportarse igual que hoy.
  Con `costo_envio` en NULL, el envío cobrado debe seguir siendo $5.000.
- **B:** despachar/entregar desde un teléfono real; foto en disco con nombre UUID y visible en la
  app del cliente; confirmar que `stock_manual` se descuenta **una sola vez**.
- **C:** calificar dos veces → 409; calificar pedido ajeno → 403.
- **D:** con `eta_visible_cliente=false` no debe aparecer nada en la app; verificar que
  `eta_prometido_*` se congela al crear el pedido.
- **E:** recorrer carrito y checkout con VoiceOver/TalkBack; ningún botón sin nombre.
- **F:** con `exigir_ubicacion=false`, regresión cero. Con `true`, negar el permiso y confirmar que
  **igual se puede completar el pedido** con el pin manual.
- Siempre: `npx vitest run` + `npx tsc --noEmit` antes de cada OTA.

# Riesgos transversales

- **F es el único con riesgo de venta.** La bandera no es opcional: es lo que permite apagarlo sin deploy.
- `GET /cobertura/zona` cambia de forma → mantener la vieja en paralelo.
- Fotos de entrega = dato personal (casas de clientes). UUID mínimo; si crece el volumen, moverlas
  detrás de autenticación.
- El ETA es una **promesa**: arrancar ancho. Estrechar después se siente como mejora; lo contrario no.
- **La telemetría del bloque A sale por OTA el lunes mismo**, antes que ninguna otra cosa: cada día
  que pase sin ella es un día de datos perdidos. Para el viernes, cuando toque decidir sobre F,
  habrá cinco días de números reales (cuánta gente niega el GPS, dónde caen los intentos fuera de
  zona, qué versión corre cada quien) en vez de intuición.
- **Play Store está OK** desde el 21-jul (la suspensión por tabaco se levantó antes del lanzamiento
  oficial). Las reglas de filtrado de tabaco siguen vigentes y aplican a cualquier endpoint nuevo
  que sirva productos.
