export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "https://api.estancocaqueta.com/api/v1";

// Temporal (22-ago-2026): el numero personal de soporte (318 949 5704) fue
// bloqueado por Meta. Mientras se resuelve, el soporte entra por el numero de
// marketing/Cloud API (+1 555-349-4324) — asi ademas queda registrado en
// whatsapp_entrantes y dispara el aviso a Telegram, cosa que el numero
// personal nunca hizo. Revertir cuando el personal se desbloquee, si se
// prefiere separar los canales de nuevo.
export const WHATSAPP_SOPORTE = "https://wa.me/15553494324";

// Numero del WhatsApp Business de Estanco Caqueta Express (WABA verificada en Meta).
// Se usa en el flujo "Olvide contrasena": el usuario abre WhatsApp y manda un saludo
// para abrir ventana de 24h, lo cual permite que Meta entregue el OTP UTILITY.
// (Mientras Meta desbloquea creacion de templates AUTHENTICATION, este es el path.)
export const WHATSAPP_NEGOCIO = "573180427695";
export const WHATSAPP_NEGOCIO_LINK = `https://wa.me/${WHATSAPP_NEGOCIO}?text=${encodeURIComponent(
  "Solicito mi codigo de verificacion - Estanco Caqueta Express"
)}`;

// Fichas de la app en las tiendas. Las usa la pantalla de actualizacion obligatoria
// (bloque G): el boton tiene que llevar a la tienda correcta segun la plataforma,
// o el bloqueo deja a la persona sin salida.
// El id de iOS es el `ascAppId` de App Store Connect; el de Android, el package.
export const APP_STORE_URL = "https://apps.apple.com/app/id6769148116";
export const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=co.estancocaqueta.express";

// --- Medio de pago (093) y soporte configurable ---
//
// El catalogo REAL y el numero de soporte vigente viven en el backend
// (/configuracion-app: medios_pago, soporte). Lo de aqui es SOLO el respaldo:
// arranque en frio (antes de la primera respuesta del servidor) y backend
// caido. Igual que MOTIVOS_RESPALDO en HojaCancelar.tsx.

import { colors } from "./theme";

/** Igual al texto que hoy prometen help.tsx y terms.tsx. Si el backend
 *  cambia el catalogo, esto queda desactualizado hasta el proximo release —
 *  que es exactamente el problema que 093 resuelve para el camino feliz. */
export const MEDIOS_PAGO_RESPALDO: {
  codigo: string;
  etiqueta: string;
  descripcion: string;
  pide_vuelto: boolean;
}[] = [
  {
    codigo: "efectivo",
    etiqueta: "Efectivo",
    descripcion: "Paga en billetes al domiciliario cuando recibas tu pedido.",
    pide_vuelto: true,
  },
  {
    codigo: "transferencia",
    etiqueta: "Transferencia / QR",
    descripcion: "El domiciliario lleva un código QR para pagar con Nequi, Daviplata o cualquier app bancaria.",
    pide_vuelto: false,
  },
  {
    codigo: "datafono",
    etiqueta: "Datáfono",
    descripcion: "Tarjeta débito o crédito. El domiciliario lleva datáfono inalámbrico para pagar contra entrega.",
    pide_vuelto: false,
  },
];

/** Ícono y color por código. Con un código que el servidor agregó pero esta
 *  versión de la app todavía no conoce, cae al genérico en vez de romper la
 *  pantalla — es la misma regla que protege el catálogo propio de productos. */
export const ICONOS_MEDIO: Record<string, { icon: "dollar-sign" | "smartphone" | "credit-card" | "circle"; color: string; bg: string }> = {
  efectivo: { icon: "dollar-sign", color: colors.green, bg: "rgba(31,175,85,0.08)" },
  transferencia: { icon: "smartphone", color: colors.pink, bg: "rgba(224,69,123,0.08)" },
  datafono: { icon: "credit-card", color: colors.purple, bg: "rgba(124,92,255,0.08)" },
};
export const ICONO_MEDIO_GENERICO = { icon: "circle" as const, color: colors.muted, bg: "rgba(150,150,150,0.08)" };

/** Respaldo del teléfono de soporte. El backend (093) manda el vigente en
 *  `soporte.telefono`; esto es solo el valor con el que la app arranca. */
export const TELEFONO_SOPORTE_RESPALDO = "+573189495704";
export const CORREO_SOPORTE_RESPALDO = "app@estancocaqueta.com";
