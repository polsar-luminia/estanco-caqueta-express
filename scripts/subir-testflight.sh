#!/bin/bash
# Sube un .ipa a TestFlight SIN pasar por los servidores de EAS.
#
# POR QUE EXISTE: `eas submit` manda el artefacto a EAS para que ellos lo suban.
# Esto usa `altool` de Xcode contra la App Store Connect API con la llave que ya
# esta en ~/.appstoreconnect/private_keys/. Todo local salvo la llamada a Apple,
# que es el destino.
#
# Requiere en el entorno (viven en ~/.zshrc):
#   ASC_KEY_ID     id de la llave (el del nombre del .p8)
#   ASC_ISSUER_ID  el UUID del equipo, de App Store Connect -> Integraciones
#
# altool busca la llave en ~/.appstoreconnect/private_keys/AuthKey_$ASC_KEY_ID.p8
# por convencion: NO se le pasa la ruta.
#
# Uso: scripts/subir-testflight.sh /ruta/app.ipa
set -uo pipefail

IPA="${1:-}"
[ -z "$IPA" ] && { echo "Uso: $0 <ruta.ipa>"; exit 1; }
[ -f "$IPA" ] || { echo "No existe: $IPA"; exit 1; }
: "${ASC_KEY_ID:?falta ASC_KEY_ID (source ~/.zshrc)}"
: "${ASC_ISSUER_ID:?falta ASC_ISSUER_ID (source ~/.zshrc)}"

echo "Validando $IPA ..."
xcrun altool --validate-app -f "$IPA" -t ios \
  --apiKey "$ASC_KEY_ID" --apiIssuer "$ASC_ISSUER_ID" || {
    echo "FALLO LA VALIDACION. No se sube."; exit 1; }

echo
echo "Subiendo a TestFlight ..."
xcrun altool --upload-app -f "$IPA" -t ios \
  --apiKey "$ASC_KEY_ID" --apiIssuer "$ASC_ISSUER_ID" || {
    echo "FALLO LA SUBIDA."; exit 1; }

echo
echo "Subido. Apple tarda unos minutos en procesarlo antes de que aparezca en"
echo "TestFlight. Subir NO es enviar a revision: eso sigue siendo manual en"
echo "App Store Connect."
