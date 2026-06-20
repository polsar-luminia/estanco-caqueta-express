# Medición de Meta (Facebook Ads) — App Estanco Caquetá Express

Integración del **SDK de Meta** para medir y optimizar campañas de instalación/conversión
(App Promotion) desde el Administrador de anuncios de Meta.

> **Contexto:** la app vive en **este** repo (`estanco-caqueta-express`, Expo SDK 55). Un intento
> previo se hizo por error sobre una copia vieja (`polo-dashboard/packages/app`, SDK 54), lo que
> produjo builds regresadas. Esta integración es la correcta, sobre el código real.

## Qué se agregó

| Pieza | Detalle |
|-------|---------|
| Deps | `react-native-fbsdk-next` (SDK de Meta) + `expo-tracking-transparency` (ATT) + `@expo/config-plugins` (lo requiere el plugin de fbsdk; desde Expo 53+ no viene hoisteado) |
| Plugin `app.json` | `react-native-fbsdk-next` (App ID + Client Token, ATT string) → inyecta `NSUserTrackingUsageDescription`, `SKAdNetworkItems` y el permiso Android `AD_ID`. `expo-tracking-transparency` NO va en `plugins` (el módulo se autolinkea; el string ATT ya lo pone fbsdk) |
| Módulo | `src/lib/metaEvents.ts` — wrapper a prueba de fallos sobre `AppEventsLogger` + ATT. **Separado** del tracker interno (`src/lib/tracker.ts`, que va a nuestro backend `/eventos`) |

## Eventos mapeados (Meta junto al tracker interno)

| Evento Meta | Dónde | Junto a |
|---|---|---|
| `initMetaAnalytics()` (+ ATT iOS) | `app/_layout.tsx` (effect de montaje) | `tracker.track('app_abierta')` |
| CompleteRegistration | `app/(auth)/register.tsx` | `registro_completado` |
| AddedToCart | `src/stores/cart.ts` (`addItem` y `addItemWithQuantity`) | `carrito_agregado` |
| Purchase (`logPurchase`) | `app/(tabs)/cart.tsx` | `pedido_creado` |
| Advanced matching (`metaIdentify`/`metaClearUser`) | `src/stores/auth.ts` (login/register/logout) | — |

## Config / credenciales

- **Meta App ID**: `2300234794051494` · **Client Token**: en el plugin de `app.json`.
- **EAS projectId**: `669996b7-c230-4933-b487-ee4fadf0b90d` (owner `luminia.agencia`).
- **Service Account de Play** (`eas-submit@estanco-eas`): `./play-service-account.json` (gitignored).
  `eas.json` apunta ahí en Mac (antes era ruta Windows del equipo anterior).
- **Apple Team ID**: `QU23M598V3`.
- **Versiones** (para reemplazar la regresión): `version 1.0.1`, `ios.buildNumber 54`,
  `android.versionCode 54`. `appVersionSource: local`.

## Cómo compilar y publicar (reproducible)

```bash
cd estanco-caqueta-express
npm install --legacy-peer-deps                                       # instala todo (expo incluido)
npx expo install expo-tracking-transparency @expo/config-plugins     # versiones SDK 55
npm install react-native-fbsdk-next@latest --legacy-peer-deps
npx expo config --json > /tmp/c.log 2>&1; echo $?                    # debe dar 0 (config valida)
npx eas-cli build --platform all --profile production --auto-submit
```

- Android -> track **production** (Service Account). iOS -> App Store Connect (`ascAppId 6769148116`).

## Apple — declaracion de privacidad (ya configurada)

Como la app tiene `NSUserTrackingUsageDescription`, en App Store Connect -> **Privacidad de la app**
se marco **"ID del dispositivo" como usado para seguimiento** (finalidad: Publicidad de terceros).
Es requisito para enviar a revision.

## Notas

- **Backend compat**: el cambio en `GET /ofertas` (campo `oferta.imagen_url` raiz) es inofensivo:
  el app lee `oferta.producto.imagen_url`. El card de ofertas usa gradiente + emoji de categoria por
  diseno (no la foto). El arreglo real de imagen fue actualizar `imagen_url` del producto en la BD.
- **Deferred deep linking**: limitado con SDK de Meta solo (sin MMP). Universal Links directos
  (`applinks:estancocaqueta.com`) funcionan.
- `tracker.ts` (analitica interna) **no se toco**; Meta es un sistema aparte.
- **Gotcha clave**: el plugin de `react-native-fbsdk-next` falla con `Cannot find module
  '@expo/config-plugins'` si no se instala explicitamente ese paquete (Expo 53+). Solucion:
  `npx expo install @expo/config-plugins`.
