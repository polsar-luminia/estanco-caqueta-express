#!/bin/bash
# Corre los flujos de Maestro EN ORDEN y para al primer fallo.
#
# Existe porque `maestro test .maestro/` lanza los flujos en paralelo sobre el
# mismo dispositivo: los cold-starts se pisan entre sí y fallan por lentitud,
# no por bugs. En orden y de a uno, la suite es determinista (03 crea el
# pedido que 04 cancela).
#
# Uso:
#   MAESTRO_ENV=local scripts/maestro-suite.sh [--device <id>]
# Requisitos: ver .maestro/README.md (backend de pruebas + app instalada + Metro).
set -uo pipefail

export PATH="$PATH:$HOME/.maestro/bin"
export JAVA_HOME="${JAVA_HOME:-$HOME/.local/share/mise/installs/java/temurin-17}"

DIR="$(cd "$(dirname "$0")/.." && pwd)/.maestro"
ADB="${ADB:-$HOME/Library/Android/sdk/platform-tools/adb}"

# Precondiciones. Sin esto los fallos mienten: cuando el emulador pierde los
# tuneles de adb (el daemon se reinicia solo cada tanto) la app no encuentra el
# bundle de Metro, arranca en pantalla roja, y Maestro lo reporta como "no
# encontre el elemento X" — una hora persiguiendo un selector que estaba bien.
if ! curl -s --max-time 3 http://127.0.0.1:3999/api/v1/health | grep -q '"ok"'; then
  echo "ERROR: el backend de pruebas no responde en 127.0.0.1:3999."
  echo "  Levantalo: cd '../Polo & Salazar/Polo Dashboard' && npm run servidor:pruebas --workspace=packages/api"
  exit 1
fi
if ! curl -s --max-time 3 http://127.0.0.1:8081/status | grep -q running; then
  echo "ERROR: Metro no responde en 8081."
  echo "  Levantalo: EXPO_PUBLIC_API_URL=http://127.0.0.1:3999/api/v1 EXPO_PUBLIC_E2E=1 npx expo start --port 8081"
  exit 1
fi
# Los tuneles solo aplican al emulador Android; con --device <udid> de iOS no.
if [[ "$*" != *--device* ]] && "$ADB" get-state >/dev/null 2>&1; then
  for puerto in 8081 3999; do
    if ! "$ADB" reverse --list | grep -q "tcp:$puerto"; then
      echo "Restaurando tunel adb reverse tcp:$puerto (se habia perdido)"
      "$ADB" reverse "tcp:$puerto" "tcp:$puerto" >/dev/null
    fi
  done
fi

# GUARDARRAIL PRINCIPAL: comprobar que la APP habla con el backend de pruebas.
#
# El 30-jul-2026 una corrida creo una cuenta REAL en produccion: la app habia
# caido a su bundle embebido (compilado sin EXPO_PUBLIC_API_URL) y apuntaba a
# api.estancocaqueta.com. MAESTRO_ENV no lo evita — protege contra "se me olvido
# la variable", no contra "la app no esta mirando aca". Lo unico confiable es
# preguntarle al servidor de pruebas si vio llegar las peticiones: se arranca la
# app y se mira su contador. Si no se mueve, se aborta ANTES de escribir nada.
APP_ID="co.estancocaqueta.express"
contador() { curl -s --max-time 3 http://127.0.0.1:3999/pruebas/contador | sed 's/[^0-9]//g'; }

antes="$(contador)"
if [ -z "$antes" ]; then
  echo "ERROR: el backend de pruebas no expone /pruebas/contador."
  echo "  Reinicialo con la version nueva: npm run servidor:pruebas --workspace=packages/api"
  exit 1
fi

# Arrancar la app en frio (mismo gesto en las dos plataformas).
if [[ "$*" == *--device* ]]; then
  udid="${*#*--device }"; udid="${udid%% *}"
  xcrun simctl terminate "$udid" "$APP_ID" >/dev/null 2>&1
  # iOS: `clearState` de Maestro NO borra el Keychain (vive fuera del sandbox de
  # datos), asi que la sesion del cliente sobrevive entre corridas y los flujos
  # que esperan un invitado aterrizan en el perfil. Reinstalar si lo limpia.
  IOS_APP_PATH="${IOS_APP_PATH:-$(cd "$(dirname "$0")/.." && pwd)/ios/build/Build/Products/Debug-iphonesimulator/EstancoCaquetExpress.app}"
  if [ -d "$IOS_APP_PATH" ]; then
    xcrun simctl uninstall "$udid" "$APP_ID" >/dev/null 2>&1
    xcrun simctl install "$udid" "$IOS_APP_PATH" >/dev/null 2>&1
  else
    echo "AVISO: no encuentro el .app en $IOS_APP_PATH; la sesion del Keychain puede sobrevivir."
  fi
  xcrun simctl launch "$udid" "$APP_ID" >/dev/null 2>&1
else
  "$ADB" shell am force-stop "$APP_ID" >/dev/null 2>&1
  # `monkey -c LAUNCHER` NO arranca la app en este AVD (sale sin error y deja el
  # launcher en pantalla); `am start` con la activity explicita si.
  "$ADB" shell am start -n "$APP_ID/.MainActivity" >/dev/null 2>&1
fi

echo "Verificando que la app hable con el backend de pruebas..."
limite=$((SECONDS + 90))
while [ "$(contador)" = "$antes" ] && [ $SECONDS -lt $limite ]; do sleep 3; done
if [ "$(contador)" = "$antes" ]; then
  echo "ABORTADO: la app arranco pero el backend de pruebas no vio NINGUNA peticion."
  echo "  Casi seguro esta apuntando a PRODUCCION (bundle embebido sin EXPO_PUBLIC_API_URL)."
  echo "  Revisa: Metro arrancado con EXPO_PUBLIC_API_URL=http://127.0.0.1:3999/api/v1,"
  echo "  los tuneles adb reverse, y que la app cargue el bundle de Metro (no el embebido)."
  exit 1
fi
echo "OK: el backend de pruebas esta recibiendo peticiones de la app."

fallos=0
for flujo in "$DIR"/0*.yaml; do
  echo "──── $(basename "$flujo")"
  if ! maestro test "$@" "$flujo"; then
    echo "FALLÓ: $(basename "$flujo")"
    fallos=1
    break
  fi
done
exit $fallos
