import { useEffect, useRef, useState, useCallback } from "react";
import { View, Text, Pressable, ActivityIndicator, InteractionManager, Platform, Linking } from "react-native";
import { Stack, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MapView, { PROVIDER_GOOGLE, type Region } from "react-native-maps";
import * as Location from "expo-location";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { colors } from "../src/constants/theme";
import { getCoberturaZona, evaluarZonasCliente, type UbicacionCapturada } from "../src/lib/api";
import { useUbicacionPicker } from "../src/stores/ubicacionPicker";
import { WHATSAPP_SOPORTE } from "../src/constants/config";
import { tracker } from "../src/lib/tracker";

// Centro de Florencia (fallback si no hay GPS ni pin inicial).
const FLORENCIA = { latitude: 1.6144, longitude: -75.6062 };
const DELTA = { latitudeDelta: 0.02, longitudeDelta: 0.02 };

async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const arr = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    const r = arr?.[0];
    if (!r) return null;
    const calle = [r.street, r.name].find((x) => !!x) || undefined;
    const zona = [r.district, r.subregion, r.city].find((x) => !!x) || undefined;
    return [calle, zona].filter(Boolean).join(", ") || null;
  } catch {
    return null;
  }
}

export default function UbicacionScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const inicial = useUbicacionPicker((s) => s.inicial);
  const confirmar = useUbicacionPicker((s) => s.confirmar);
  const reset = useUbicacionPicker((s) => s.reset);

  const mapRef = useRef<MapView>(null);
  const centroRef = useRef({
    latitude: inicial?.lat ?? FLORENCIA.latitude,
    longitude: inicial?.lng ?? FLORENCIA.longitude,
  });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [geocoded, setGeocoded] = useState<string | null>(null);
  const [dentroZona, setDentroZona] = useState(true); // optimista hasta validar
  // Android: montar el MapView DESPUÉS de la animación de transición evita que
  // react-native-maps se renderice en blanco/gris (race conocido). El spinner se
  // muestra hasta que el mapa dispara onMapReady.
  const [mapaMontado, setMapaMontado] = useState(false);
  const [mapaListo, setMapaListo] = useState(false);
  const [avisoPermiso, setAvisoPermiso] = useState<string | null>(null);
  const [region] = useState<Region>({
    latitude: inicial?.lat ?? FLORENCIA.latitude,
    longitude: inicial?.lng ?? FLORENCIA.longitude,
    ...DELTA,
  });

  // Polígono de la zona para validación instantánea (el servidor revalida al guardar).
  const { data: zona } = useQuery({
    queryKey: ["cobertura-zona"],
    queryFn: getCoberturaZona,
    staleTime: Infinity,
  });

  // Cada bloqueo dice dónde falta cobertura, pero solo se registra una vez por
  // coordenada redondeada: arrastrar el mapa dentro de una zona excluida no debe
  // llenar la cola de eventos repetidos.
  const fueraReportadoRef = useRef<Set<string>>(new Set());
  const pinMovidoRef = useRef(false);

  const validar = useCallback(
    (lat: number, lng: number) => {
      // Evalúa contra TODAS las zonas, exclusiones incluidas, con el mismo orden de
      // reglas del servidor. El servidor revalida al guardar y sigue mandando.
      const dentro = evaluarZonasCliente(lat, lng, zona);
      setDentroZona(dentro);
      if (!dentro) {
        const clave = `${lat.toFixed(3)},${lng.toFixed(3)}`;
        if (!fueraReportadoRef.current.has(clave)) {
          fueraReportadoRef.current.add(clave);
          // El tracker redondea lat/lng a 3 decimales antes de enviarlas.
          tracker.track('fuera_de_zona', { lat, lng }, 'ubicacion');
        }
      }
    },
    [zona],
  );

  // Montar el mapa solo cuando la transición de navegación termina (evita el
  // render en blanco de react-native-maps en Android).
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => setMapaMontado(true));
    return () => task.cancel();
  }, []);

  // Al abrir: si hay permiso ya concedido y no vino un pin inicial, centrar en GPS.
  useEffect(() => {
    let cancelado = false;
    (async () => {
      if (inicial) {
        validar(inicial.lat, inicial.lng);
        reverseGeocode(inicial.lat, inicial.lng).then((g) => !cancelado && setGeocoded(g));
        return;
      }
      const perm = await Location.getForegroundPermissionsAsync().catch(() => null);
      if (perm?.granted) {
        const pos = await Location.getLastKnownPositionAsync({ maxAge: 300000 }).catch(() => null);
        if (pos && !cancelado) {
          const { latitude, longitude } = pos.coords;
          centroRef.current = { latitude, longitude };
          mapRef.current?.animateToRegion({ latitude, longitude, ...DELTA }, 350);
        }
      }
      const c = centroRef.current;
      validar(c.latitude, c.longitude);
      reverseGeocode(c.latitude, c.longitude).then((g) => !cancelado && setGeocoded(g));
    })();
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al montar
  }, []);

  // Al soltar el mapa: el centro es el nuevo punto. Debounce del reverse geocode.
  const onRegionChangeComplete = (r: Region) => {
    centroRef.current = { latitude: r.latitude, longitude: r.longitude };
    // Una sola vez por visita: la pregunta es "¿usan el mapa o se rinden?", no
    // cuántas veces lo arrastraron. Medir el gesto continuo no responde nada.
    if (!pinMovidoRef.current) {
      pinMovidoRef.current = true;
      tracker.track('ubicacion_pin_movido', undefined, 'ubicacion');
    }
    validar(r.latitude, r.longitude);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      reverseGeocode(r.latitude, r.longitude).then(setGeocoded);
    }, 600);
  };

  const recentrar = async () => {
    // El diálogo nativo de permisos solo se puede mostrar UNA vez: medir aquí es lo
    // que después permite decidir si `exigir_ubicacion` (bloque F) es viable.
    tracker.track('ubicacion_permiso_pedido', undefined, 'ubicacion');
    const perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) {
      tracker.track('ubicacion_permiso_negado', undefined, 'ubicacion');
      // Antes esto era un `return` a secas: se tocaba el botón, no pasaba
      // absolutamente nada, y la persona no tenía forma de saber por qué. El mapa
      // sigue funcionando sin permiso — solo hay que decirlo.
      setAvisoPermiso(
        perm.canAskAgain === false
          ? "Sin acceso a tu ubicación. Mueve el mapa hasta tu casa, o actívalo en Ajustes."
          : "Sin acceso a tu ubicación. Mueve el mapa hasta tu casa.",
      );
      return;
    }
    tracker.track('ubicacion_permiso_concedido', undefined, 'ubicacion');
    setAvisoPermiso(null);
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).catch(() => null);
    if (pos) {
      mapRef.current?.animateToRegion({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, ...DELTA }, 350);
    } else {
      setAvisoPermiso("No pudimos ubicarte. Mueve el mapa hasta tu casa.");
    }
  };

  const onConfirmar = () => {
    if (!dentroZona) return;
    tracker.track('ubicacion_pin_confirmado', { dentro_zona: true }, 'ubicacion');
    const c = centroRef.current;
    const u: UbicacionCapturada = {
      lat: c.latitude,
      lng: c.longitude,
      precision_m: null, // pin manual: no aplica precisión GPS
      metodo_ubicacion: "pin_mapa",
      geocoded_direccion: geocoded,
    };
    confirmar(u);
    router.back();
  };

  const onCancelar = () => {
    reset();
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", paddingTop: insets.top + 8, paddingBottom: 12, paddingHorizontal: 12, backgroundColor: colors.bg, borderBottomWidth: 1, borderBottomColor: colors.line }}>
        <Pressable onPress={onCancelar} hitSlop={10} style={{ padding: 6 }} accessibilityRole="button" accessibilityLabel="Volver">
          <Feather name="arrow-left" size={22} color="#1A1C1A" />
        </Pressable>
        <Text style={{ flex: 1, fontSize: 16, fontWeight: "800", color: "#1A1C1A", textAlign: "center", marginRight: 34 }}>
          Ubica tu punto de entrega
        </Text>
      </View>

      {/* Mapa con pin fijo al centro */}
      <View style={{ flex: 1 }}>
        {mapaMontado ? (
          <MapView
            ref={mapRef}
            provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
            style={{ flex: 1 }}
            initialRegion={region}
            onMapReady={() => {
              setMapaListo(true);
              const c = centroRef.current;
              mapRef.current?.animateToRegion(
                { latitude: c.latitude, longitude: c.longitude, ...DELTA },
                0,
              );
            }}
            onRegionChangeComplete={onRegionChangeComplete}
            showsUserLocation
            showsMyLocationButton={false}
          />
        ) : null}

        {/* Overlay de carga: cubre el mapa hasta que dispara onMapReady (evita el vacío gris) */}
        {!mapaListo ? (
          <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}>
            <ActivityIndicator size="large" color="#1FAF55" />
            <Text style={{ marginTop: 10, color: "#6D7B6C", fontSize: 13 }}>Cargando mapa…</Text>
          </View>
        ) : null}

        {/* Pin fijo centrado (la punta apunta al centro exacto del mapa) */}
        <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
          <View style={{ transform: [{ translateY: -18 }] }}>
            <Feather name="map-pin" size={36} color="#1FAF55" />
          </View>
        </View>

        {/* Botón recentrar */}
        <Pressable
          onPress={recentrar}
          accessibilityRole="button"
          accessibilityLabel="Centrar en mi ubicación"
          style={{ position: "absolute", right: 16, bottom: 16, width: 44, height: 44, borderRadius: 22, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 3 }}
        >
          <Feather name="crosshair" size={20} color="#1FAF55" />
        </Pressable>
      </View>

      {/* Panel inferior: texto + validación + confirmar */}
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: insets.bottom + 12, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#EFEFEB" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, minHeight: 20 }}>
          <Feather name="map-pin" size={13} color="#6D7B6C" />
          <Text style={{ flex: 1, fontSize: 13, color: "#6D7B6C" }} numberOfLines={1}>
            {geocoded ? `${geocoded} (aprox.)` : "Mueve el mapa para ubicar el punto"}
          </Text>
        </View>

        {!dentroZona ? (
          // accessibilityLiveRegion: el mensaje aparece al mover el mapa, sin que
          // el foco cambie. Sin esto el lector de pantalla no lo anuncia nunca y
          // la persona solo descubre el problema cuando el botón no responde.
          <View
            accessibilityLiveRegion="polite"
            style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8, backgroundColor: "rgba(239,68,68,0.08)", borderRadius: 8, padding: 10 }}
          >
            <Feather name="alert-triangle" size={16} color="#DC2626" />
            {/* Lenguaje llano: "fuera de la zona de reparto" es jerga de logística.
                Lo que el cliente necesita saber es que hoy no le llegamos ahí. */}
            <Text style={{ flex: 1, fontSize: 14, lineHeight: 19, color: "#DC2626", fontWeight: "600" }}>
              Por ahora no llegamos hasta aquí
            </Text>
          </View>
        ) : null}

        {avisoPermiso ? (
          <View accessibilityLiveRegion="polite" style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8, backgroundColor: colors.lowfill, borderRadius: 8, padding: 10 }}>
            <Feather name="info" size={16} color="#6D7B6C" />
            <Text style={{ flex: 1, fontSize: 14, lineHeight: 19, color: "#6D7B6C" }}>{avisoPermiso}</Text>
          </View>
        ) : null}

        {/* Cada bloqueo es una pista de dónde abrir cobertura (ya se registra el
            evento `fuera_de_zona` con la coordenada redondeada). El botón de
            WhatsApp convierte ese callejón sin salida en una conversación: sin
            él, la persona solo ve que el botón no funciona y se va. */}
        {!dentroZona ? (
          <Pressable
            onPress={() => Linking.openURL(WHATSAPP_SOPORTE).catch(() => {})}
            accessibilityRole="button"
            accessibilityLabel="Escribirnos por WhatsApp para preguntar por esta zona"
            style={{ minHeight: 44, marginTop: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: 12, backgroundColor: colors.lowfill }}
          >
            <Feather name="message-circle" size={16} color={colors.greenInk} />
            <Text style={{ fontSize: 14, fontWeight: "700", color: colors.greenInk }}>
              Escríbenos y te avisamos cuando lleguemos
            </Text>
          </Pressable>
        ) : null}

        <Pressable
          onPress={onConfirmar}
          disabled={!dentroZona}
          accessibilityRole="button"
          accessibilityLabel="Confirmar este punto de entrega"
          // Sin el estado, el lector anuncia como activo un boton que no responde
          // y la persona se queda sin entender por que no pasa nada.
          accessibilityState={{ disabled: !dentroZona }}
          accessibilityHint={!dentroZona ? "Por ahora no llegamos hasta aqui. Mueve el mapa a otro punto." : undefined}
          style={{ minHeight: 48, marginTop: 12, paddingVertical: 14, borderRadius: 12, backgroundColor: dentroZona ? "#1FAF55" : "#D1D5DB", alignItems: "center", justifyContent: "center" }}
        >
          <Text style={{ fontSize: 15, fontWeight: "700", color: "#fff" }}>Confirmar este punto</Text>
        </Pressable>

        <Pressable
          onPress={onCancelar}
          accessibilityRole="button"
          accessibilityLabel="Escribir la direccion manualmente en vez de usar el mapa"
          style={{ minHeight: 44, marginTop: 8, paddingVertical: 10, alignItems: "center", justifyContent: "center" }}
        >
          <Text style={{ fontSize: 13, fontWeight: "600", color: "#6D7B6C" }}>Escribir dirección manualmente</Text>
        </Pressable>
      </View>
    </View>
  );
}
