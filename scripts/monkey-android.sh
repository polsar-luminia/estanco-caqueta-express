#!/bin/bash
# Buscador de crashes con adb monkey contra co.estancocaqueta.express.
#
# QUE FALLO CAZA: crashes de Android que ninguna prueba dirigida encuentra,
# tocando la pantalla con miles de eventos aleatorios. La semilla FIJA de cada
# sesion es lo que lo vuelve util: un crash sin semilla es una anecdota; con
# semilla es un caso reproducible (se relanza con la misma y revienta igual).
#
# Uso:
#   scripts/monkey-android.sh [sesiones] [eventos_por_sesion] [semilla_inicial]
#   scripts/monkey-android.sh              # 5 sesiones de 5000 eventos, semillas 1001..1005
#   scripts/monkey-android.sh 10 8000 42   # 10 sesiones de 8000, semillas 42..51
#
# Requiere: emulador/dispositivo con la app instalada (npx expo run:android).
# Reporta SOLO las sesiones que rompieron; los logs completos quedan en
# scripts/monkey-logs/ para la autopsia.
set -uo pipefail

PAQUETE="co.estancocaqueta.express"
SESIONES="${1:-5}"
EVENTOS="${2:-5000}"
SEMILLA_INICIAL="${3:-1001}"
ADB="${ADB:-$HOME/Library/Android/sdk/platform-tools/adb}"
LOG_DIR="$(dirname "$0")/monkey-logs"
mkdir -p "$LOG_DIR"

if ! "$ADB" get-state >/dev/null 2>&1; then
  echo "ERROR: no hay dispositivo/emulador conectado. Arranca el AVD primero:"
  echo "  ~/Library/Android/sdk/emulator/emulator -avd estanco_test &"
  exit 1
fi
if ! "$ADB" shell pm list packages | grep -q "$PAQUETE"; then
  echo "ERROR: $PAQUETE no esta instalado en el dispositivo."
  echo "  Instalar con: npx expo run:android (ver .maestro/README.md)"
  exit 1
fi

rotas=0
echo "monkey: $SESIONES sesiones de $EVENTOS eventos (semillas $SEMILLA_INICIAL..$((SEMILLA_INICIAL + SESIONES - 1)))"
echo

for ((i = 0; i < SESIONES; i++)); do
  semilla=$((SEMILLA_INICIAL + i))
  log_monkey="$LOG_DIR/monkey-semilla-$semilla.log"
  log_cat="$LOG_DIR/logcat-semilla-$semilla.log"

  # Logcat limpio por sesion: cada crash queda atribuido a SU semilla.
  "$ADB" logcat -c
  # --pct-syskeys 0: sin teclas de sistema (apagar pantalla mata la sesion sin
  # probar nada). --ignore-timeouts: los ANR no cortan la sesion, se detectan
  # despues en el logcat. --throttle 100: sin pausa el monkey satura el bridge
  # de RN y todo crash seria el mismo falso positivo de saturacion.
  "$ADB" shell monkey -p "$PAQUETE" -s "$semilla" --throttle 100 \
    --pct-syskeys 0 --ignore-timeouts --ignore-crashes -v "$EVENTOS" \
    > "$log_monkey" 2>&1
  estado_monkey=$?
  "$ADB" logcat -d > "$log_cat" 2>/dev/null

  # FATAL EXCEPTION = crash de verdad; ANR = la UI se congelo >5s.
  # Se filtra por el paquete para no achacarle a la app crashes de otros procesos.
  crashes=$(grep -c "FATAL EXCEPTION" "$log_cat" 2>/dev/null || true)
  anrs=$(grep -c "ANR in $PAQUETE" "$log_cat" 2>/dev/null || true)

  if [ "${crashes:-0}" -gt 0 ] || [ "${anrs:-0}" -gt 0 ] || [ "$estado_monkey" -ne 0 ]; then
    rotas=$((rotas + 1))
    echo "ROTA  semilla=$semilla  crashes=$crashes  anrs=$anrs  exit=$estado_monkey"
    grep -A 5 "FATAL EXCEPTION" "$log_cat" | head -20 | sed 's/^/      /'
    echo "      reproducir: adb shell monkey -p $PAQUETE -s $semilla --throttle 100 --pct-syskeys 0 --ignore-timeouts -v $EVENTOS"
    echo "      logs: $log_monkey · $log_cat"
    echo
  else
    echo "ok    semilla=$semilla"
    # Sesion sana: el logcat no aporta nada y ocupa; se borra.
    rm -f "$log_cat"
  fi

  # Volver a un estado conocido para que la siguiente semilla no herede pantalla
  "$ADB" shell am force-stop "$PAQUETE"
  "$ADB" shell monkey -p "$PAQUETE" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
  sleep 2
done

echo
if [ "$rotas" -eq 0 ]; then
  echo "Resultado: $SESIONES sesiones sin crashes ni ANR."
else
  echo "Resultado: $rotas de $SESIONES sesiones rompieron. Semillas y logs arriba."
  exit 1
fi
