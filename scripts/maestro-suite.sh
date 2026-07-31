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
