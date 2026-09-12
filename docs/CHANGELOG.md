# Changelog — Estanco Caquetá Express (mobile)

Todos los cambios notables del app móvil. Formato basado en [Keep a Changelog](https://keepachangelog.com/).

> **Cambio de esquema de versiones.** Hasta `v5.1` (mayo 2026) se numeraba `vN` siguiendo el
> `versionCode`. Desde el lanzamiento público se usa SemVer en `expo.version` (1.0.x, 1.1.x) con el
> `buildNumber`/`versionCode` como número aparte. Las entradas de abajo de `[1.0.2]` conservan la
> numeración vieja; **`v5` no es posterior a `1.1.5`.**

> **Este archivo estuvo congelado entre 2026-05-07 y 2026-07-26.** Las entradas de `1.0.2` a `1.1.5`
> se reconstruyeron desde el historial de git el 2026-07-26, así que resumen el cambio pero no
> tienen el nivel de detalle de las entradas escritas en su momento.

## [Sin publicar — OTA a 1.3.4, 1.3.3 y 1.3.2] — 2026-09-12

Se acabó el envío gratis por monto. Contexto completo y números en
`docs/estanco/fin-envio-gratis-por-monto.md` (workspace).

**Este OTA se corta TRES veces**, una por runtime vivo: 1.3.4 (660 dispositivos), 1.3.2 (400) y
1.3.3 (47) — el 92% del parque. Los tres salen del mismo árbol cambiando `expo.version` en
`app.json`, sin cherry-pick: verificar antes que `git diff <commit-1.3.2> HEAD -- package.json`
esté vacío. Los que no lo reciben (1.0.0, 1.2.2, 1.2.3, 1.3.1 — 32 dispositivos) quedan protegidos
por la lápida del servidor: **cobran bien**, solo muestran el copy feo de "Faltan $99.xxx.xxx".

### Removed
- **El envío gratis por monto**, en toda la app. Se fue `gratisPorMonto` de `resumenPedido.ts`, el
  caso `"monto"` de `copyEnvio.ts` ("Envío gratis por superar $X") y la barra de "Faltan $X para
  envío gratis" de `ResumenTotales.tsx`. El servidor ya no lo honra desde la migración 110, así que
  mantenerlo aquí sería prometer en pantalla algo que el cobro no cumple.
- **El gate que escondía el canje de puntos.** `BloqueExtras` recibía `mostrarPuntos`, que el
  carrito calculaba como `subtotal < envioGratisMinimo`: el switch se ocultaba cuando el pedido ya
  tenía envío gratis por monto. Sin ese camino, el canje es lo único que le queda al cliente y no
  hay razón para esconderlo.

### Changed
- **El canje de puntos cuesta 500, no 200** (migración 111). La app no quema el número —lo lee de
  `/configuracion-app` desde la 090—, pero los respaldos de `cart.tsx` y `profile.tsx` suben a 500
  para seguir al del servidor: si se separan, el teléfono habilita el switch con un saldo que el
  servidor no acepta, muestra envío $0 y le cobran $5.000.
- `envio_gratis_minimo` queda marcado `@deprecated` en `ConfigApp`. El servidor lo sigue mandando,
  pero como lápida para los binarios sin OTA. **No volver a leerlo.**

### Tests
- `resumenPedido.test.ts`: se fueron los dos casos del monto y entró **"un subtotal enorme NO regala
  el envío"** ($999.999.999 → envío $5.000), espejo de la prueba adversaria del servidor. Es la que
  revienta si alguien reintroduce `gratisPorMonto` en el próximo rediseño del checkout.
- La prueba "el envío gratis no cubre el frío" conseguía el envío gratis con subtotal 150000; ahora
  llega por cupón. La regla que prueba no cambió.

## [1.3.4 / build 96] — 2026-09-01

Rama `release/1.3.4`. Rango de commits `c91ab0a..2d307bd`.

### Fixed
- **El arreglo de la contraseña, completo esta vez** (`1e909ab`): la mañana del 31-ago se
  había publicado solo la mitad del arreglo. `autoCapitalize="none"` evita que el teclado
  capitalice mientras se escribe, pero no evita que Gboard, con el ojito abierto, mantenga la
  palabra EN COMPOSICIÓN (subrayada, con sugerencias) y la sustituya al confirmarla — que pasa
  con solo tocar el campo siguiente (`hola` → `Hola `). El arreglo son dos cosas juntas, y
  ninguna sirve sin la otra: `keyboardType="visible-password"` en Android cuando el campo es de
  contraseña y está visible, más una `key` que cambia al alternar el ojito para remontar el
  campo (Android fija el `inputType` al crear la vista; cambiar `secureTextEntry` sobre el mismo
  campo montado no lo reaplica). Verificado en emulador: antes `hola`→`Hola `, después
  `hola`→`hola`, sin subrayado ni sugerencias. Las tres OTA publicadas esa misma mañana y el
  binario 1.3.3 (`c91ab0a`) quedaron con el arreglo a medias — este commit no está en ninguno
  de los dos.
- **La otra puerta del mismo bucle: el ícono de perfil** (`042d909`): `profile.tsx` mandaba al
  invitado a `/register` con un `<Redirect>` ciego, la misma puerta que ya se había arreglado en
  el carrito (`34e5c4d`, ver 1.3.3) — y peor, porque quien toca el ícono de SU cuenta ya
  probablemente la tiene. Arreglar solo el carrito y dejar esta fue el error original: dos
  puertas al mismo sitio que nadie vio que eran el mismo caso. Unificado en un componente
  (`MuroInvitado`) para que no vuelva a pasar.
- **Placeholder de contraseña dejó de ser ocho puntos** (`042d909`): "••••••••" no distingue un
  campo vacío de uno lleno, ni confirma que un borrado surtió efecto. Ahora dice "Tu contraseña"
  / "Mínimo 8 caracteres". Los dos defectos de este commit los encontró
  `scripts/kimi-explorador.mjs` (nuevo en este commit): captura pantalla con `adb`, se la manda
  a un modelo con visión (kimi-k3) encarnando a una persona torpe, y ejecuta la acción que
  devuelve. No sustituye a Maestro —que afirma un recorrido conocido y falla cuando cambia—
  porque encuentra justo lo que un recorrido escrito no mira.
- Suite Maestro realineada con la app real (`cec1542`): llevaba semanas sin pasar del primer
  paso porque el invitado ya no cae en login desde `d2df8ac` (18-ago) sino en registro, y el
  guard buscaba el texto exacto `"Iniciar sesión"` contra un accessibilityLabel distinto
  (`"Iniciar sesión con una cuenta existente"`) — Maestro exige coincidencia completa, no
  subcadena. Nadie lo notó porque tampoco se podía levantar el backend de pruebas en paralelo.

### Release
- **Build 96, y no una segunda 1.3.3, verificado sobre el artefacto** (`2d307bd`): la 1.3.3/95
  ya estaba publicada en Play al 100 % pero se había compilado desde `c91ab0a`, ANTES de los
  tres arreglos del ingreso de la noche del 31-ago — confirmado descargando el `.aab` de Play y
  buscando las huellas dentro del bundle Hermes (`visible-password` y los textos nuevos
  ausentes; el placeholder viejo de ocho puntos presente). Play habría aceptado repetir el
  nombre "1.3.3" con otro `versionCode`, pero eso deja dos releases con el mismo nombre y
  contenido distinto. Quien ya está en 1.3.3 no se queda atrás: recibió los mismos tres arreglos
  por OTA sobre su runtime (ver más abajo).
- **Estado de publicación** (verificado 2026-09-02): Android — versionCode 96 en el track
  `production` de Play, `status: completed`, sin `userFraction` (100 %). iOS — build 96 `VALID`
  en App Store Connect, subido 2026-09-02, pero la versión 1.3.4 está `WAITING_FOR_REVIEW`: **no
  publicada**. La última versión iOS realmente publicada (`READY_FOR_SALE`) sigue siendo la
  1.3.2. Build ≠ submit ≠ revisión ≠ publicado — no inferir lo uno de lo otro.
- **OTA a los runtimes que no tienen este binario**, 2026-09-01 21:05–21:08 hora de Bogotá
  (`eas update:view` de cada grupo; la API los reporta en UTC como `2026-09-02T02:0x`, que es la
  noche del 1-sep en Colombia): mismo grupo de arreglos (contraseña, perfil, placeholder) empujado a 1.3.3
  (`aa419081-b113-4cae-88d1-aa84bfca33a8`), 1.3.2 (`3d7004d1-4979-4857-8d11-ceac43875348`) y
  1.2.3 (`f0b20884-3236-4977-871b-8516d4e2c587`). El grupo de 1.2.3 no menciona el arreglo del
  perfil: en ese runtime ese cambio no aplica.

### Tools
- `scripts/subir-play.mjs` y `scripts/subir-testflight.sh` (`c53772f`, posterior a este
  release): hablan directo con la Play Developer API y con `altool` de Xcode, sin pasar por los
  servidores de EAS — `eas submit` funciona, pero manda el artefacto a EAS para que ellos lo
  suban. El default de Play queda en borrador (publicar exige `--publicar`): el 31-ago una
  subida salió al 100 % de producción sin escalonar y no se pudo detener (Play solo permite
  `halted` sobre despliegues escalonados, no sobre uno ya completo — tres intentos, tres 500 de
  la API). Subir a TestFlight tampoco envía a revisión: eso sigue siendo manual, a propósito.

## [1.3.3 / build 95] — 2026-08-31

Rango de commits `a25aaf2..c91ab0a`; `c91ab0a` solo sube `buildNumber`/`versionCode` en
`app.json`, el contenido real es de los commits anteriores. **Solo Android**: no existe ningún
build 1.3.3 en App Store Connect — iOS pasó directo de la 1.3.2 a la 1.3.4 (ver arriba).

### Added
- **Tarjeta del código de entrega, dormida** (`ef87562`, mergeado en `307bf9e`): se muestra solo
  cuando el servidor manda `codigo_entrega` — bandera del backend prendida, versión ≥ 1.3.2 y
  pedido en `domiciliario_llego`. En cualquier otro caso (99,9 % de los pedidos reales hoy, con
  la bandera apagada) no renderiza nada: no hay forma de que este commit cambie algo que un
  cliente vea todavía. Dos eventos nuevos (`codigo_entrega_visto`, `codigo_entrega_ayuda`) en los
  tres registros de siempre; el código mismo nunca viaja en un evento.

### Fixed
- **Las seis fricciones del ingreso** (`34e5c4d`), contraparte en la app de lo ya publicado en
  el backend (`fix/ingreso-clientes`): campo de contraseña que ya no se capitaliza ni autocorrige
  con el ojito abierto (arreglo a medias — la otra mitad llegó hasta `1e909ab`, ver 1.3.4);
  `textContentType="newPassword"` en los campos que CREAN contraseña (registro, reset) para que
  el gestor de contraseñas del teléfono ofrezca guardarla — antes solo lo tenía el de login; el
  muro del carrito deja de ser un `<Redirect>` ciego a `/register` y pregunta primero (151
  dispositivos habían abierto registro en los 10 minutos tras fallar el login, 40 de ellos con
  "este número ya tiene una cuenta"); `Error 429` deja de ser lo que ve el usuario (la whitelist
  de `api.ts` tenía el copy viejo del backend y no hacía match, así que caía al mensaje
  genérico); `login.tsx` valida el formato del teléfono antes de enviar (era la única de las tres
  pantallas de auth que no lo hacía); y "¿Olvidaste tu contraseña?" pasa de enlace de 12px a
  botón de ancho completo tras 2 fallos (82 de 155 lo usaron y entraron). Instrumentado con
  `sesion_expirada` y `login_bloqueado` (origen `rate_limit`/`lockout`), ya soportados por el
  backend. De paso, `node_modules` salió del índice de git: estaba trackeado como symlink a sí
  mismo y rompía todo el toolchain al hacer checkout de esta rama.
  - Entregado también por OTA el 2026-08-31 a los runtimes 1.3.2
    (`2d516861-b1e0-4432-9d2d-c4c4b7e4bfb5`), 1.3.1 (`cc39c679-c988-4119-9d0b-12e86c75d29d`) y
    1.2.3 (`963d5357-f79f-4ffb-a936-4308c66d027e`), además de ir embebido en este binario.
- El aviso de formato de teléfono salía bajo el campo de CONTRASEÑA, con ese campo en rojo
  (`51f54a7`): reusaba `loginError`, el estado del error de credenciales. Ahora el teléfono tiene
  su propio estado de error.
- 5 `fontFamily` rotos + 3 pantallas de soporte sin fuentes (`2688fa7`): un
  `fontFamily: fuentes.destacado ? "700" : "500"` copiado en cinco sitios (el ternario debía ser
  de `fontWeight`) hacía que el texto cayera en silencio a la fuente del sistema — "700" no es
  un nombre de fuente válido. `app/support/` (ayuda, privacidad, términos) nunca había importado
  `fuentes`: eran las únicas pantallas del repo así.

## [1.3.2 / build 94] — 2026-08-23

Rango de commits `be42bcf..a25aaf2` (después del build 92 de la 1.3.1, ver abajo).

### Added
- **Rediseño denso del checkout** (`a25aaf2`): componentes propios en
  `src/components/checkout/` (HojaDireccion, HojaMedioPago, HojaNotas, BloquePuntoEntrega,
  BloqueExtras, ResumenTotales, FilaAccion/FilaPedidoColapsado/FilaSeleccionable,
  MiniMapaEntrega, SelectorMedioPago). El estado sigue viviendo en `cart.tsx`: son componentes
  controlados, sin store propio. Medio de pago (migración backend 093) y contacto de soporte
  configurable (`src/lib/soporte.ts`, `src/lib/copyEnvio.ts`) sacan del binario textos que antes
  estaban quemados — el bloqueo de WhatsApp del 22-ago costó un commit por lo mismo.
- **Telemetría del embudo con hora real del hecho** (`a25aaf2`): cada evento lleva `t` al
  encolar y el lote `t_envio` al enviar; el backend deriva `ocurrido_at` de ese delta, nunca del
  reloj absoluto del teléfono (migración 094). `carrito_abandonado` gana
  `envio/total/envio_gratis/tiene_pin/frio`. `checkoutIniciadoRef` pasa a resetearse por visita,
  no por montaje del tab (antes subcontaba el denominador del embudo contra los abandonos).
  Deduplicación de `carrito_abandonado` entre remounts del componente (22 de 153 filas de
  producción eran copias exactas en el mismo instante).
- Herramientas de release (`a25aaf2`): `docs/RELEASE-CHECKLIST.md`, `docs/RELEASE-ESTADO.md` y
  `scripts/validar-docs.mjs`, para no reclasificar una configuración local como build publicado
  sin evidencia de EAS/tienda. CI (`test.yml`) corre en todas las ramas y PRs, y valida esa
  documentación en cada corrida.

### Fixed
- WhatsApp de soporte redirigido al número de marketing (`ecf289c`): el número personal de
  soporte (318 949 5704) fue bloqueado por Meta el 22-ago-2026. Mientras se resuelve,
  `WHATSAPP_SOPORTE` apunta al Cloud API de marketing (+1 555-349-4324); de paso, los mensajes
  de soporte quedan registrados en `whatsapp_entrantes` y disparan el aviso a Telegram, cosa que
  el número personal nunca hizo.
- `TELEFONOS_PRUEBA` vaciado — el número del dueño lo mandaba a staging (`bc4edf8`): su propio
  número (3183224021) estaba en la lista de teléfonos de prueba, así que abrir la app de la
  tienda con su número lo mandaba entero a staging (catálogo, base y telemetría de pruebas); su
  cuenta de staging se borró tres veces creyendo que era basura de pruebas, y reaparecía cada vez
  que volvía a entrar. Vaciar la lista no bastaba: el modo es pegajoso (`AsyncStorage`) y solo se
  reevaluaba al iniciar sesión, así que quien ya lo tenía activo se quedaba en staging para
  siempre — se "arreglaba" cerrando sesión, que nadie adivina. `hidratarModoPruebas` ahora apaga
  y limpia el flag cuando la lista está vacía.
- Política de privacidad sin marca de borrador (`5eab60e`): visto bueno jurídico del texto tal
  cual estaba, sin cambios de contenido.

### Estado de publicación
- iOS: builds 93 y 94 `VALID` en App Store Connect (subidos 2026-08-23/24); la versión 1.3.2
  llegó a `READY_FOR_SALE` y, verificado 2026-09-02, sigue siendo **la última versión iOS
  publicada** (la 1.3.4 está en revisión, ver arriba; no hubo versión 1.3.3 en iOS).

## [1.3.1 / builds 87–92] — 2026-08-18 a 2026-08-21

**Esta entrada estuvo mal clasificada como `Unreleased`.** Decía que «al verificar EAS el
21/08/2026 no existía build 91 ni 92» y que «los OTA del runtime 1.3.1 no tenían receptor
binario verificado». Las dos afirmaciones están refutadas: App Store Connect tiene los seis
builds 1.3.1 (87, 88, 89, 90, 91 y 92, todos `VALID`), la versión 1.3.1 llegó a
`READY_FOR_SALE`, y el 2026-09-02 había 69 dispositivos con telemetría midiendo en runtime 1.3.2
y evidencia de parque real también en 1.3.1 — no huérfano.

**Por qué se creyó lo contrario**: los builds 91 y 92 (y los anteriores de esta franja) se
compilaron **en local**, no con `eas build`, así que `eas build:list` —la fuente que se
consultó el 21/08— nunca los conoció. Un build que existe en la tienda pero no en el historial
de EAS es indistinguible de uno que no existe si solo se mira EAS. La lección: verificar
publicación contra la tienda (App Store Connect / Play Console), no solo contra el CLI que
compiló el artefacto.

### Fixed / Added (resumen; ver `git log be42bcf..HEAD~N` para el detalle commit a commit)
- Build 92 (`be42bcf`, 2026-08-21) — primer build de Android desde 1.2.3/78: umbral de puntos
  real del servidor (antes dos números quemados que se contradecían) y sugerencias de dirección
  con pin+enviar a los lados.
- Build 91 (`d483d62`, 2026-08-20): muro de dirección + umbral de `exigir_ubicacion`. Apple
  rechazó reenviar el build 90 tal cual porque ya estaba subido desde el 19-ago con el mismo
  `CFBundleVersion`.
- Builds 87–90 (`bba4706`, `21383ee`, `5a7acf3`, 2026-08-18/19): cuadrícula de categorías,
  barra de vidrio esmerilado, banda de demora con tienda abierta y banners sin texto quemado.

No reclasificar builds futuros como publicados sin comprobar la tienda directamente; ver
`docs/RELEASE-ESTADO.md` y `OTA-BUILDS-ESTANCO.md` §2–3.

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
