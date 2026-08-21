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
