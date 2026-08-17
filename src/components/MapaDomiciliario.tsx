// "¿Por dónde viene mi pedido?" — mapa con la última posición del repartidor.
//
// QUÉ DECIDE EL SERVIDOR Y QUÉ DECIDE ESTA PANTALLA: aquí no hay ninguna regla
// de privacidad. El servidor responde `disponible: false` con un motivo cuando
// no corresponde mostrar nada (pedido que aún no sale, ya entregado, bandera
// apagada, señal vieja). Esta pantalla solo pinta lo que le den. Si la regla
// viviera también acá, tendríamos dos copias — y este proyecto ya lleva cuatro
// bugs por exactamente eso.
//
// Se sondea solo con la pantalla ABIERTA y la app en primer plano: seguir
// pidiendo la posición con el teléfono en el bolsillo gasta batería y datos de
// gente que los tiene contados, y nadie está mirando.

import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, AppState, ActivityIndicator, InteractionManager, Platform } from "react-native";
import MapView, { PROVIDER_GOOGLE, Marker } from "react-native-maps";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { getUbicacionDomiciliario, type UbicacionDomiciliario } from "../lib/api";
import { rumboSiSeMovio, rotacionMoto } from "../lib/distancia";

const INTERVALO_MS = 15_000;

/** Copia por motivo. Un mapa vacío sin explicación se lee como que la app falló. */
const MENSAJE: Record<string, string> = {
  sin_senal: "Tu repartidor está sin señal en este momento. Vuelve a mirar en un minuto.",
  sin_domiciliario: "Todavía no sabemos quién lleva tu pedido.",
  aun_no_sale: "Cuando salga a entregarse vas a poder ver por dónde viene.",
};

export function MapaDomiciliario({ pedidoId }: { pedidoId: number }) {
  const router = useRouter();
  const [ubi, setUbi] = useState<UbicacionDomiciliario | null>(null);
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
  // El MapView se monta DESPUES de la animacion de entrada y se pinta con
  // `initialRegion`, no con `region`. Las dos cosas son el mismo arreglo que ya
  // vive en app/ubicacion.tsx: montarlo durante la transicion lo deja en blanco
  // (race conocido de react-native-maps) — y asi salio en la primera prueba.
  const [mapaMontado, setMapaMontado] = useState(false);
  const [mapaListo, setMapaListo] = useState(false);
  // Un marcador con contenido propio en iOS puede quedar en blanco si el mapa
  // deja de vigilar la vista antes de que la imagen cargue. Se vigila hasta que
  // el icono termina de cargar y ahi se apaga: `tracksViewChanges` permanente
  // redibuja el marcador en cada frame y calienta el telefono.
  const [iconoListo, setIconoListo] = useState(false);
  const regionInicial = useRef<{ latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number } | null>(null);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => setMapaMontado(true));
    return () => task.cancel();
  }, []);

  // Red de seguridad: si `onMapReady` no dispara, el indicador se quita igual a
  // los 2 s. Gatear la visibilidad SOLO en ese evento fue lo que dejo el mapa
  // "cargando para siempre" en la segunda prueba — y un mapa tapado por un
  // spinner es indistinguible de uno roto.
  useEffect(() => {
    if (!mapaMontado || mapaListo) return undefined;
    const t = setTimeout(() => setMapaListo(true), 2000);
    return () => clearTimeout(t);
  }, [mapaMontado, mapaListo]);

  useEffect(() => {
    vivo.current = true;
    let timer: ReturnType<typeof setInterval> | null = null;

    const consultar = async () => {
      // Con la app en segundo plano no se pregunta: nadie está viendo el mapa.
      if (AppState.currentState !== "active") return;
      try {
        const r = await getUbicacionDomiciliario(pedidoId);
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
        // Deslizar la camara en vez de saltar: es lo que hace que se SIENTA que
        // se va acercando, en vez de parpadear de una posicion a otra.
        if (r.disponible && r.lat != null && r.lng != null && mapRef.current) {
          mapRef.current.animateCamera({ center: { latitude: r.lat, longitude: r.lng } }, { duration: 900 });
        }
      } catch {
        // Un fallo de red no borra el último punto conocido: mejor un punto de
        // hace unos segundos que un mapa que parpadea a vacío.
      }
    };

    consultar();
    timer = setInterval(consultar, INTERVALO_MS);
    return () => {
      vivo.current = false;
      if (timer) clearInterval(timer);
    };
  }, [pedidoId]);

  useEffect(() => {
    if (rumbo == null) return undefined;
    setRedibujando(true);
    const t = setTimeout(() => setRedibujando(false), 800);
    return () => clearTimeout(t);
  }, [rumbo]);

  // El servidor todavía no ha respondido: no se pinta nada, ni siquiera un
  // esqueleto — la tarjeta aparecería y desaparecería sola.
  if (!ubi) return null;

  if (!ubi.disponible) {
    const texto = MENSAJE[ubi.motivo ?? ""];
    if (!texto) return null; // 'apagado' u otro: la tarjeta no existe
    return (
      <View className="bg-white rounded-2xl p-5" style={{ gap: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Feather name="map-pin" size={16} color="#6D7B6C" />
          <Text style={{ fontSize: 15, fontWeight: "800", color: "#1A1C1A" }}>¿Por dónde viene?</Text>
        </View>
        <Text style={{ fontSize: 13, color: "#6D7B6C" }}>{texto}</Text>
      </View>
    );
  }

  if (!regionInicial.current) {
    regionInicial.current = {
      latitude: ubi.lat!,
      longitude: ubi.lng!,
      latitudeDelta: 0.012,
      longitudeDelta: 0.012,
    };
  }

  return (
    <Pressable
      onPress={() => router.push(`/seguimiento/${pedidoId}`)}
      accessibilityRole="button"
      accessibilityLabel="Ver el mapa completo del repartidor"
      className="bg-white rounded-2xl overflow-hidden"
    >
      <View style={{ padding: 16, paddingBottom: 10, flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Feather name="navigation" size={16} color="#1FAF55" />
        <Text style={{ fontSize: 15, fontWeight: "800", color: "#1A1C1A", flex: 1 }}>Por dónde viene</Text>
        <Feather name="maximize-2" size={13} color="#6D7B6C" style={{ marginRight: 6 }} />
        <Text style={{ fontSize: 11.5, color: "#6D7B6C" }}>
          {(ubi.actualizado_hace_seg ?? 0) < 60
            ? "hace un momento"
            : `hace ${Math.round((ubi.actualizado_hace_seg ?? 0) / 60)} min`}
        </Text>
      </View>

      <View style={{ height: 200, width: "100%" }}>
        {/* Tapa el mapa hasta que dispara onMapReady: sin esto se ve el vacio
            gris/blanco mientras carga, que es lo que salio en la primera prueba. */}
        {(!mapaMontado || !mapaListo) && (
          <View
            style={{
              position: "absolute",
              top: 0, left: 0, right: 0, bottom: 0,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#EEF2EE",
              zIndex: 2,
            }}
          >
            <ActivityIndicator color="#1FAF55" />
          </View>
        )}

        {mapaMontado && (
          <MapView
            ref={mapRef}
            // Android: Google Maps. La llave esta en app.json, en la config del
            // plugin `react-native-maps` (`androidGoogleMapsApiKey`).
            // iOS: Apple Maps (sin `provider`). NO hay `iosGoogleMapsApiKey`, y
            // pedir PROVIDER_GOOGLE sin llave no falla: pinta un mapa vacio que
            // nunca avisa que esta listo — fue lo que se vio el 17-ago.
            // Apple Maps es nativo, no pide llave y no factura.
            provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
            style={{ height: 200, width: "100%" }}
            initialRegion={regionInicial.current}
            onMapReady={() => setMapaListo(true)}
            // El mapa es para MIRAR: sin gestos no se desplaza sin querer al
            // hacer scroll por el detalle del pedido.
            scrollEnabled={false}
            zoomEnabled={false}
            rotateEnabled={false}
            pitchEnabled={false}
          >
            <Marker
              coordinate={{ latitude: ubi.lat!, longitude: ubi.lng! }}
              title="Tu repartidor"
              // El ancla en el centro-abajo: el punto del mapa es donde tocan las
              // llantas, no el centro de la imagen.
              // Vista cenital: el punto del mapa es el CENTRO de la moto.
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={!iconoListo || redibujando}
            >
              <Image
                source={require("../../assets/repartidor-moto.webp")}
                style={{
                  // Cuadrado: el asset trae margen para que la rotacion no recorte.
                  width: 46,
                  height: 46,
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
            {ubi.destino && (
              <Marker coordinate={{ latitude: ubi.destino.lat, longitude: ubi.destino.lng }} title="Tu dirección">
                <View style={{ backgroundColor: "#D33587", padding: 7, borderRadius: 999, borderWidth: 2, borderColor: "#fff" }}>
                  <Feather name="home" size={14} color="#fff" />
                </View>
              </Marker>
            )}
          </MapView>
        )}
      </View>
    </Pressable>
  );
}
