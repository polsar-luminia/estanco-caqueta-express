// src/components/icons/AppIcons.tsx
// Íconos SVG para reemplazar emojis funcionales en la app.
// Mismo estilo que TabIcons.tsx: strokeWidth 1.5, strokeLinecap round, strokeLinejoin round.
// Generado: Mayo 2026 — Estanco Caquetá Express

import Svg, { Path, Rect, Circle } from 'react-native-svg';

interface IconProps {
  color?: string;  // default '#6D7B6C'
  size?: number;   // default 20
}

// ── Auth ─────────────────────────────────────────────────────

/** Reemplaza 📱 en login.tsx, register.tsx, forgot-password.tsx */
export function PhoneIcon({ color = '#6D7B6C', size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1C10.6 21 3 13.4 3 4c0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02L6.6 10.8z"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Reemplaza 🔒 en login.tsx, register.tsx, verify-otp.tsx */
export function LockIcon({ color = '#6D7B6C', size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="11" width="18" height="11" rx="2"
        stroke={color} strokeWidth={1.5} />
      <Path d="M7 11V7a5 5 0 0110 0v4"
        stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      <Circle cx="12" cy="16.5" r="1.5" fill={color} />
    </Svg>
  );
}

/** Reemplaza 👁️ — toggle mostrar contraseña */
export function EyeIcon({ color = '#6D7B6C', size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
        stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      <Circle cx="12" cy="12" r="3"
        stroke={color} strokeWidth={1.5} />
    </Svg>
  );
}

/** Reemplaza 🙈 — toggle ocultar contraseña */
export function EyeOffIcon({ color = '#6D7B6C', size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"
        stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      <Path d="M1 1l22 22"
        stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}

/** Reemplaza 🔑 en verify-otp.tsx */
export function KeyIcon({ color = '#6D7B6C', size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="7.5" cy="15.5" r="4.5"
        stroke={color} strokeWidth={1.5} />
      <Path d="M10.5 12.5L21 2M17 6l2 2"
        stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}

/** Reemplaza 👤 en register.tsx (input Nombre) y profile.tsx (avatar)
 *  También exportado como ProfileIcon en TabIcons.tsx — usar cualquiera. */
export function UserIcon({ color = '#6D7B6C', size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"
        stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M12 11a4 4 0 100-8 4 4 0 000 8z"
        stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}

// ── Cart ──────────────────────────────────────────────────────

/** Reemplaza 🚚 en cart.tsx — encabezado sección "Entrega" */
export function TruckIcon({ color = '#6D7B6C', size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="1" y="3" width="13" height="13" rx="1"
        stroke={color} strokeWidth={1.5} />
      <Path d="M16 8h4l3 3v5h-7V8z"
        stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="5.5" cy="18.5" r="2.5"
        stroke={color} strokeWidth={1.5} />
      <Circle cx="18.5" cy="18.5" r="2.5"
        stroke={color} strokeWidth={1.5} />
    </Svg>
  );
}

/** Reemplaza 🏷️ en cart.tsx — encabezado sección "Cupón" */
export function TagIcon({ color = '#6D7B6C', size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"
        stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="7" cy="7" r="1" fill={color} />
    </Svg>
  );
}

// ── Misc ──────────────────────────────────────────────────────

/** Reemplaza 💬 en support/help.tsx — botón WhatsApp */
export function MessageIcon({ color = '#6D7B6C', size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"
        stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ── Search ────────────────────────────────────────────────────

/** Reemplaza Feather "search" en search.tsx — barra de búsqueda y empty state */
export function SearchIcon({ color = '#9E9E9E', size = 18 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M11 19a8 8 0 100-16 8 8 0 000 16z"
        stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Path d="M21 21l-4.35-4.35"
        stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

/** Reemplaza Feather "x" en search.tsx — botón limpiar input */
export function CloseIcon({ color = '#9E9E9E', size = 16 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M18 6L6 18M6 6l12 12"
        stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

/** Ícono reloj — chips de búsquedas recientes en search.tsx */
export function ClockIcon({ color = '#BCCABA', size = 13 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth={1.5} />
      <Path d="M12 7v5l3 3" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}

// ── Profile ───────────────────────────────────────────────────

/** Ícono copiar — botón copiar código de referido en profile.tsx */
export function CopyIcon({ color = '#fff', size = 14 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="9" y="9" width="13" height="13" rx="2" stroke={color} strokeWidth={1.5} />
      <Path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"
        stroke={color} strokeWidth={1.5} />
    </Svg>
  );
}

// ── NOTE: 🛵 y ⚡ en express banners — MANTENER como emoji ────
// Son puramente decorativos (opacity 0.2-0.25), no transmiten función
// y el riesgo de rendering inconsistente es mínimo a esa opacidad.
