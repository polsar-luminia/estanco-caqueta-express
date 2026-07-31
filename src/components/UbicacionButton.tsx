import { useState, useRef } from "react";
import { View, Text, Pressable, ActivityIndicator, Linking } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import MapView, { Marker } from "react-native-maps";
import * as Location from "expo-location";
import { type UbicacionCapturada } from "../lib/api";
import { useUbicacionPicker } from "../stores/ubicacionPicker";
import { useZonaEntrega } from "../hooks/useZonaEntrega";
import { tracker } from "../lib/tracker";
import { PermisoUbicacion } from "./PermisoUbicacion";
import { colors, radii, shadows } from "../constants/theme";

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
  const { fueraDeZona } = useZonaEntrega();
  const [estado, setEstado] = useState<Estado>("idle");
  const [error, setError] = useState<string | null>(null);
  const [abrirAjustes, setAbrirAjustes] = useState(false);
  const [refinando, setRefinando] = useState(false);
  const [mostrarPriming, setMostrarPriming] = useState(false);
  // Cada captura tiene un id; los updates en segundo plano de una captura vieja
  // (o cancelada con "Quitar") se descartan.
  const sesionRef = useRef(0);

  // Tocar el botón ya NO dispara el diálogo del sistema. Primero se explica para
  // qué, porque ese diálogo solo se puede mostrar una vez en la vida de la app:
  // quemarlo con quien habría dicho que sí de haber entendido es irreversible.
  // Si el permiso ya está resuelto (concedido, o negado sin poder volver a pedir),
  // la hoja no aporta nada y se salta.
  const onTocarUsarUbicacion = async () => {
    if (estado === "capturando") return;
    const perm = await Location.getForegroundPermissionsAsync().catch(() => null);
    if (perm?.granted || perm?.canAskAgain === false) {
      capturar();
      return;
    }
    tracker.track("ubicacion_permiso_pedido", undefined, "carrito");
    setMostrarPriming(true);
  };

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
        tracker.track("ubicacion_permiso_negado", undefined, "carrito");
        // El texto ya no manda a "escribir la dirección": con el bloque F el texto
        // libre es una REFERENCIA, no un sustituto del punto. La salida real es el
        // mapa, que funciona sin ningún permiso.
        if (perm.canAskAgain === false) {
          setAbrirAjustes(true);
          setError("Sin acceso a tu ubicación. Puedes ponerlo a mano en el mapa, o activarlo en Ajustes.");
        } else {
          setError("Sin acceso a tu ubicación — ponlo a mano en el mapa.");
        }
        return;
      }
      tracker.track("ubicacion_permiso_concedido", undefined, "carrito");

      // ¿Los servicios de ubicación del sistema están encendidos?
      const serviciosOn = await Location.hasServicesEnabledAsync().catch(() => true);
      if (!serviciosOn) {
        setError("Activa la Ubicación del teléfono e inténtalo de nuevo, o ponlo a mano en el mapa.");
        return;
      }

      // 1) INSTANTÁNEO (como Rappi): mostramos ya la última ubicación conocida y
      //    seguimos afinando en segundo plano. Solo si el SO tiene un fix reciente.
      //    Si el último fix quedó fuera de la zona de reparto no se muestra nada
      //    todavía: puede ser un fix viejo de un viaje, y el veredicto lo da el
      //    fix fresco de abajo.
      const last = await Location.getLastKnownPositionAsync({ maxAge: 300000 }).catch(() => null);
      let entregada = false;
      if (last && vigente() && !fueraDeZona(last.coords.latitude, last.coords.longitude)) {
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
          setError("No pudimos obtener tu ubicación a tiempo. Ponlo a mano en el mapa.");
        }
        return;
      }

      if (fresh && vigente()) {
        // GPS fuera de la zona de reparto: la persona no está en Florencia, así
        // que su ubicación actual no sirve como punto de entrega. No se fija el
        // pin (y se retira el provisional si alcanzó a salir del fast-path). El
        // mapa queda como salida para pedir hacia una dirección que sí esté en
        // la zona.
        if (fueraDeZona(fresh.coords.latitude, fresh.coords.longitude)) {
          tracker.track(
            "fuera_de_zona",
            { lat: fresh.coords.latitude, lng: fresh.coords.longitude },
            "carrito",
          );
          if (entregada) onChange(null);
          setError("Estás fuera de nuestra zona de entrega. Si el pedido es para una dirección en Florencia, ubícala en el mapa.");
          return;
        }
        const g = await reverseGeocode(fresh.coords.latitude, fresh.coords.longitude);
        if (vigente()) onChange(aUbicacion(fresh, g));
      }
    } catch {
      if (vigente()) setError("No pudimos obtener tu ubicación. Ponlo a mano en el mapa.");
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

  // Estado: ubicación capturada → mini-mapa con el pin + acciones.
  // No mostramos precisión ni texto aproximado al cliente (la precisión igual
  // se guarda por detrás para el domiciliario). El pin del mapa es la verdad.
  if (value && value.lat != null && value.lng != null) {
    return (
      <View style={{ marginBottom: 12 }}>
        <View style={{ height: 150, borderRadius: radii.card, overflow: "hidden", ...shadows.soft }}>
          <MapView
            style={{ flex: 1 }}
            pointerEvents="none"
            scrollEnabled={false}
            zoomEnabled={false}
            rotateEnabled={false}
            pitchEnabled={false}
            region={{ latitude: value.lat, longitude: value.lng, latitudeDelta: 0.004, longitudeDelta: 0.004 }}
          >
            <Marker coordinate={{ latitude: value.lat, longitude: value.lng }} pinColor={colors.green} />
          </MapView>
          <View style={{ position: "absolute", top: 10, left: 10, backgroundColor: "rgba(255,255,255,0.94)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, flexDirection: "row", alignItems: "center", gap: 5 }}>
            {refinando ? (
              <ActivityIndicator size="small" color={colors.greenInk} />
            ) : (
              <Feather name="check-circle" size={12} color={colors.greenInk} />
            )}
            <Text style={{ fontSize: 12, fontWeight: "800", color: colors.greenInk }}>
              {refinando ? "Afinando ubicación…" : "Ubicación fijada"}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
          <Pressable
            onPress={abrirMapa}
            accessibilityRole="button"
            accessibilityLabel="Ajustar en el mapa"
            hitSlop={{ top: 4, bottom: 4 }}
            style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 11, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.green }}
          >
            <Feather name="map" size={14} color={colors.greenInk} />
            <Text style={{ fontSize: 13, fontWeight: "800", color: colors.greenInk }}>Ajustar en el mapa</Text>
          </Pressable>
          <Pressable
            onPress={quitar}
            accessibilityRole="button"
            accessibilityLabel="Quitar la ubicación fijada"
            hitSlop={{ top: 4, bottom: 4 }}
            style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 11, paddingHorizontal: 14, borderRadius: 12, backgroundColor: colors.lowfill }}
          >
            <Feather name="x" size={12} color={colors.muted} />
            <Text style={{ fontSize: 13, fontWeight: "700", color: colors.muted }}>Quitar</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // Estado: botón + posibles mensajes de fallback
  return (
    <View style={{ marginBottom: 12 }}>
      <Pressable
        onPress={onTocarUsarUbicacion}
        disabled={estado === "capturando"}
        accessibilityRole="button"
        accessibilityLabel="Usar mi ubicación actual"
        accessibilityState={{ disabled: estado === "capturando" }}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          paddingVertical: 13,
          borderRadius: 14,
          backgroundColor: colors.green,
          opacity: estado === "capturando" ? 0.75 : 1,
          ...shadows.greenBtn,
        }}
      >
        {estado === "capturando" ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Feather name="map-pin" size={16} color="#fff" />
        )}
        <Text style={{ fontSize: 14, fontWeight: "800", color: "#fff" }}>
          {estado === "capturando" ? "Obteniendo ubicación..." : "Usar mi ubicación actual"}
        </Text>
      </Pressable>

      {estado !== "capturando" ? (
        <Pressable
          onPress={abrirMapa}
          hitSlop={14}
          accessibilityRole="button"
          accessibilityLabel="Ubicar mi dirección en el mapa"
          style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 8 }}
        >
          <Feather name="map" size={13} color="#6D7B6C" />
          <Text style={{ fontSize: 12, fontWeight: "600", color: "#6D7B6C" }}>o ubícalo en el mapa</Text>
        </Pressable>
      ) : null}

      <PermisoUbicacion
        visible={mostrarPriming}
        onUsarUbicacion={() => {
          setMostrarPriming(false);
          capturar();
        }}
        onPonerAMano={() => {
          setMostrarPriming(false);
          tracker.track("ubicacion_pin_manual_elegido", undefined, "carrito");
          abrirMapa();
        }}
        onCerrar={() => setMostrarPriming(false)}
      />

      {error ? (
        <View style={{ marginTop: 6 }}>
          <Text style={{ fontSize: 12, color: "#6D7B6C" }}>{error}</Text>
          {abrirAjustes ? (
            <Pressable
              onPress={() => Linking.openSettings()}
              hitSlop={14}
              accessibilityRole="button"
              accessibilityLabel="Abrir los ajustes del teléfono para dar permiso de ubicación"
              style={{ marginTop: 4 }}
            >
              <Text style={{ fontSize: 12, fontWeight: "700", color: "#1FAF55" }}>Abrir Ajustes</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
