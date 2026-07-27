/**
 * Campo de dirección con autocompletado de Google Places.
 *
 * Es el tercer camino para fijar el punto de entrega, junto al botón de ubicación
 * actual y al mapa. El cliente escribe, toca una sugerencia, y el pin queda puesto
 * sin arrastrar nada.
 *
 * Si no hay llave de Places configurada, se comporta como el campo de texto de
 * siempre: sin sugerencias, sin errores, sin diferencia visible. Los otros dos
 * caminos siguen intactos.
 */

import { useEffect, useRef, useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import {
  buscarDirecciones,
  resolverDireccion,
  placesDisponible,
  type SugerenciaDireccion,
} from "../lib/places";
import { nuevoUuidV4 } from "../lib/uuid";
import { colors, radii } from "../constants/theme";
import type { UbicacionCapturada } from "../lib/api";

const DEBOUNCE_MS = 350;

export interface BuscadorDireccionProps {
  value: string;
  onChangeText: (t: string) => void;
  /** Se llama al elegir una sugerencia, ya con las coordenadas resueltas. */
  onUbicacion: (u: UbicacionCapturada) => void;
  placeholder?: string;
  accessibilityLabel?: string;
}

export function BuscadorDireccion({
  value,
  onChangeText,
  onUbicacion,
  placeholder = "Escribe tu dirección",
  accessibilityLabel = "Dirección",
}: BuscadorDireccionProps) {
  const [sugerencias, setSugerencias] = useState<SugerenciaDireccion[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [resolviendo, setResolviendo] = useState(false);
  // Una sola sesión desde que empieza a escribir hasta que elige: Google cobra
  // por sesión, no por tecla. Sin esto, cada letra sería una búsqueda facturable.
  const sesionRef = useRef<string>(nuevoUuidV4());
  // Al aplicar una sugerencia cambia el texto, y ese cambio no debe disparar otra
  // búsqueda: si no, la lista reaparece justo después de elegir.
  const ignorarProximaRef = useRef(false);

  useEffect(() => {
    if (!placesDisponible) return;
    if (ignorarProximaRef.current) {
      ignorarProximaRef.current = false;
      return;
    }
    if (value.trim().length < 3) {
      setSugerencias([]);
      return;
    }

    const control = new AbortController();
    const t = setTimeout(async () => {
      setBuscando(true);
      const r = await buscarDirecciones(value, sesionRef.current, control.signal);
      setSugerencias(r);
      setBuscando(false);
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(t);
      control.abort();
    };
  }, [value]);

  const elegir = async (s: SugerenciaDireccion) => {
    setResolviendo(true);
    setSugerencias([]);
    const r = await resolverDireccion(s.id, sesionRef.current);
    // La sesión se cierra al pedir el detalle; la siguiente búsqueda abre otra.
    sesionRef.current = nuevoUuidV4();
    setResolviendo(false);
    if (!r) return;

    ignorarProximaRef.current = true;
    onChangeText(r.direccion || s.principal);
    onUbicacion({
      lat: r.lat,
      lng: r.lng,
      precision_m: null,
      // No es GPS ni un pin arrastrado: es un punto de Google. Se registra como
      // pin_mapa porque, igual que el pin, es una posición elegida y no medida.
      metodo_ubicacion: "pin_mapa",
      geocoded_direccion: r.direccion || null,
    });
  };

  return (
    <View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          backgroundColor: "#fff",
          borderRadius: radii.input,
          paddingHorizontal: 16,
          minHeight: 48,
        }}
      >
        <Feather name="search" size={16} color={colors.faint} />
        <TextInput
          style={{ flex: 1, fontSize: 14, color: colors.ink, paddingVertical: 12 }}
          placeholder={placeholder}
          placeholderTextColor={colors.faint}
          value={value}
          onChangeText={onChangeText}
          accessibilityLabel={accessibilityLabel}
        />
        {(buscando || resolviendo) && <ActivityIndicator size="small" color={colors.green} />}
        {value.length > 0 && !buscando && !resolviendo && (
          <Pressable
            onPress={() => { onChangeText(""); setSugerencias([]); }}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Borrar la dirección escrita"
          >
            <Feather name="x" size={16} color={colors.faint} />
          </Pressable>
        )}
      </View>

      {sugerencias.length > 0 && (
        <View
          style={{
            backgroundColor: "#fff",
            borderRadius: radii.input,
            marginTop: 6,
            overflow: "hidden",
            borderWidth: 1,
            borderColor: colors.line,
          }}
        >
          {sugerencias.map((s, i) => (
            <Pressable
              key={s.id}
              onPress={() => elegir(s)}
              accessibilityRole="button"
              accessibilityLabel={`Usar la dirección ${s.principal}, ${s.secundaria}`}
              style={{
                minHeight: 52,
                justifyContent: "center",
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderTopWidth: i === 0 ? 0 : 0.5,
                borderTopColor: colors.line,
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: "600", color: colors.ink }}>
                {s.principal}
              </Text>
              {!!s.secundaria && (
                <Text style={{ fontSize: 12, color: colors.muted, marginTop: 1 }}>
                  {s.secundaria}
                </Text>
              )}
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}
