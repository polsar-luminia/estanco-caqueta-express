import { View, Text } from "react-native";
import { useState, useEffect } from "react";
import { fuentes } from "../constants/theme";

interface Props {
  // Fecha/hora de expiración como string ISO (ej. "2026-05-08T23:59:00.000Z")
  expiresAt: string | null | undefined;
  // Color de fondo del chip. Default: rojo relámpago.
  color?: string;
}

export function CountdownChip({ expiresAt, color = '#DC2626' }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!expiresAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [expiresAt]);

  if (!expiresAt) return null;

  const diff = new Date(expiresAt).getTime() - now;
  if (diff <= 0) return null;

  const totalSecs = Math.floor(diff / 1000);
  const h = String(Math.floor(totalSecs / 3600)).padStart(2, '0');
  const m = String(Math.floor((totalSecs % 3600) / 60)).padStart(2, '0');
  const s = String(totalSecs % 60).padStart(2, '0');

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: color,
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 5,
      }}
    >
      <Text style={{ fontSize: 12, fontFamily: fuentes.destacado, color: '#fff' }}>
        ⏱ {h}:{m}:{s}
      </Text>
    </View>
  );
}
