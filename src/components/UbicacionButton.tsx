import { useState, useRef } from "react";
import { View, Text, Pressable, ActivityIndicator, Linking } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import {
  type UbicacionCapturada,
  formatoPrecision,
  esUbicacionAproximada,
} from "../lib/api";
import { useUbicacionPicker } from "../stores/ubicacionPicker";

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

// Un cold-fix de GPS en dispositivo real (sobre todo bajo techo) suele pasar de
// 8 s; 15 s + fast-path de última ubicación conocida da una captura confiable.
const TIMEOUT_MS = 15000;

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

function aUbicacion(pos: Location.LocationObject, geocoded: string | null): UbicacionCapturada {
  return {
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    precision_m: pos.coords.accuracy ?? null,
    metodo_ubicacion: "gps",
    geocoded_direccion: geocoded,
  };
}

export function UbicacionButton({ value, onChange }: Props) {
  const router = useRouter();
  const abrirPicker = useUbicacionPicker((s) => s.abrir);
  const [estado, setEstado] = useState<Estado>("idle");
  const [error, setError] = useState<string | null>(null);
  const [abrirAjustes, setAbrirAjustes] = useState(false);
  const [refinando, setRefinando] = useState(false);
  // Cada captura tiene un id; los updates en segundo plano de una captura vieja
  // (o cancelada con "Quitar") se descartan.
  const sesionRef = useRef(0);

  const capturar = async () => {
    if (estado === "capturando") return;
    const sesion = ++sesionRef.current;
    const vigente = () => sesionRef.current === sesion;

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

      // ¿Los servicios de ubicación del sistema están encendidos?
      const serviciosOn = await Location.hasServicesEnabledAsync().catch(() => true);
      if (!serviciosOn) {
        setError("Activa la Ubicación del teléfono e inténtalo de nuevo, o escribe tu dirección normalmente.");
        return;
      }

      // 1) INSTANTÁNEO (como Rappi): mostramos ya la última ubicación conocida y
      //    seguimos afinando en segundo plano. Solo si el SO tiene un fix reciente.
      const last = await Location.getLastKnownPositionAsync({ maxAge: 300000 }).catch(() => null);
      let entregada = false;
      if (last && vigente()) {
        onChange(aUbicacion(last, null));
        entregada = true;
        setRefinando(true);
        setEstado("idle"); // ya hay pin; lo demás es refinamiento silencioso
        // geocode del lastKnown en segundo plano (no bloquea)
        reverseGeocode(last.coords.latitude, last.coords.longitude).then((g) => {
          if (g && vigente()) onChange(aUbicacion(last, g));
        });
      }

      // 2) Fix fresco (Balanced: wifi/celular + GPS → rápido y funciona bajo techo).
      let fresh: Location.LocationObject | null = null;
      try {
        fresh = await conTimeout(
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
          TIMEOUT_MS,
        );
      } catch {
        if (!entregada && vigente()) {
          setError("No pudimos obtener tu ubicación a tiempo. Escribe tu dirección normalmente.");
        }
        return;
      }

      if (fresh && vigente()) {
        const g = await reverseGeocode(fresh.coords.latitude, fresh.coords.longitude);
        if (vigente()) onChange(aUbicacion(fresh, g));
      }
    } catch {
      if (vigente()) setError("No pudimos obtener tu ubicación. Escribe tu dirección normalmente.");
    } finally {
      if (vigente()) {
        setEstado("idle");
        setRefinando(false);
      }
    }
  };

  // Quitar: cancela cualquier refinamiento en curso para que no reaparezca el pin.
  const quitar = () => {
    sesionRef.current++;
    setRefinando(false);
    setError(null);
    onChange(null);
  };

  // Abrir el mapa (Fase 2): centra en el pin actual si existe. El callback aplica
  // el resultado y cancela cualquier refinamiento GPS en curso.
  const abrirMapa = () => {
    sesionRef.current++;
    setRefinando(false);
    setError(null);
    abrirPicker(
      (u) => onChange(u),
      value && value.lat != null && value.lng != null ? { lat: value.lat, lng: value.lng } : null,
    );
    router.push("/ubicacion");
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
          {refinando ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 4 }}>
              <ActivityIndicator size="small" color="#1FAF55" />
              <Text style={{ fontSize: 11, color: "#6D7B6C" }}>Afinando…</Text>
            </View>
          ) : (
            <Pressable
              onPress={quitar}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Quitar ubicación"
              style={{ flexDirection: "row", alignItems: "center", gap: 4, padding: 4 }}
            >
              <Feather name="x" size={14} color="#6D7B6C" />
              <Text style={{ fontSize: 12, fontWeight: "600", color: "#6D7B6C" }}>Quitar</Text>
            </Pressable>
          )}
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
        {!refinando ? (
          <Pressable onPress={abrirMapa} hitSlop={6} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8, marginLeft: 24 }}>
            <Feather name="map" size={13} color="#1FAF55" />
            <Text style={{ fontSize: 12, fontWeight: "700", color: "#1FAF55" }}>Ajustar en el mapa</Text>
          </Pressable>
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

      {estado !== "capturando" ? (
        <Pressable onPress={abrirMapa} hitSlop={6} style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 8 }}>
          <Feather name="map" size={13} color="#6D7B6C" />
          <Text style={{ fontSize: 12, fontWeight: "600", color: "#6D7B6C" }}>o ubícalo en el mapa</Text>
        </Pressable>
      ) : null}

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
