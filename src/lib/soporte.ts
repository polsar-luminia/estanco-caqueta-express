// Punto único de acceso al contacto de soporte (093).
//
// Antes esto estaba copiado en cinco sitios (ubicacion.tsx, profile.tsx,
// orders/index.tsx, support/help.tsx x2), y solo UNO de los cinco tenía el
// fallback a api.whatsapp.com/send?phone= cuando wa.me falla en el
// dispositivo. Cambiar el número era editar constants/config.ts y publicar —
// eso fue justo lo que pasó el 22-ago-2026 cuando Meta bloqueó el número
// personal (commit ecf289c). Debió ser un UPDATE.
//
// Cadena de respaldo, tres capas — un botón de soporte que no hace nada es
// peor que uno con un número viejo:
//   1. config.soporte (remoto, /configuracion-app, cambiable sin deploy)
//   2. WHATSAPP_SOPORTE / TELEFONO_SOPORTE_RESPALDO (arranque en frío, backend caído)
//   3. si Linking.openURL falla igual, api.whatsapp.com/send?phone=

import { Linking } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { getConfigApp } from "./api";
import {
  WHATSAPP_SOPORTE,
  TELEFONO_SOPORTE_RESPALDO,
  CORREO_SOPORTE_RESPALDO,
} from "../constants/config";

export function useSoporte() {
  // Mismo queryKey que cart.tsx, profile.tsx, orders/index.tsx: comparten
  // caché, un solo round-trip aunque el cliente pase por varias pantallas.
  const { data: configApp } = useQuery({
    queryKey: ["config-app"],
    queryFn: getConfigApp,
    staleTime: 5 * 60 * 1000,
  });

  const whatsappUrl = configApp?.soporte?.whatsapp_url || WHATSAPP_SOPORTE;
  const telefono = configApp?.soporte?.telefono || TELEFONO_SOPORTE_RESPALDO;
  const correo = configApp?.soporte?.correo || CORREO_SOPORTE_RESPALDO;

  const abrirWhatsApp = () => {
    Linking.openURL(whatsappUrl).catch(() => {
      Linking.openURL(whatsappUrl.replace("wa.me/", "api.whatsapp.com/send?phone="));
    });
  };

  const abrirTelefono = () => {
    Linking.openURL(`tel:${telefono}`).catch(() => {});
  };

  return { whatsappUrl, telefono, correo, abrirWhatsApp, abrirTelefono };
}
