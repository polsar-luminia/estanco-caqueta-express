import { useState } from "react";
import { View, Text, Pressable, ActivityIndicator, Linking } from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Location from "expo-location";
import {
  type UbicacionCapturada,
  formatoPrecision,
  esUbicacionAproximada,
} from "../lib/api";

// Botón "Usar mi ubicación actual" (Geolocalización Fase 1).
// Controlado: el padre guarda la `UbicacionCapturada` y la manda al backend.
// Permiso SOLO al tocar el botón (nunca al abrir la app). Todos los fallbacks
// del PLAN §2.1: permiso denegado, canAskAgain=false → Ajustes, timeout, error.
// La dirección escrita SIGUE siendo obligatoria; esto solo agrega el pin.

type Estado = "idle" | "capturando";

interface Props {
  value: UbicacionCapturada | null;
  onChange: (u: UbicacionCapturada | null) => void;
}

const TIMEOUT_MS = 8000;

// reverseGeocode con timeout propio; nunca bloquea la captura.
async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const arr = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    const r = arr?.[0];
    if (!r) return null;
    const calle = [r.street, r.name].find((x) => !!x) || undefined;
    const zona = [r.district, r.subregion, r.city].find((x) => !!x) || undefined;
    const texto = [calle, zona].filter(Boolean).join(", ");
    return texto || null;
  } catch {
    return null;
  }
}

function conTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}

export function UbicacionButton({ value, onChange }: Props) {
  const [estado, setEstado] = useState<Estado>("idle");
  const [error, setError] = useState<string | null>(null);
  const [abrirAjustes, setAbrirAjustes] = useState(false);

  const capturar = async () => {
    if (estado === "capturando") return;
    setError(null);
    setAbrirAjustes(false);
    setEstado("capturando");
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        if (perm.canAskAgain === false) {
          setAbrirAjustes(true);
          setError("Sin acceso a tu ubicación. Actívalo en Ajustes o escribe tu dirección normalmente.");
        } else {
          setError("Sin acceso a tu ubicación — puedes escribir la dirección normalmente.");
        }
        return;
      }

      const pos = await conTimeout(
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
        TIMEOUT_MS,
      );
      const { latitude, longitude, accuracy } = pos.coords;
      const geocoded = await reverseGeocode(latitude, longitude);
      onChange({
        lat: latitude,
        lng: longitude,
        precision_m: accuracy ?? null,
        metodo_ubicacion: "gps",
        geocoded_direccion: geocoded,
      });
    } catch (e) {
      const esTimeout = e instanceof Error && e.message === "timeout";
      setError(
        esTimeout
          ? "No pudimos obtener tu ubicación a tiempo. Escribe tu dirección normalmente."
          : "No pudimos obtener tu ubicación. Escribe tu dirección normalmente.",
      );
    } finally {
      setEstado("idle");
    }
  };

  // Estado: ubicación capturada
  if (value) {
    const precision = formatoPrecision(value.precision_m);
    const aproximada = esUbicacionAproximada(value.precision_m);
    return (
      <View
        style={{
          backgroundColor: "rgba(31,175,85,0.08)",
          borderRadius: 12,
          borderWidth: 1,
          borderColor: "rgba(31,175,85,0.25)",
          padding: 12,
          marginBottom: 12,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
            <Feather name="check-circle" size={16} color="#1FAF55" />
            <Text style={{ fontSize: 13, fontWeight: "700", color: "#1A7A3C" }}>
              Ubicación guardada{precision ? ` (${precision})` : ""}
            </Text>
          </View>
          <Pressable
            onPress={() => onChange(null)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Quitar ubicación"
            style={{ flexDirection: "row", alignItems: "center", gap: 4, padding: 4 }}
          >
            <Feather name="x" size={14} color="#6D7B6C" />
            <Text style={{ fontSize: 12, fontWeight: "600", color: "#6D7B6C" }}>Quitar</Text>
          </Pressable>
        </View>
        {value.geocoded_direccion ? (
          <Text style={{ fontSize: 12, color: "#6D7B6C", marginTop: 4, marginLeft: 24 }}>
            {value.geocoded_direccion} (aprox.)
          </Text>
        ) : null}
        {aproximada ? (
          <Text style={{ fontSize: 11, color: "#B8860B", marginTop: 4, marginLeft: 24 }}>
            Ubicación aproximada — revisa que la dirección y las referencias estén completas.
          </Text>
        ) : null}
      </View>
    );
  }

  // Estado: botón + posibles mensajes de fallback
  return (
    <View style={{ marginBottom: 12 }}>
      <Pressable
        onPress={capturar}
        disabled={estado === "capturando"}
        accessibilityRole="button"
        accessibilityLabel="Usar mi ubicación actual"
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          paddingVertical: 12,
          borderRadius: 12,
          borderWidth: 1.5,
          borderColor: "#1FAF55",
          backgroundColor: "#fff",
          opacity: estado === "capturando" ? 0.7 : 1,
        }}
      >
        {estado === "capturando" ? (
          <ActivityIndicator size="small" color="#1FAF55" />
        ) : (
          <Feather name="map-pin" size={16} color="#1FAF55" />
        )}
        <Text style={{ fontSize: 14, fontWeight: "700", color: "#1FAF55" }}>
          {estado === "capturando" ? "Obteniendo ubicación..." : "Usar mi ubicación actual"}
        </Text>
      </Pressable>

      {error ? (
        <View style={{ marginTop: 6 }}>
          <Text style={{ fontSize: 12, color: "#6D7B6C" }}>{error}</Text>
          {abrirAjustes ? (
            <Pressable onPress={() => Linking.openSettings()} hitSlop={6} style={{ marginTop: 4 }}>
              <Text style={{ fontSize: 12, fontWeight: "700", color: "#1FAF55" }}>Abrir Ajustes</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
