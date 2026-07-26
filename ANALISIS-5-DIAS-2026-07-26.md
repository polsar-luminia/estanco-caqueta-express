# Análisis operativo — Estanco Caquetá Express Mobile
## Primeros 5 días reales (21–25 jul 2026) · corte 26-jul 00:14 (Bogotá)

Fuente: PostgreSQL `polo_dashboard` (VPS), logs pm2 `polo-api`, código en `/opt/polo/src` y
`estanco-caqueta-express/`. Contexto de adquisición: capturas de App Store Connect / Play Console /
Meta Ads aportadas por el usuario.

**Ventana**: primer pedido post-lanzamiento = pedido #3, 21-jul 15:01. Los pedidos #1 y #2
(18-jul, cliente 53) son pruebas internas y quedan excluidos.

---

## 1. Volumen y crecimiento

| Día | Pedidos | Entregados | Cancelados | % cancel | Clientes | GMV entregado | Ticket prom | Mediana |
|---|---|---|---|---|---|---|---|---|
| 21-jul (mar) | 2 | 2 | 0 | 0 % | 2 | 89.996 | 44.998 | 44.998 |
| 22-jul (mié) | 10 | 6 | 4 | 40 % | 10 | 709.788 | 118.298 | 92.998 |
| 23-jul (jue) | 5 | 2 | 3 | 60 % | 5 | 691.996 | 345.998 | 345.998 |
| 24-jul (vie) | 22 | 20 | 2 | 9,1 % | 22 | 1.194.962 | 59.748 | 44.998 |
| 25-jul (sáb) | 23 | 21 | 2 | 8,7 % | 19 | 1.784.468 | 84.975 | 44.998 |
| **Total** | **62** | **51** | **11** | **17,7 %** | **53** | **4.471.210** | **87.671** | **44.998** |

- **GMV creado**: 6.398.674 · **GMV entregado**: 4.471.210 · **GMV perdido por cancelación**: 1.927.464 (**30,1 %**).
- Registros nuevos por día: 11 → 35 → 27 → 38 → **49**.
- Ingreso por domicilio: 165.000 (33 de 51 entregados pagaron los $5.000; **18 viajaron gratis**).

**Tendencia**: el crecimiento es **real pero pagado**, no orgánico. El salto 23→24-jul (5→22
pedidos) coincide exactamente con el arranque de las campañas Meta (398 instalaciones, $269.195,
$676/instalación). Los registros siguen subiendo (49 el día 5) pero **los pedidos se aplanaron**
(22 → 23): el día 5 entraron 49 registros y solo salieron 23 pedidos. El motor de adquisición
funciona; el de conversión empezó a saturarse.

**Unit economics de adquisición** (con márgenes de memoria: licor 8 %, domicilio $5.000):
- 398 instalaciones → 160 registros (40 %) → 53 compradores (**13,3 % de instalación a compra**).
- CAC por comprador ≈ **$5.079**.
- Contribución real observada: 4.471.210 × 8 % + 165.000 = **~522.700** en 5 días = **10.249/pedido**,
  no los ~15.900 de referencia — porque el 35 % de las entregas no cobró domicilio.
- Aun así el CAC se paga en el primer pedido. La campaña no es el problema.

---

## 2. Embudo de conversión

### Advertencia metodológica (importante)

Dos cosas rompen la lectura ingenua del embudo:

1. **El `device_id` anónimo solo empezó a registrarse el 25-jul** (202 eventos anónimos ese día,
   0 antes). Todo el tramo pre-registro de los días 21–24 es invisible.
2. **`registro_completado` NO es tope de embudo, es un paso de checkout.** Mediana
   registro → primer pedido = **3 minutos**; 39 de 53 compradores (74 %) piden en menos de 30 min.
   El catálogo es público y el carrito es local (`app/(tabs)/cart.tsx:377` redirige a login solo
   cuando ya hay ítems). El orden real es: *navega anónimo → agrega al carrito → se registra → pide*.

### Embudo de la cohorte registrada (160 registros, 21–25 jul)

| Paso | Usuarios | % del anterior | % acumulado |
|---|---|---|---|
| registro_completado | 160 | — | 100 % |
| categoria_abierta | 124 | **−22,5 %** | 77,5 % |
| producto_visto | 86 | **−30,6 %** | 53,8 % |
| carrito_agregado | 69 | −19,8 % | 43,1 % |
| pedido_creado | 53 | −23,2 % | **33,1 %** |

Conversión registro → comprador verificada contra la tabla `pedidos`: **53/160 = 33,1 %**.

### Embudo del 25-jul a nivel identidad (único día con anónimos)

| abrió | exploró categoría | vio producto | se registró | agregó carrito | pidió |
|---|---|---|---|---|---|
| 77 | 69 | 45 | 49 | 26 | 19 |

Abrió → pidió: **24,7 %**.

### Dónde está la fuga real

De los 29 dispositivos **anónimos** del 25-jul: 11 vieron un producto (37,9 %), 4 buscaron y
**solo 1 agregó al carrito (3,4 %)**. Contra 43 % de agregado al carrito en registrados. El
visitante que no se registra prácticamente no agrega nada. Como el registro ocurre 3 min antes del
pedido, esto no es "el registro convierte mejor": es que **quien no se decide en la sesión de
navegación anónima se pierde entero**, y hasta el 25-jul no teníamos forma de verlo.

### Nuevos vs. recurrentes

| | Pedidos | Clientes | Ticket prom | Cancelados |
|---|---|---|---|---|
| Primer pedido | 55 | 55 | 102.040 | 11 (**20 %**) |
| Recompra | 7 | 5 | 112.356 | 0 (**0 %**) |

El cliente que vuelve gasta **10 % más y no cancela nunca**. Todo el problema de calidad de
pedido está en el primer pedido.

---

## 3. Cancelaciones

**11 de 62 (17,7 %)**, pero con tendencia claramente a la baja: 0 % → 40 % → 60 % → 9,1 % → 8,7 %.

### No existe campo de motivo

`pedidos` no tiene columna de motivo ni log de causa. La única señal es el evento
`pedido_cancelado` (payload solo `{pedido_id}`). La causa hay que inferirla de `notas_cliente`.
**Esto es un hueco de instrumentación**: la métrica que más GMV cuesta (1,9 M en 5 días) es la
única sin telemetría de causa.

### Quién cancela

| Quién | N | GMV perdido | Minutos promedio |
|---|---|---|---|
| Cliente (evento en la app) | 8 | 1.357.492 | 19 min |
| Tienda / admin (sin evento) | 3 | 569.972 | 152 min |

### Correlación con el tamaño del pedido

| Rango | Pedidos | Cancelados | % |
|---|---|---|---|
| ≥ 200k | 9 | 3 | **33,3 %** |
| 100–200k | 8 | 3 | **37,5 %** |
| 50–100k | 6 | 0 | 0 % |
| < 50k | 39 | 5 | 12,8 % |

**El pedido grande es el que se cae.** 6 de los 11 cancelados son ≥100k y suman 1,68 M.

### Causas inferidas de `notas_cliente`

- **Pedidos B2B / mayoristas que la operación no atiende**: "Estadero la última y nos vamos"
  (235.998), "Estanco el nuevo parche" (479.976), "Estanco mesa de amigos / barrio raicero",
  "Recojo en su almacen" (pedido de recogida en tienda, cancelado a los 148 min). Son **negocios
  comprando por la app de retail**. 4 de 11 cancelaciones.
- **Fuera de zona**: 1 pedido (#7, 632.398, "Calle 2, **Morelia**" — otro municipio). El flag
  `fuera_zona=true` funcionó y el cliente canceló a los 0 minutos.
- **Arrepentimiento inmediato**: 6 cancelaciones a los 0–7 minutos de crear el pedido.

---

## 4. Catálogo y búsqueda

### Concentración extrema

**19 SKUs vendidos** en 5 días, de 347 visibles en la app.

| Producto | Unidades | Pedidos | Ingreso | % GMV |
|---|---|---|---|---|
| 8263 APP-OFERTA AMARILLO 375ML | 90 | **44 de 51 (86 %)** | 1.799.910 | **40,3 %** |
| 8267 APP 2×AMARILLO 750ML + GORRA | 7 | 7 | 700.000 | 15,7 % |
| 8264 APP AMARILLO 1500ML + HIELERA | 5 | 3 | 480.000 | 10,7 % |
| 2531 AGUARD. EXTRA LIGHT 375 VERDE | 13 | 3 | 353.600 | 7,9 % |
| 7090 AMARILLO 375ML MANZANARES | 10 | 3 | 262.000 | 5,9 % |

**Los 3 SKU "APP-*" de Amarillo = 66,6 % del GMV.** El negocio hoy es un solo producto en
oferta con un catálogo decorativo alrededor.

### Interés sin venta (vistas ≥4, cero unidades)

| Producto | Vistas | Usuarios | Precio | Vendido |
|---|---|---|---|---|
| W. JACK DANIELS HONEY 700ML | 14 | 10 | 135.600 | **0** |
| W. CHIVAS REGAL 12A + 200ML GTS | 8 | 7 | 146.400 | **0** |
| COCTEL WHISKY COPACABANA 700ML | 6 | 5 | 37.400 | 0 |
| APP-TEQ. JOSE CUERVO + MARGARITERA | 5 | 4 | 107.200 | 0 |
| W. SOMETHING 8A 750ML | 5 | 4 | 94.400 | 0 |

Los dos whiskies premium juntan **22 vistas de 17 usuarios distintos y cero conversión**. Hay
demanda de gama alta que no cierra — precio, confianza en un ticket de 135k desde una app nueva, o
falta de medio de pago. Todos tienen stock y `visible_app=true`.

### Búsquedas sin resultado — la señal está contaminada

38 términos distintos, 10 usuarios. Al reprocesarlos contra el `/buscar` en vivo aparecen **tres
categorías**:

**(a) Huecos reales de catálogo**
- **Popetas/crispetas**: `Pope`, `Popet`, `Popeta`, `Popetas`, `Popeyas` — 6 eventos. Confirmado, 0 resultados.
- **Energizantes por categoría**: `Energi` → 0, aunque *Monster 473 ml* existe y tiene 166 de stock.
  El buscador no consulta el nombre de la categoría ("Energizantes").
- **Papas / mecato**: un usuario tecleó **12 variantes progresivas** de "Paquete papas…" y no
  encontró nada. Las 6 referencias de papas del ERP tienen `visible_app=false`.
- **Cigarrillos** (`Cigarr`, `sigarr`, `sigarrillo`): 4 eventos. Demanda real, **no atendible** por
  política de Apple §1.4.3 y Google Play. No es un hueco a llenar.

**(b) Bug de búsqueda multi-palabra** — reproducido contra el endpoint en vivo:

```
Caja      -> 34 resultados
Caja a    -> 0        Caja r  -> 0
Caja ag   -> 0        Caja ro -> 0
Caja agu  -> 0
Paquete pap -> 0   Paquete papa -> 0   Paquete papas -> 2
```

Causa (`routes/catalogo.js:397-401`): la consulta hace `ILIKE '%<frase completa>%'` más
`word_similarity(<frase completa>, nombre) > 0.4`. **No tokeniza.** Como los nombres del ERP usan
"CJ*24U" y no "caja", cualquier consulta de dos palabras cae por debajo del umbral y devuelve cero.
El usuario que escribe "caja de agua" o "paquete papas" no encuentra nada aunque el producto exista.

**(c) Falsos positivos del evento** — `busqueda_sin_resultado` se registró para términos que el
backend **sí** resuelve: `Monster` → 1, `Bucha` → 6, `Amper` → 1, `Pope ` → 8. Al menos 4 de los
29 términos verificables (14 %) son falsos.

Mecanismo probable (`app/(tabs)/search.tsx:163-169`): el `useEffect` decide con `totalResultados`
pero **depende solo de `debouncedQuery`** (hay un `eslint-disable exhaustive-deps` explícito). Si
corre en un render donde `isLoading` ya es `false` pero `searchData` sigue `undefined`,
`totalResultados` vale 0 → registra `busqueda_sin_resultado`, y como `totalResultados` no está en
las dependencias, **nunca se corrige** con el evento `busqueda` real.

**Consecuencia**: hoy `busqueda_sin_resultado` no sirve para decidir surtido, que es exactamente
para lo que se creó.

---

## 5. Geografía

### El dato geográfico no se está capturando

| Campo | Cobertura |
|---|---|
| `pedidos.barrio_id` | **0 de 62** |
| `pedidos.barrio` (texto) | **0 de 62** |
| `direcciones_cliente.barrio_id` | **0 de 70** |
| `pedidos.lat/lng` | 33 de 62 (53 %) |
| `pedidos.fuera_zona` | 32 evaluados, 29 en NULL |

**`barrios_florencia` está completamente sin usar.** No hay ni un pedido por barrio, ni una
comuna, ni un mapa de calor posible. La única señal es texto libre en `direccion`
("Carrera 9 # 19A-59 barrio los Ángeles", "CS 4-51 B/ minutos").

Esto bloquea de raíz el **bloque A del PLAN-1.2.0** (zonas multi-polígono + tarifa por zona): no
hay línea base contra la cual validar un polígono.

**Adopción de GPS, sí mejora**: 0/2 (21-jul) → 4/10 (22-jul) → 2/5 (23-jul) → 11/22 (24-jul) →
**16/23 (70 %, 25-jul)**. Métodos: 26 `gps`, 5 `pin_mapa`, 29 sin ubicación.

**Fuera de zona**: 1 solo pedido detectado (#7, Morelia, 632.398, cancelado). Con 47 % de pedidos
sin GPS, el número real es desconocido.

### Tiempos de fulfillment — el dato está contaminado

Sobre 51 entregados: mediana 136 min, promedio 248 min, p90 **939 min**, máximo **1.030 min (17 h)**.

Pero los `entregado_at` vienen en **bloques con el mismo segundo**:

```
#32 #33 #35  -> entregado_at 2026-07-25 10:22:41 / :42 / :43
#37 #38 #39  -> entregado_at 2026-07-25 10:22:44 / :45 / :47
#27..#31     -> entregado_at 2026-07-24 23:05:37 .. 23:06:03
#53 #55 #56  -> entregado_at 2026-07-25 18:27:52 / :53 / :54
```

Eso no son entregas: es alguien marcando "entregado" en lote al cerrar turno (y en un caso, a la
mañana siguiente). **`entregado_at` mide el cierre administrativo, no la entrega.** 19 de 51
pedidos (37 %) superan las 3 h por este efecto.

Lo que sí es confiable:
- `created_at → preparado_at`: mediana **2–5 min**. Excelente, y estable los 5 días.
- `preparado_at → despachado_at`: 18–73 min, con degradación el 24-jul (73 min promedio, el día del
  pico de campaña) y recuperación el 25 (36 min).

---

## 6. Cupones y descuentos

Un solo cupón activo: **BIENVENIDO** (`envio_gratis`, valor 5.000, sin mínimo).

- 12 usos registrados en `cupones_usos`, 12 clientes distintos, **de 55 primeros pedidos = 21,8 % de uso**.
- 19 eventos `cupon_aplicado` de 17 clientes → **7 lo aplicaron y no cerraron el pedido**.
- Ticket promedio con cupón: **44.232** vs. 104.241 sin cupón.

### El cupón no está inflando el ticket — lo está deprimiendo

Los 12 pedidos con BIENVENIDO tienen subtotales de 39.998 (10 de 12), es decir el SKU 8263 solo.
El cupón está subsidiando el pedido mínimo, no ampliándolo. Con `min_pedido = 0`, regala los
$5.000 de domicilio sobre un pedido de 40k cuyo margen bruto de producto es ~3.200. **Cada
redención de BIENVENIDO sobre el ticket mínimo es contribución negativa.**

### Inconsistencia en `pedidos.descuento`

De los 12 pedidos con `cupon_codigo='BIENVENIDO'`, **solo 1 tiene `descuento = 5.000`; los otros 11
tienen `descuento = 0`** — aunque en los 12 `total = subtotal` (o sea, el domicilio efectivamente no
se cobró). El descuento se aplica bien al cobro pero **no se persiste** en el 92 % de los casos.
Cualquier reporte de "descuento otorgado" contra esa columna da 5.000 cuando lo real es 60.000.

### Envío gratis sin cupón

9 pedidos más viajaron gratis sin cupón, todos con subtotal ≥ 219.598 → existe un umbral de envío
gratis (~200k) no documentado. Entre esos 9 hay 3 cancelados (33 %).

**Total domicilios regalados: 18 de 51 = 90.000 COP = 17 % de la contribución del período.**

---

## 7. Retención (sobre el análisis de recompra del 25-jul)

### Recompra ajustada por exposición

Excluyendo los duplicados < 1 h (solo 2 casos: pedidos #55 y #56 del cliente 132, a 40 y 6 min del
anterior — venían de cancelar el #54):

| Días expuesto | Clientes | Recompraron | % |
|---|---|---|---|
| 4 | 4 | 0 | 0 % |
| 3 | 12 | 2 | 16,7 % |
| 2 | 3 | 1 | 33,3 % |
| 1 | 25 | 1 | 4,0 % |
| 0 | 11 | 1 | 9,1 % |

Con 5 días de vida la exposición es demasiado corta para concluir. El dato útil no es la recompra
sino **la intención de recompra**:

### Los que volvieron y no cerraron

De los **55 compradores**:
- **34 (61,8 %) reabrieron la app** después de su último pedido.
- **14 (25,5 %) volvieron a agregar algo al carrito.**
- **5 (9,1 %) recompraron.**

→ **9 clientes ya probados llegaron otra vez hasta el carrito y no cerraron.** Ese es el cuello de
la retención, y es un problema de cierre, no de tráfico.

### Carritos abandonados

- **43 de 77 clientes con carrito nunca hicieron un pedido (55,8 %).**
- **56 carritos vivos con 6.720.922 COP** (promedio 120.016) — **más que todo el GMV entregado del período**.
- Carritos grandes sin dueño: 609.776 (cliente 96), 502.598 (87), 494.300 (173), 480.598 (27),
  479.976 (174 y 117), 363.398 (95). Los siete suman 3,4 M.

### La recuperación de carrito no funciona

36 notificaciones enviadas (12 push + 30 WhatsApp) → **0 pedidos posteriores. Cero.**

Y el pipeline de push está a ciegas:

| notificaciones_log (histórico) | |
|---|---|
| Total | 293 |
| Con `expo_ticket_id` | 258 |
| Con `expo_receipt_id` | **0** |
| Con `entregada_at` | **0** |
| Con `leida_at` | **0** |

Las columnas existen desde la migración `023_notificaciones.sql` pero **nada en el código las
escribe** (grep sin resultados fuera del SQL de la migración). No se está consultando el endpoint de
receipts de Expo. **No sabemos si un solo push llegó alguna vez.**

Además, **solo 16 de 55 compradores (29 %) tienen push token**. El canal de retención cubre menos de
un tercio de la base.

---

## 8. Señales operativas

### Horarios (hora Bogotá)

| Franja | Pedidos | GMV | Observación |
|---|---|---|---|
| 08–11 | 16 | 2.047.152 | **GMV/pedido más alto: 127.947** — es la franja B2B |
| 12–15 | 18 | 1.616.372 | Volumen sostenido |
| 16–18 | 21 | **2.207.362** | **Pico de volumen (34 % de los pedidos)** |
| 19–23 | 7 | 327.788 | **Colapsa** |

Hora punta: **18:00 (9 pedidos)** y **17:00 (7)**. Mayor GMV en una sola hora: **16:00 (1.061.992)**.

**La noche no vende.** Para un estanco eso es contra-intuitivo: 19–23 h son 7 pedidos y 327.788 en
5 días (5 % del GMV). O la banda de tienda cerrada está apagando la app en el horario de mayor
consumo, o la demanda nocturna no sabe que la app existe.

Día de semana: viernes 22 y sábado 23 pedidos, pero solo hay un viernes y un sábado en la ventana y
coinciden con el arranque de campaña. **No concluyente todavía.**

### Logs pm2 (`polo-api`, 21–26 jul)

Salud general **buena**. Todos los `*-error*.log` del período contienen únicamente el aviso repetido
de Sentry (`express is not instrumented`), más:

- 1 error real: `GET /api/v1/analitica/resumen?desde=2026-02-31` → `date/time field value out of
  range` — el admin construye una fecha inválida (31 de febrero) al calcular un rango relativo.
- 2 `[db] Pool error: terminating connection due to administrator command` — consistentes con
  reinicios/mantenimiento, sin impacto en usuarios.
- **Sin timeouts, sin ECONNRESET, sin 5xx, sin queries lentas.** La API no fue el cuello de botella.
- 24 reinicios de `polo-api` en el período (deploys manuales).

### El sistema de broadcast se autobloqueó

```
[broadcast_oferta] oferta 13: 0/17 push enviados
[broadcast_oferta] oferta 14: 0/17 push enviados
... (11 ofertas seguidas, todas 0/17)
[broadcast_oferta] oferta 15: 11/18 push enviados
[broadcast_oferta] oferta 15: 6/27 push enviados
[broadcast_oferta] oferta 18: 2/27
[broadcast_oferta] oferta 19: 0/27
```

Se crearon **9 ofertas el 20-jul**. El cap de `lib/notificaciones.js:121-129` permite **2 push de
marketing por cliente por semana**; a partir de la tercera oferta todos los clientes quedan
capados y los broadcasts siguientes envían **cero** — en silencio, sin alerta. La ventana de
lanzamiento (los 5 días de mayor tráfico del año) se corrió con la munición de marketing gastada
el día anterior.

---

# Hallazgos accionables, priorizados por impacto

### 1. 6,7 M en carritos abandonados y el canal para recuperarlos está roto (impacto: alto, esfuerzo: medio)

Hay **más dinero parado en carritos (6.720.922) que facturado (4.471.210)**, el 55,8 % de quien
agrega nunca pide, y **36 intentos de recuperación produjeron 0 pedidos**. Debajo hay tres fallas
apiladas:

- **`expo_receipt_id` / `entregada_at` / `leida_at` están en 0 sobre 293 notificaciones**: nadie
  consulta los receipts de Expo, así que no sabemos si un push llegó. Es un ciclo de ~40 líneas.
- **Solo 29 % de los compradores tiene token.** Hay que pedir el permiso en un momento con
  contexto (confirmación de pedido), no en el arranque.
- **El cap de 2 marketing/semana se quemó con 9 ofertas creadas el 20-jul** y los broadcasts de la
  semana de lanzamiento salieron a cero, en silencio. Excluir `carrito_abandonado` del cap
  compartido y loguear con alerta cuando un broadcast entrega < 50 %.

Recuperar el 5 % de esos carritos = **336.000 COP**, ~65 % de la contribución total de los 5 días.

### 2. 30 % del GMV creado se cancela y no sabemos por qué (impacto: alto, esfuerzo: bajo)

**1.927.464 COP perdidos en 5 días** y `pedidos` no tiene columna de motivo. La tendencia mejora
(60 % → 8,7 %), pero el sesgo es inequívoco: **≥100k cancela 35 %, <50k cancela 12,8 %**, y 4 de las
11 cancelaciones son **negocios** ("Estadero la última", "Estanco el nuevo parche", "Estanco mesa de
amigos", "Recojo en su almacén") comprando por una app de retail.

Tres acciones, todas baratas:
- Añadir `motivo_cancelacion` (enum) + payload en el evento `pedido_cancelado`. Es la métrica más
  cara del negocio y la única sin telemetría de causa.
- Confirmación telefónica obligatoria para pedidos ≥100k antes de preparar (evita el 35 % de caída
  en el segmento que más GMV mueve).
- Definir qué hacer con el B2B: o se atiende con un flujo aparte, o se comunica el límite. Hoy se
  acepta el pedido y se cancela horas después.

### 3. El negocio es un solo SKU y el buscador impide descubrir el resto (impacto: alto, esfuerzo: bajo)

El SKU 8263 está en **86 % de los pedidos y es el 40 % del GMV**; los tres "APP-Amarillo" son el
**67 %**. Solo **19 SKUs de 347** vendieron algo. Y la búsqueda coopera en contra:

- **Multi-palabra roto** (`catalogo.js:397-401`): `Caja` → 34 resultados, `Caja agua` → 0.
  Sin tokenizar la consulta, cualquier búsqueda de dos palabras devuelve cero. Fix: partir `q` en
  tokens y hacer AND de `ILIKE`/`word_similarity` por token.
- **No busca por categoría**: `Energi` → 0 aunque *Monster* existe con 166 de stock.
- **Jack Daniel's Honey y Chivas 12: 22 vistas de 17 usuarios, 0 ventas.** Hay demanda premium
  bloqueada por algo que no es disponibilidad.
- **Huecos confirmados**: popetas (6 eventos), papas/mecato (12 eventos de un usuario; las 6 refs del
  ERP están en `visible_app=false`).

Es backend, sale sin build nuevo, y es la vía más directa para que el ticket deje de ser 44.998.

### 4. `busqueda_sin_resultado` no es confiable, y es la brújula de surtido (impacto: medio, esfuerzo: bajo)

Al menos **4 de 29 términos verificables (14 %) son falsos positivos**: `Monster` (1 resultado),
`Bucha` (6), `Amper` (1), `Pope ` (8) se registraron como "sin resultado". Mecanismo en
`app/(tabs)/search.tsx:163-169`: el efecto decide con `totalResultados` pero depende solo de
`debouncedQuery` (con `eslint-disable exhaustive-deps`); si corre antes de que llegue la data
registra el evento falso y nunca lo corrige.

En un proyecto cuya regla principal es "si algo se puede medir, se mide", **un evento con 14 % de
falsos que alimenta decisiones de surtido es peor que no tenerlo.** Fix: agregar `totalResultados`
a las dependencias y gatear con `isSuccess` en vez de `!isLoading`. Sale por OTA.

### 5. Geografía en cero y el PLAN-1.2.0 depende de ella (impacto: medio, esfuerzo: medio)

**`barrio_id` está en NULL en 62/62 pedidos y 70/70 direcciones.** `barrios_florencia` no se usa.
No hay ni un pedido asignado a un barrio ni a una comuna. El **bloque A del PLAN-1.2.0** (zonas
multi-polígono + tarifa por zona) arranca el lunes 27 **sin línea base**: no habrá con qué validar
que un polígono es correcto ni contra qué comparar la tarifa nueva.

Lo bueno: la adopción de GPS sube sola (0 % → **70 % el 25-jul**). Antes de tocar polígonos,
poblar `barrio_id` — por reverse-geocoding de los 33 pedidos con lat/lng y por matching de texto
sobre `direccion` en el resto — para tener 5 días de historia que sirvan de control.

Adyacente, del mismo bloque: **`entregado_at` no mide entregas**, mide cierres administrativos en
lote (grupos de 6 pedidos con el mismo segundo, uno a la mañana siguiente). Cualquier motor de ETA
(bloque D) entrenado sobre esa columna aprenderá el horario del cierre de caja, no el tiempo de
viaje.

---

## Anexo — hallazgos menores

- **`pedidos.descuento` no persiste**: 11 de 12 pedidos con BIENVENIDO tienen `descuento = 0`
  aunque el domicilio sí se condonó. Reportes de descuento subestiman 12×.
- **BIENVENIDO con `min_pedido = 0`** subsidia el ticket mínimo: 10 de sus 12 usos son pedidos de
  39.998 (solo el SKU 8263). Contribución negativa. Poner mínimo ≥ 60.000.
- **Umbral de envío gratis (~200k) no documentado** — 9 pedidos, 3 de ellos cancelados.
- **La noche no vende**: 19–23 h = 7 pedidos y 5 % del GMV en 5 días. Verificar si la banda de
  tienda cerrada está apagando la franja de mayor consumo.
- **Bug menor en el admin**: `/api/v1/analitica/resumen?desde=2026-02-31` → error de fecha inválida.
- **Sentry no está instrumentado** en `polo-api` (aviso en todos los logs). Sin APM real, la
  latencia solo se puede inferir.
