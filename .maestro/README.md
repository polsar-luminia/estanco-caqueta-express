# Flujos E2E con Maestro

Flujos de interfaz real sobre el emulador Android (AVD `estanco_test`) y el
simulador de iPhone. Cazan la clase de fallo que ni los tests unitarios ni el
contrato del backend pueden ver: lo que efectivamente se PINTA en pantalla (el
"Error 401" de julio-2026 vivió meses ahí) y los caminos de navegación que
dejan gente atrapada.

## Nunca contra producción

Los flujos crean cuentas, pedidos y cancelaciones. Todos los que escriben
datos llevan un guard default-deny: sin `MAESTRO_ENV` en
`{local, staging, ci, dev}` abortan solos. El backend soportado es el servidor
local de pruebas del repo del backend (Postgres embebido, física y
credencialmente separado de producción):

```bash
cd "../Polo & Salazar/Polo Dashboard"
npm run servidor:pruebas --workspace=packages/api
```

Deja el API en `http://127.0.0.1:3999/api/v1` con catálogo sembrado, la cuenta
`3001234567 / testpass88` (edad confirmada y dirección predeterminada, porque
el carrito exige dirección y agregarla pasa por el mapa) y el cupón válido
`PRUEBA10`. Ctrl+C lo apaga todo.

## Metro con bandera E2E (obligatorio)

```bash
EXPO_PUBLIC_API_URL=http://127.0.0.1:3999/api/v1 EXPO_PUBLIC_E2E=1 npx expo start --port 8081
```

`EXPO_PUBLIC_E2E=1` silencia LogBox. **No es opcional**: el toast de dev
"Open debugger to view warnings" se dibuja exactamente encima del CTA fijo
"Agregar al carrito" y se traga los taps del robot — el paso sale COMPLETED y
el carrito queda vacío. Costó una tarde encontrarlo.

## Android (AVD `estanco_test`)

```bash
# 1. Backend de pruebas y Metro corriendo (arriba)
# 2. Emulador + app
~/Library/Android/sdk/emulator/emulator -avd estanco_test &
export JAVA_HOME=~/.local/share/mise/installs/java/temurin-17
cd android && ./gradlew assembleDebug && cd ..
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
# 3. Túneles: 127.0.0.1 del emulador → el Mac (backend y Metro).
#    OJO: se pierden si el daemon de adb se reinicia; re-correrlos ante
#    "Network request failed" en la app.
adb reverse tcp:3999 tcp:3999
adb reverse tcp:8081 tcp:8081
# 4. La suite entera, en orden y de a una (para al primer fallo):
MAESTRO_ENV=local scripts/maestro-suite.sh
```

**No usar `maestro test .maestro/` directo**: lanza los flujos en paralelo
sobre el mismo dispositivo y los cold-starts se pisan entre sí — fallan por
lentitud, no por bugs. El wrapper existe para eso.

## iPhone (simulador)

`npx expo run:ios` muere en este Mac pidiendo firma de dispositivo físico
aunque se le pase el UDID del simulador. El camino que funciona:

```bash
# CocoaPods vive en el ruby de mise (el shim falla sin ruby global):
export PATH="$HOME/.local/share/mise/installs/ruby/3.3.12/bin:$PATH"
export LANG=en_US.UTF-8
npx expo prebuild --platform ios --no-install   # solo la primera vez
cd ios && pod install && xcodebuild -workspace EstancoCaquetExpress.xcworkspace \
  -scheme EstancoCaquetExpress -configuration Debug \
  -destination "id=<UDID>" -derivedDataPath build CODE_SIGNING_ALLOWED=NO build
xcrun simctl install <UDID> build/Build/Products/Debug-iphonesimulator/EstancoCaquetExpress.app
xcrun simctl launch <UDID> co.estancocaqueta.express
# (UDID: xcrun simctl list devices available)
cd .. && MAESTRO_ENV=local scripts/maestro-suite.sh --device <UDID>
```

El simulador comparte la red del Mac: el mismo Metro y backend sirven sin
túneles.

## Los flujos

| Archivo | Qué verifica | Qué fallo real caza |
|---|---|---|
| `01-registro.yaml` | Registro → edad → dirección → catálogo, y que "Lo hago después" **no deja al usuario atrapado** | onboarding roto = cero clientes nuevos, sin errores en ningún log |
| `02-login-error-legible.yaml` | Contraseña mala muestra el mensaje real con la pista de recuperación | el "Error 401" enmascarado de julio-2026 |
| `03-buscar-y-pedir.yaml` | Buscar → carrito → confirmar → ver pedido "Recibido" | el camino de TODO el ingreso, entre capas reales |
| `04-cancelar-pedido.yaml` | Cancelar el pedido de 03 (Alert nativo incluido) | cancelación desconectada = pedidos fantasma que el staff alista |
| `05-cupon-legible.yaml` | Cupón válido aplica y se puede quitar; el inválido dice "Cupon no encontrado" (no "Error 404") | errores enmascarados + el cupón de los $5.000 |

Los selectores son textos visibles y `accessibilityLabel` (las pantallas no
tienen `testID`). Si cambias un texto de la UI que aparece aquí, el flujo
truena: eso es una señal correcta — el copy es parte del contrato con el
usuario, no un detalle.

## Historia

`flow-pedido.yaml` (borrado) referenciaba testIDs (`input-telefono`,
`tab-cart`) que nunca existieron en ninguna pantalla: no era ejecutable.
`03-buscar-y-pedir.yaml` cubre su escenario con selectores reales.
