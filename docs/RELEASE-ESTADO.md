# Estado de release — Estanco Caquetá Express

> Actualizado: 24/08/2026. Configuración local no equivale a publicación.

| Campo | Valor |
|---|---|
| `expo.version` | `1.3.2` |
| iOS `buildNumber` configurado | `94` |
| Android `versionCode` configurado | `94` |
| Runtime | política `appVersion` → `1.3.2` |
| Último build EAS real | `1.3.0`/`84` (finished, 18/08/2026) — **ninguno existe para 1.3.1 ni 1.3.2**, verificado el 24/08/2026 con `eas build:list --limit 30` |
| Estado en App Store | **NO VERIFICADO** en este documento |
| Estado en Google Play | **NO VERIFICADO** en este documento |
| OTA runtime 1.3.1 | Publicados el 21/08, huérfanos: no hay binario 1.3.1 que los reciba |
| OTA runtime 1.3.2 | Publicados desde el 23/08 (varios, el más reciente horas antes de esta nota), **también huérfanos por el mismo motivo**: `eas update` no exige que exista un binario receptor |

Los números 91-94 provienen de commits de configuración y de OTA, y ninguno demuestra un artefacto compilado. Un `eas update --branch production` corre aunque el runtime de destino no tenga ningún build — publica igual, sin avisar que nadie lo va a recibir. Para cambiar esta tabla se exige evidencia de `eas build:list`, `eas update:list` y consola de cada tienda.

Guía transversal: `../..` repo documental, `OTA-BUILDS-ESTANCO.md`.
