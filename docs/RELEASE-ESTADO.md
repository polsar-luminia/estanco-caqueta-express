# Estado de release — Estanco Caquetá Express

> Actualizado: 02/09/2026. Configuración local no equivale a publicación. Cada fila dice con
> qué se verificó; lo que no se consultó en esta sesión queda como **NO VERIFICADO**, no se
> infiere.

## Configuración local (`app.json`, rama `release/1.3.4`)

| Campo | Valor |
|---|---|
| `expo.version` | `1.3.4` |
| iOS `buildNumber` configurado | `96` |
| Android `versionCode` configurado | `96` |
| Runtime | política `appVersion` → sigue a `expo.version` |

Commits de corte (`git log --oneline`): `a25aaf2` 1.3.2/94 · `c91ab0a` 1.3.3/95 (**solo
Android**, ver abajo) · `2d307bd` 1.3.4/96. No hay tags para ninguna de las tres (el último tag
es `v1.3.0-build81`); las referencias de esta tabla son rangos de commits, no de tags.

## Google Play — verificado con la API de androidpublisher (edit transitorio, sin commitear nada)

| Campo | Valor |
|---|---|
| Track `production` | release única, `versionCode 96`, `status: completed`, sin `userFraction` (= 100 % del rollout) |
| Otros tracks | beta `61`, alpha `4`, internal `77` — más viejos, sin tocar |
| `versionCodes` subidos alguna vez | `1, 2, 3, 4, 6, 53, 61, 65, 77, 78, 92, 94, 95, 96` |

**Matiz que hay que conservar**: la API de Play no devuelve el `versionName` (el "1.3.4") por
bundle — solo el `versionCode`. Que `96` equivalga a `1.3.4` sale de `app.json` en el commit
`2d307bd`, no de algo que Play afirme. Play prueba el número de build en producción al 100 %;
la etiqueta humana es un dato del repo, no de la tienda.

Rollout por país o por franja de dispositivo dentro de ese 100 % no se consultó: **NO
VERIFICADO**.

## App Store Connect — build subido vs. versión publicada (son cosas distintas, ver §2 de `OTA-BUILDS-ESTANCO.md`)

Builds (`GET /v1/builds`, procesamiento de Apple, no publicación). **Fechas convertidas a
America/Bogotá**, que es la zona del proyecto: la API responde en hora del Pacífico y el build
92 cruza la medianoche (Apple `2026-08-20T23:53-07:00` = 21/08 01:53 en Bogotá). Una fecha de
tienda sin zona declarada se corre un día sin que nada falle.

| Versión | Build | Estado | Subido |
|---|---|---|---|
| 1.3.4 | `96` | VALID | 02/09/2026 |
| 1.4.0 | `96` | VALID | 27/08/2026 |
| 1.3.2 | 94 | VALID | 24/08/2026 |
| 1.3.2 | 93 | VALID | 23/08/2026 |
| 1.3.1 | 92 | VALID | 21/08/2026 |
| 1.3.1 | 91 | VALID | 20/08/2026 |
| 1.3.1 | 90, 89, 88, 87 | VALID | 18–19/08/2026 |
| 1.3.0 | 86, 85, 83, 82, 81, 80 | VALID | 16–18/08/2026 |
| 1.2.4 | 79 | VALID | 09/08/2026 |

`1.3.4` y `1.4.0` comparten número de build (`96`) porque son ramas distintas subidas por
separado; Apple lo permite sin conflicto.

Publicación real (`GET /v1/apps/.../appStoreVersions`, `appStoreState`):

| Versión | Estado |
|---|---|
| **1.3.4** | **WAITING_FOR_REVIEW** (versión creada 02/09/2026) |
| 1.3.2 | READY_FOR_SALE |
| 1.3.1 | READY_FOR_SALE |
| 1.2.3 | READY_FOR_SALE |

**La última versión de iOS realmente publicada (en la tienda hoy) es la 1.3.2.** El build 1.3.4
está subido, procesado y enviado a revisión — no está publicado. No existe ningún
`appStoreVersion` 1.3.3: **iOS nunca recibió la 1.3.3**, fue una release solo de Android (build
95, commit `c91ab0a`). Cuándo termina la revisión de Apple para 1.3.4 y si vuelve con
observaciones: **NO VERIFICADO**, es un evento futuro.

### Corrección sobre la tabla anterior (congelada el 24/08/2026)

La versión previa de este documento afirmaba que **«ninguno [build] existe para 1.3.1 ni
1.3.2»**, basada en `eas build:list --limit 30`. Es falso, y vale explicar por qué se creyó:
los binarios 1.3.1 (builds 87–92) y 1.3.2 (builds 93–94) se compilaron **en local** con
`scripts/subir-testflight.sh` (script nuevo del commit `c53772f`), sin pasar por los
servidores de EAS — por eso `eas build:list` nunca los vio y el documento concluyó, mal, que
no existían. App Store Connect sí los tiene, con estado VALID.

## OTA (EAS Update) — dos rondas del arreglo de ingreso

**Ronda 1 — 31/08/2026** (código de recuperación canjeable, lectura del 429, muro del
carrito, validación de teléfono, contraseñas sin mayúscula):

| Runtime | `group` |
|---|---|
| 1.3.2 | `2d516861-b1e0-4432-9d2d-c4c4b7e4bfb5` |
| 1.3.1 | `cc39c679-c988-4119-9d0b-12e86c75d29d` |
| 1.2.3 | `963d5357-f79f-4ffb-a936-4308c66d027e` |

**Ronda 2 — 01/09/2026, 21:05–21:08 (Bogotá)** (el teclado ya no cambia la contraseña al crearla, el perfil ofrece
iniciar sesión, el campo de clave deja de parecer lleno):

| Runtime | `group` |
|---|---|
| 1.3.3 | `aa419081-b113-4cae-88d1-aa84bfca33a8` |
| 1.3.2 | `3d7004d1-4979-4857-8d11-ceac43875348` |
| 1.2.3 | `f0b20884-3236-4977-871b-8516d4e2c587` |

(La ronda 2 en runtime 1.2.3 es más corta: el arreglo del perfil no aplica en ese árbol.) Los
seis grupos son `platforms: android, ios`, autor `luminia.agencia`. Seis grupos verificados
con `eas update:list --branch production`, no un conteo de memoria.

**Ya no son "huérfanos".** La nota vieja decía que los OTA de runtime 1.3.1 y 1.3.2 no tenían
binario receptor. Falso por el mismo motivo del punto anterior (builds locales que ASC sí
registra): el runtime 1.3.2 tiene binario publicado (build 93/94, READY_FOR_SALE) y **69
dispositivos midiendo en él ahora mismo** (ver parque vivo abajo). El runtime 1.3.1 también
tiene binario publicado (87–92, READY_FOR_SALE), aunque su parque vivo medido es marginal (1
dispositivo en la ventana de 24 h). El runtime 1.3.3 (Android-only, build local, no builds en
ASC ni en Play más allá del 95 ya reemplazado por 96) sí es el caso distinto: no hay una
versión de tienda "1.3.3" publicada en ninguna plataforma — su receptor son los binarios
Android 1.3.3 ya instalados por actualización previa, no una ficha de tienda propia.

## Parque vivo — `eventos`, ventana de 24 h, agrupado por `app_version`

Crudo:

| `app_version` | dispositivos | eventos |
|---|---|---|
| 1.3.2 | 69 | 1557 |
| 1.3.4 | 17 | 558 |
| 1.3.3 | 16 | 688 |
| 1.2.3 | 3 | 10 |
| 1.3.1 | 1 | 2 |
| 1.0.0 | 1 | 1 |
| (nulo) | 1 | 6 |

**El crudo de 1.3.4 engaña.** De los 17 dispositivos, 15 son el emulador de pruebas: cero
`cliente_id` en toda su historia, una sola versión reportada nunca, y los 15 aparecidos por
primera vez hoy 02/09/2026 (cada `pm clear` del emulador genera un `device_id` nuevo y el dev
client reporta la versión de `app.json`). Descontándolos quedan **2 dispositivos** no
descartables: uno con cliente, solo historial en 1.3.4 y aparecido hoy (podría ser real o
podría ser otra instalación de prueba); y uno con cliente y **5 versiones distintas desde
29/07/2026**, que sí es un aparato real de uso continuo.

**Conclusión honesta: la adopción real de la 1.3.4 todavía no es medible** (≈2 dispositivos,
uno de ellos ambiguo). No reportar "17" ni "12" como adopción.

- **1.3.3 — 16 dispositivos**, 9 con historial multi-versión y 5 con `cliente_id`: adopción
  real, no ruido de prueba.
- **1.3.2 — 69 dispositivos**, 38 con historial multi-versión y 36 con cliente: sigue siendo
  el grueso del parque vivo.
- **1.2.3 — 3 dispositivos**, 2 con historial multi-versión, ninguno con cliente en esta
  ventana de 24 h — coherente con ser el runtime más viejo y en retirada.

La partición de este parque entre iOS y Android no se consultó en esta sesión: **NO
VERIFICADO**. La ventana es de 24 h; cifras de una ventana anterior del mismo día no son
comparables fila a fila con esta tabla.

## Qué falta para llamar "publicada" a la 1.3.4

Android ya está: `versionCode 96` en producción, 100 %, `completed`. iOS no: build subido y
válido, pero la versión sigue `WAITING_FOR_REVIEW` — falta que Apple la revise y la libere.
Hasta que eso pase, cualquier usuario de iOS que instale o actualice desde la tienda recibe
1.3.2, no 1.3.4.

---

Guía transversal: [OTA-BUILDS-ESTANCO.md](../../OTA-BUILDS-ESTANCO.md).
