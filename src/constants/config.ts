export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "https://api.estancocaqueta.com/api/v1";

export const WHATSAPP_SOPORTE = "https://wa.me/573155519216";

// Numero del WhatsApp Business de Estanco Caqueta Express (WABA verificada en Meta).
// Se usa en el flujo "Olvide contrasena": el usuario abre WhatsApp y manda un saludo
// para abrir ventana de 24h, lo cual permite que Meta entregue el OTP UTILITY.
// (Mientras Meta desbloquea creacion de templates AUTHENTICATION, este es el path.)
export const WHATSAPP_NEGOCIO = "573180427695";
export const WHATSAPP_NEGOCIO_LINK = `https://wa.me/${WHATSAPP_NEGOCIO}?text=${encodeURIComponent(
  "Solicito mi codigo de verificacion - Estanco Caqueta Express"
)}`;
