/**
 * Horario Estanco Caquetá Express (America/Bogota):
 * Lun–Jue: 8:00–19:00
 * Vie–Sab: 8:00–24:00
 * Dom:     9:00–16:30
 */

export interface EstadoTienda {
  abierta: boolean;
  // Ej: "Abrimos hoy a las 8:00 am" | "Abrimos el viernes a las 8:00 am"
  proximaApertura: string;
}

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

function minutosDelDia(h: number, m: number) {
  return h * 60 + m;
}

function horario(dia: number): { abre: number; cierra: number } {
  if (dia === 0) return { abre: minutosDelDia(9, 0), cierra: minutosDelDia(16, 30) };
  if (dia >= 5) return { abre: minutosDelDia(8, 0), cierra: minutosDelDia(24, 0) };
  return { abre: minutosDelDia(8, 0), cierra: minutosDelDia(19, 0) };
}

function formatHora(minutos: number) {
  const h = Math.floor(minutos / 60) % 24;
  const m = minutos % 60;
  const ampm = h < 12 ? "am" : "pm";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return m === 0 ? `${h12}:00 ${ampm}` : `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

export function getTiendaAbierta(): EstadoTienda {
  const now = new Date();

  // Ajustar a UTC-5 (America/Bogota, sin DST)
  const offsetMs = (now.getTimezoneOffset() + 300) * 60 * 1000;
  const bogota = new Date(now.getTime() - offsetMs);

  const dia = bogota.getDay();
  const ahora = minutosDelDia(bogota.getHours(), bogota.getMinutes());
  const { abre, cierra } = horario(dia);

  if (ahora >= abre && ahora < cierra) {
    return { abierta: true, proximaApertura: "" };
  }

  // Calcular próxima apertura
  if (ahora < abre) {
    // Abre más tarde hoy
    return {
      abierta: false,
      proximaApertura: `Abrimos hoy a las ${formatHora(abre)}`,
    };
  }

  // Ya cerró — buscar el próximo día
  let sigDia = (dia + 1) % 7;
  let diasSumados = 1;
  while (diasSumados <= 7) {
    const sig = horario(sigDia);
    if (sig.abre < sig.cierra) {
      const label = diasSumados === 1 ? "mañana" : `el ${DIAS[sigDia]}`;
      return {
        abierta: false,
        proximaApertura: `Abrimos ${label} a las ${formatHora(sig.abre)}`,
      };
    }
    sigDia = (sigDia + 1) % 7;
    diasSumados++;
  }

  return { abierta: false, proximaApertura: "Temporalmente cerrado" };
}

import { useState, useEffect } from "react";

export function useTiendaAbierta(): EstadoTienda {
  const [estado, setEstado] = useState<EstadoTienda>(getTiendaAbierta);

  useEffect(() => {
    // Re-evaluar cada minuto
    const id = setInterval(() => setEstado(getTiendaAbierta()), 60_000);
    return () => clearInterval(id);
  }, []);

  return estado;
}
