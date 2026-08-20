// Pantalla completa de "¿por dónde viene?".
//
// La tarjeta del detalle es un vistazo; esto es para la pregunta que de verdad
// se hace el cliente: qué tan lejos está de mi casa. Por eso aquí el mapa encuadra
// SIEMPRE los dos puntos —la moto y la dirección— en vez de centrarse en la moto:
// centrado en la moto se ve muy detallado y no se sabe si falta una cuadra o
// media ciudad.
//
// Las reglas de qué se puede mostrar siguen viviendo en el servidor. Esta
// pantalla, como la tarjeta, solo pinta lo que le den.

import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, ActivityIndicator, AppState, Platform, InteractionManager } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import MapView, { PROVIDER_GOOGLE, Marker } from "react-native-maps";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getUbicacionDomiciliario, type UbicacionDomiciliario } from "../../src/lib/api";
import { distanciaMetros, textoDistancia, rumboSiSeMovio, rotacionMoto } from "../../src/lib/distancia";
import { tracker } from "../../src/lib/tracker";
import { fuentes } from "../../src/constants/theme";

const INTERVALO_MS = 12_000;
const PANTALLA = "seguimiento";

export default function SeguimientoScreen() {
  const { pedidoId } = useLocalSearchParams<{ pedidoId: string }>();
  const id = Number(pedidoId);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [ubi, setUbi] = useState<UbicacionDomiciliario | null>(null);
  const [mapaMontado, setMapaMontado] = useState(false);
  const [mapaListo, setMapaListo] = useState(false);
  const [iconoListo, setIconoListo] = useState(false);
  const mapRef = useRef<MapView>(null);
  const vivo = useRef(true);
  // Rumbo con el que se dibuja la moto. Se guarda tambien el punto con el que se
  // calculo, para no recalcularlo con lecturas casi iguales.
  const [rumbo, setRumbo] = useState<number | null>(null);
  const puntoRumbo = useRef<{ lat: number; lng: number } | null>(null);
  const rumboRef = useRef<number | null>(null);
  // Un marcador con contenido propio no se repinta si el mapa no lo esta
  // vigilando: al girar hay que prender la vigilancia un instante y apagarla.
  const [redibujando, setRedibujando] = useState(false);
  const encuadrado = useRef(false);

  useEffect(() => {
    const t = InteractionManager.runAfterInteractions(() => setMapaMontado(true));
    return () => t.cancel();
  }, []);

  // Misma red de seguridad que la tarjeta: si `onMapReady` no dispara, el
  // indicador se quita igual y el mapa se ve.
  useEffect(() => {
    if (!mapaMontado || mapaListo) return undefined;
    const t = setTimeout(() => setMapaListo(true), 2000);
    return () => clearTimeout(t);
  }, [mapaMontado, mapaListo]);

  useEffect(() => {
    vivo.current = true;
    tracker.track("pantalla_vista", undefined, PANTALLA);

    const consultar = async () => {
      if (AppState.currentState !== "active") return;
      try {
        const r = await getUbicacionDomiciliario(id);
        if (!vivo.current) return;
        setUbi(r);
        if (r.disponible && r.lat != null && r.lng != null) {
          const actual = { lat: r.lat, lng: r.lng };
          const nuevo = rumboSiSeMovio(puntoRumbo.current, actual, rumboRef.current, r.destino ?? null);
          if (nuevo != null && nuevo !== rumboRef.current) {
            rumboRef.current = nuevo;
            setRumbo(nuevo);
          }
          // Se guarda SIEMPRE el ultimo punto: el umbral de movimiento se mide
          // contra la lectura anterior, no contra el ultimo giro.
          puntoRumbo.current = actual;
        }
        if (r.disponible && r.lat != null && r.lng != null && mapRef.current) {
          const puntos = [{ latitude: r.lat, longitude: r.lng }];
          if (r.destino) puntos.push({ latitude: r.destino.lat, longitude: r.destino.lng });
          if (!encuadrado.current && puntos.length === 2) {
            // El primer encuadre se hace una sola vez, con margen para que los
            // dos marcadores no queden pegados al borde.
            encuadrado.current = true;
            mapRef.current.fitToCoordinates(puntos, {
              edgePadding: { top: 90, right: 70, bottom: 190, left: 70 },
              animated: false,
            });
          } else {
            // Despues solo se sigue la moto, sin re-encuadrar: un mapa que se
            // reajusta solo cada doce segundos marea y hace perder la referencia.
            mapRef.current.animateCamera({ center: { latitude: r.lat, longitude: r.lng } }, { duration: 900 });
          }
        }
      } catch {
        // Se conserva el ultimo punto conocido.
      }
    };

    consultar();
    const timer = setInterval(consultar, INTERVALO_MS);
    return () => {
      vivo.current = false;
      clearInterval(timer);
    };
  }, [id]);

  useEffect(() => {
    if (rumbo == null) return undefined;
    setRedibujando(true);
    const t = setTimeout(() => setRedibujando(false), 800);
    return () => clearTimeout(t);
  }, [rumbo]);

  const metros =
    ubi?.disponible && ubi.lat != null && ubi.destino
      ? distanciaMetros({ lat: ubi.lat, lng: ubi.lng! }, ubi.destino)
      : null;

  return (
    <View style={{ flex: 1, backgroundColor: "#EEF2EE" }}>
      <Stack.Screen options={{ headerShown: false }} />

      {mapaMontado && (
        <MapView
          ref={mapRef}
          // Android usa Google Maps (llave en app.json, plugin react-native-maps);
          // iOS usa Apple Maps, que no pide llave. Ver MapaDomiciliario.
          provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
          style={{ flex: 1 }}
          initialRegion={{
            latitude: ubi?.lat ?? 1.6172,
            longitude: ubi?.lng ?? -75.6122,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
          }}
          onMapReady={() => setMapaListo(true)}
        >
          {ubi?.disponible && ubi.lat != null && (
            <Marker
              coordinate={{ latitude: ubi.lat, longitude: ubi.lng! }}
              // Vista cenital: el punto del mapa es el CENTRO de la moto.
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={!iconoListo || redibujando}
              title="Tu repartidor"
            >
              <Image
                source={require("../../assets/repartidor-moto.webp")}
                style={{
                  // Cuadrado: el asset trae margen para que la rotacion no recorte.
                  width: 58,
                  height: 58,
                  // La moto mira hacia donde VA. Se rota la IMAGEN y no con la
                  // propiedad `rotation` del Marker: en iOS esa propiedad no
                  // aplica cuando el marcador tiene contenido propio — se probo
                  // y la moto quedaba siempre igual.
                  transform: [{ rotate: `${rumbo != null ? rotacionMoto(rumbo) : 0}deg` }],
                }}
                contentFit="contain"
                onLoadEnd={() => setIconoListo(true)}
              />
            </Marker>
          )}
          {ubi?.destino && (
            <Marker coordinate={{ latitude: ubi.destino.lat, longitude: ubi.destino.lng }} title="Tu dirección">
              <View style={{ backgroundColor: "#D33587", padding: 8, borderRadius: 999, borderWidth: 2, borderColor: "#fff" }}>
                <Feather name="home" size={15} color="#fff" />
              </View>
            </Marker>
          )}
        </MapView>
      )}

      {(!mapaMontado || !mapaListo) && (
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", backgroundColor: "#EEF2EE" }}>
          <ActivityIndicator size="large" color="#1FAF55" />
        </View>
      )}

      {/* Volver: flotante sobre el mapa, no una barra que le come pantalla. */}
      <Pressable
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Volver al pedido"
        style={{
          position: "absolute", top: insets.top + 10, left: 16,
          width: 42, height: 42, borderRadius: 21, backgroundColor: "#fff",
          alignItems: "center", justifyContent: "center",
          shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 4,
        }}
      >
        <Feather name="arrow-left" size={20} color="#1A1C1A" />
      </Pressable>

      {/* Panel inferior: la respuesta a "¿qué tan lejos está?" en una línea. */}
      <View
        style={{
          position: "absolute", left: 16, right: 16, bottom: insets.bottom + 16,
          backgroundColor: "#fff", borderRadius: 18, padding: 18,
          shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 6,
        }}
      >
        {ubi?.disponible ? (
          <>
            <Text style={{ fontSize: 19, fontFamily: fuentes.destacado, color: "#1A1C1A" }}>
              {metros != null ? textoDistancia(metros) : "En camino"}
            </Text>
            <Text style={{ fontSize: 13, color: "#6D7B6C", marginTop: 4 }}>
              {(ubi.actualizado_hace_seg ?? 0) < 60
                ? "Ubicación de hace un momento"
                : `Ubicación de hace ${Math.round((ubi.actualizado_hace_seg ?? 0) / 60)} min`}
            </Text>
            {/* En la pantalla completa el aviso importa MÁS que en la tarjeta:
                aquí la distancia se lee como "ya casi llega", y sin esto un
                repartidor que se aleja a dejar otro pedido parece un error. */}
            {ubi.aviso ? (
              <Text style={{ fontSize: 13, color: "#8A6400", marginTop: 10, lineHeight: 18 }}>
                {ubi.aviso}
              </Text>
            ) : null}
          </>
        ) : (
          <>
            <Text style={{ fontSize: 17, fontFamily: fuentes.destacado, color: "#1A1C1A" }}>Sin señal por ahora</Text>
            <Text style={{ fontSize: 13, color: "#6D7B6C", marginTop: 4 }}>
              Tu repartidor no está reportando su ubicación en este momento. Sigue en camino.
            </Text>
          </>
        )}
      </View>
    </View>
  );
}
