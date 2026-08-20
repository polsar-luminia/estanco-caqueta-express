// BandaCerrado — banda de aviso cuando la tienda está cerrada.
// Reemplaza el banner negro que había inline en Inicio y Carrito. El motivo y
// los textos los decide el backend (getEstadoTienda → aviso); aquí solo se
// mapea el `tipo` a color/ícono. Si el backend es viejo y no manda `aviso`,
// se cae al banner genérico "fuera de horario" usando `proximaApertura`.
import type { ReactElement } from "react";
import { View, Text } from "react-native";
import Svg, { Path, Circle } from "react-native-svg";
import type { EstadoTienda, AvisoTipo, AvisoTienda, HorarioFila } from "../lib/api";
import { fuentes } from "../constants/theme";

// Fallback para builds corriendo contra un backend que todavía no manda
// `horario`. Es el horario vigente al 27-jul-2026; el que manda es el del
// admin, este solo evita una banda vacía.
export const HORARIO_FALLBACK: HorarioFila[] = [
  { dias: "Lun – Jue", horas: ["7:00 am – 12:00 pm", "2:00 pm – 7:00 pm"] },
  { dias: "Vie", horas: ["7:00 am – 12:00 pm", "2:00 pm – 12:00 am"] },
  { dias: "Sáb", horas: ["7:00 am – 12:00 am"] },
  { dias: "Dom", horas: ["9:00 am – 4:30 pm"] },
];

interface IconProps {
  color: string;
  size?: number;
}

function ClockIcon({ color, size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={1.5} />
      <Path d="M12 7.5v4.7l3 1.8" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function SadIcon({ color, size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={1.5} />
      <Path d="M8.5 15.5c.9-1.1 2.1-1.7 3.5-1.7s2.6.6 3.5 1.7" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M9 9.5v1.2M15 9.5v1.2" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}

function BottleOffIcon({ color, size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M10 3h4M10.5 3v3.5c0 .5-.15 1-.45 1.4l-.9 1.2c-.42.56-.65 1.24-.65 1.94V19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-7.96c0-.7-.23-1.38-.65-1.94l-.9-1.2c-.3-.4-.45-.9-.45-1.4V3"
        stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"
      />
      <Path d="M4 4l16 16" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}

function CubiertosIcon({ color, size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M8 3v4.5a2 2 0 0 0 4 0V3M10 9.5V21" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M16.5 3c-1.2 1.2-1.8 3.2-1.8 5.5h3.2V3zM16.5 9.5V21" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// Paleta por tipo (tokens del tema Vibrante). fuera_horario y general comparten
// el gris neutro; ley_seca es rojo, almuerzo ámbar.
export const ESTILO: Record<
  AvisoTipo,
  { chipBg: string; iconColor: string; border: string; pillTexto: string; pillBg: string; pillColor: string; Icono: (p: IconProps) => ReactElement }
> = {
  fuera_horario: { chipBg: "#F1F4F0", iconColor: "#6E7A6C", border: "#EBEFE9", pillTexto: "Cerrado", pillBg: "#F1EFE8", pillColor: "#5F5E5A", Icono: ClockIcon },
  general:       { chipBg: "#F1F4F0", iconColor: "#6E7A6C", border: "#EBEFE9", pillTexto: "Cerrado", pillBg: "#F1EFE8", pillColor: "#5F5E5A", Icono: SadIcon },
  ley_seca:      { chipBg: "#FCEBEB", iconColor: "#A32D2D", border: "#F7C1C1", pillTexto: "Cerrado", pillBg: "#FCEBEB", pillColor: "#A32D2D", Icono: BottleOffIcon },
  almuerzo:      { chipBg: "#FAEEDA", iconColor: "#854F0B", border: "#FAC775", pillTexto: "Pausa",   pillBg: "#FAEEDA", pillColor: "#854F0B", Icono: CubiertosIcon },
  // `demora` es el unico que sale con la tienda ABIERTA. Ambar y no rojo a
  // proposito: rojo se lee como "algo se dano" y frena la compra, cuando lo que
  // se esta diciendo es que si se puede comprar, solo que va mas lento.
  demora:        { chipBg: "#FAEEDA", iconColor: "#854F0B", border: "#FAC775", pillTexto: "Demora",  pillBg: "#FAEEDA", pillColor: "#854F0B", Icono: ClockIcon },
};

// Deriva el aviso a mostrar. Fuente de verdad: backend. Fallback para builds
// contra un backend viejo que solo manda `proximaApertura`.
function resolverAviso(tienda: EstadoTienda): AvisoTienda {
  if (tienda.aviso && ESTILO[tienda.aviso.tipo]) return tienda.aviso;
  return {
    tipo: "fuera_horario",
    titulo: "Estamos cerrados",
    mensaje: tienda.proximaApertura || "Vuelve más tarde",
  };
}

interface Props {
  tienda: EstadoTienda;
  /** compact = versión sin horario, para el resumen del carrito. */
  compact?: boolean;
  style?: object;
}

export function BandaCerrado({ tienda, compact = false, style }: Props) {
  if (tienda.abierta) return null;

  const aviso = resolverAviso(tienda);
  const horario = tienda.horario?.length ? tienda.horario : HORARIO_FALLBACK;
  const e = ESTILO[aviso.tipo];
  const { Icono } = e;

  return (
    <View
      style={[
        { backgroundColor: "#fff", borderRadius: 16, borderWidth: 0.5, borderColor: e.border, padding: 14 },
        style,
      ]}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 11 }}>
        <View
          style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: e.chipBg, alignItems: "center", justifyContent: "center" }}
        >
          <Icono color={e.iconColor} size={20} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 13, fontFamily: fuentes.destacado, color: "#16241A" }}>{aviso.titulo}</Text>
          <Text style={{ fontFamily: fuentes.destacado, fontSize: 12, color: "#6E7A6C", marginTop: 1 }} numberOfLines={2}>
            {aviso.mensaje}
          </Text>
        </View>
        <View style={{ backgroundColor: e.pillBg, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 }}>
          <Text style={{ fontSize: 12, fontFamily: fuentes.destacado, color: e.pillColor }}>{e.pillTexto}</Text>
        </View>
      </View>

      {/* Horario semanal — solo en la versión completa y cuando el cierre es por
          horario (no tiene sentido junto a ley seca / almuerzo). */}
      {!compact && aviso.tipo === "fuera_horario" && (
        <View style={{ borderTopWidth: 1, borderTopColor: "#EBEFE9", marginTop: 12, paddingTop: 10, gap: 5 }}>
          {horario.map(({ dias, horas }) => (
            <View key={dias} style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
              <Text style={{ fontFamily: fuentes.destacado, fontSize: 12, color: "#9AA69A" }}>{dias}</Text>
              {/* Los días con pausa traen dos franjas: se apilan a la derecha. */}
              <View style={{ alignItems: "flex-end" }}>
                {horas.map((hora) => (
                  <Text key={hora} style={{ fontSize: 12, color: "#6E7A6C", fontFamily: fuentes.destacado }}>
                    {hora}
                  </Text>
                ))}
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
