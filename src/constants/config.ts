export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "https://api.estancocaqueta.com/api/v1";

export const WHATSAPP_SOPORTE = "https://wa.me/573189495704";

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
