# Investigación — Captura de ubicación y accesibilidad

> 2026-07-25. Insumo para bajarle el riesgo al bloque **F1b** (volver obligatoria la ubicación)
> y para el objetivo de accesibilidad total.

## Resumen ejecutivo

1. **Tu pantalla de mapa ya implementa el patrón estándar de la industria.** No hay que rediseñarla.
2. **No instales ninguna librería de mapas.** La más citada está archivada y, peor, cualquier módulo
   nativo obliga a build nuevo → adiós al despliegue por OTA.
3. **El riesgo real de F1b no está en el mapa: está en los permisos.** Hoy hay un callejón sin
   salida silencioso que puede costar ventas.
4. **La accesibilidad es el hueco grande**: 25% de cobertura de etiquetas, botones por debajo del
   mínimo táctil y fuentes de 8–11 px.

---

## 1. El patrón universal (Rappi, DoorDash, Uber Eats, iFood)

Los cuatro convergieron en el mismo flujo:

| Paso | Patrón | ¿Tu app lo tiene? |
|---|---|---|
| Pin **fijo al centro**, el usuario mueve el mapa (no arrastra el pin) | Estándar | ✅ `ubicacion.tsx:190-195` |
| Reverse geocoding con *debounce* al soltar | Estándar | ✅ 600 ms, `:113` |
| *Bottom sheet* con dirección aproximada + botón confirmar | Estándar | ✅ `:208-237` |
| Botón "mi ubicación" flotante | Estándar | ✅ `:198-205` (44×44, correcto) |
| Campo de **referencia** separado de la ubicación | Estándar | ⚠️ existe pero compite con el pin |
| Mapa satelital para reconocer el techo de la casa | DoorDash / Rappi | ❌ |

**Por qué el pin fijo y no arrastrable:** mover el mapa bajo un pin quieto se hace con el pulgar sin
tapar el objetivo con el dedo. Arrastrar un pin exige precisión fina — justo lo que pierden los
usuarios mayores. Ya lo tienes bien.

**Lo único que vale la pena copiar:** en Rappi y DoorDash el texto libre nunca compite con el pin;
es explícitamente **"instrucciones de entrega"** (portería, apartamento, color de la casa). Hoy tu
checkout los trata como alternativas ("usa tu ubicación **o** escribe la dirección"). Ese *o* es
exactamente lo que hay que eliminar en F1b: el pin manda, el texto complementa.

## 2. Librerías: la conclusión es no instalar ninguna

| Librería | Veredicto |
|---|---|
| `react-native-place-picker` | ❌ **Archivada el 10-abr-2026**. Además exige código nativo y no soporta Expo managed. |
| `react-native-google-places-autocomplete` | ❌ Requiere API key de Places facturable + build. |
| `expo-location-picker` | ⚠️ Sucesora sugerida, pero sigue siendo módulo nativo. |

**El argumento decisivo es de despliegue, no de calidad.** Cualquier módulo nativo obliga a un build
nuevo y a pasar por revisión de tiendas — lo que rompe el plan de mandar F1b por OTA con bandera de
reversa. Ya tienes `react-native-maps` compilado en el binario: todo lo que construyamos encima
viaja como JavaScript y se puede apagar en segundos.

**Recomendación: cero dependencias nuevas.** La mejora de F1b es JS puro sobre lo que ya existe.

## 3. El riesgo real de F1b: los permisos

Este es el hallazgo más importante para tu pregunta. En `ubicacion.tsx:118-125`:

```js
const recentrar = async () => {
  const perm = await Location.requestForegroundPermissionsAsync();
  if (!perm.granted) return;   // ← se muere en silencio
  ...
```

Si el usuario niega el permiso (o ya lo negó antes, en cuyo caso el sistema **ni siquiera muestra el
diálogo**), toca el botón y **no pasa absolutamente nada**. Es el mismo patrón de "tap muerto" que
acabamos de arreglar en el carrito. Hoy es tolerable porque la ubicación es opcional; **con F1b
obligatoria, ese silencio es una venta perdida.**

### Permission priming — la técnica documentada

El consenso de la industria: **nunca dispares el diálogo del sistema en frío**. Primero una pantalla
propia que explica el beneficio; solo si el usuario acepta, se lanza el diálogo nativo. Quien diga
que no en tu pantalla no quema el permiso del sistema y puede reintentar después. El diálogo nativo
solo se puede pedir **una vez**; quemado, hay que mandar al usuario a Ajustes.

Aplicado a nosotros:

1. **Antes** de pedir GPS: hoja explicativa — *"Usamos tu ubicación solo para llevarte el pedido al
   punto exacto. Puedes también ponerlo a mano en el mapa."* Con dos botones: **Usar mi ubicación** /
   **Lo pongo a mano**.
2. **Si niega o ya está negado**: no morir en silencio. Mostrar el mapa centrado en Florencia y decir
   *"Mueve el mapa hasta tu casa"*. **El pin manual siempre funciona sin ningún permiso** — esta es
   la salida de emergencia que hace que F1b no pueda bloquear una venta.
3. **Si el GPS falla o tarda**: mismo camino, nunca un spinner infinito.

**Regla de oro para F1b: ningún camino puede terminar sin manera de completar el pedido.**

### Fuera de zona: explicar, no solo bloquear

Hoy el mensaje es correcto pero seco: *"Fuera de la zona de reparto de Florencia"*, en rojo, 12 px, y
el botón se apaga. Para alguien que no entiende qué pasó, es un muro.

Propuesta: mensaje en lenguaje llano (*"Por ahora no llegamos hasta aquí"*), **más un botón de
WhatsApp** para preguntar. Una zona bloqueada no debería ser una venta perdida silenciosa: es un dato
de expansión. Vale la pena registrar cada intento fuera de zona con su lat/lng — eso te dice
**exactamente dónde abrir cobertura**, que es parte del growth hacking que buscas.

## 4. Auditoría de accesibilidad de la app

Medido sobre `app/` y `src/`:

| Métrica | Estado |
|---|---|
| Elementos tocables | 110 |
| Con `accessibilityLabel` | **27 (25%)** |
| Con `accessibilityRole` | 24 (22%) |
| Con `accessibilityHint` | **0** |
| Con `accessibilityState` | 4 |
| Escalado de fuente del sistema | ✅ activo (sin `allowFontScaling={false}`) |
| Anti-patrones | 1 (`adjustsFontSizeToFit` en `search.tsx:76`) |

**Objetivos táctiles por debajo del mínimo** (44×44 pt en iOS, 48×48 dp en Android): hay botones de
16, 20, 26, 30, 32, 36, 38 y 40 px. Los `+`/`−` del carrito son de los más pequeños — y son los que
más se usan.

**Tamaños de fuente**: 9 usos de 8 px, 14 de 9 px, 36 de 10 px, 34 de 11 px. Para un usuario mayor,
8 px es ilegible. WCAG 2.2 AAA pide 44×44; el mínimo AA es 24×24.

### Plan de accesibilidad (por impacto)

**Nivel 1 — lo que de verdad mueve la aguja (medio día)**
- Subir todo objetivo táctil a **≥44 pt**. Donde el diseño no lo permita, usar `hitSlop` (agranda el
  área sin cambiar el visual) — ya se usa en `ubicacion.tsx:152`, hay que generalizarlo.
- Piso de fuente en **12 px**; los textos informativos importantes a 14+.
- Quitar `adjustsFontSizeToFit` de `search.tsx`.
- Subir el mensaje de fuera de zona a 14 px y darle `accessibilityLiveRegion="polite"` para que el
  lector de pantalla lo anuncie al aparecer.

**Nivel 2 — lectores de pantalla (un día)**
- `accessibilityLabel` en los 83 tocables que no lo tienen. Prioridad: carrito, checkout, mapa.
- `accessibilityRole="button"` en todo `Pressable`.
- `accessibilityState={{ disabled }}` en los botones que se apagan — hoy solo 4 lo declaran, así que
  un lector de pantalla anuncia como activos botones que no lo están.
- `accessibilityHint` donde la acción no sea obvia ("Confirmar este punto" → *"Guarda esta ubicación
  para tu entrega"*).

**Nivel 3 — comprensión (transversal)**
- Lenguaje llano, sin jerga: "Fuera de zona de reparto" → **"Por ahora no llegamos hasta aquí"**.
- Todo error dice **qué pasó y qué hacer**, nunca solo qué falló.
- Nunca comunicar solo con color: el rojo de fuera-de-zona debe traer ícono y texto (ya los trae).

## 5. Cómo queda F1b con todo esto

1. Hoja de *priming* antes de cualquier permiso.
2. Pin manual siempre disponible, sin permisos — la salida de emergencia.
3. Ningún callejón sin salida: GPS negado, fallado o lento siempre caen al mapa manual.
4. El texto libre se reetiqueta como **referencia**, no como alternativa al pin.
5. Fuera de zona: lenguaje llano + WhatsApp + registro del intento con coordenadas.
6. Bandera `exigir_ubicacion` en `configuracion` para apagarlo en segundos.
7. Accesibilidad Nivel 1 **antes** de activar F1b: si vamos a obligar a todos a usar el mapa, el
   mapa tiene que ser usable por todos.

**Ese último punto es la conclusión principal de la investigación**: la mejor forma de bajarle el
riesgo a F1b no es cambiar el mapa, es cerrar los callejones sin salida y agrandar lo que hay que
tocar.

---

## Fuentes

- [Onboarding UX Patterns — Permission Priming (UserOnboard)](https://www.useronboard.com/onboarding-ux-patterns/permission-priming/)
- [Asking nicely: 3 strategies for successful mobile permission priming (Appcues)](https://www.appcues.com/blog/mobile-permission-priming)
- [Request location access at runtime (Android Developers)](https://developer.android.com/develop/sensors-and-location/location/permissions/runtime)
- [Mobile Permission Requests: Timing, Strategy & Compliance (Dogtown Media)](https://www.dogtownmedia.com/the-ask-when-and-how-to-request-mobile-app-permissions-camera-location-contacts/)
- [React Native — Accessibility (documentación oficial)](https://reactnative.dev/docs/accessibility)
- [Motor Impairments and Mobile UI: The Touch Target Problem (Siteimprove)](https://www.siteimprove.com/blog/motor-impairments-and-mobile-ui-the-touch-target-problem/)
- [Mobile App Accessibility: WCAG Compliance Guide (Level Access)](https://www.levelaccess.com/blog/wcag-for-mobile-apps/)
- [Mobile Accessibility: How WCAG 2.0 applies to Mobile (W3C/WAI)](https://www.w3.org/TR/mobile-accessibility-mapping/)
- [Dealing With Accessibility Font Sizes in React Native (Ignite Cookbook)](https://ignitecookbook.com/docs/recipes/AccessibilityFontSizes/)
- [Bottom Sheets: Definition and UX Guidelines (Nielsen Norman Group)](https://www.nngroup.com/articles/bottom-sheet/)
- [DoorDash Delivery: a UX Case Study](https://tlindstrom.medium.com/doordash-delivery-a-ux-case-study-91fd38612e0)
- [Food Delivery App Design: Must-Have Features (Seven Square)](https://www.sevensquaretech.com/food-delivery-app-design-for-higher-engagement/)
- [react-native-place-picker (GitHub — archivado abr-2026)](https://github.com/b0iq/react-native-place-picker)
