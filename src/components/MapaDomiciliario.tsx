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
import { View, Text, AppState } from "react-native";
import MapView, { PROVIDER_GOOGLE, Marker } from "react-native-maps";
import { Feather } from "@expo/vector-icons";
import { getUbicacionDomiciliario, type UbicacionDomiciliario } from "../lib/api";

const INTERVALO_MS = 15_000;

/** Copia por motivo. Un mapa vacío sin explicación se lee como que la app falló. */
const MENSAJE: Record<string, string> = {
  sin_senal: "Tu repartidor está sin señal en este momento. Vuelve a mirar en un minuto.",
  sin_domiciliario: "Todavía no sabemos quién lleva tu pedido.",
  aun_no_sale: "Cuando salga a entregarse vas a poder ver por dónde viene.",
};

export function MapaDomiciliario({ pedidoId }: { pedidoId: number }) {
  const [ubi, setUbi] = useState<UbicacionDomiciliario | null>(null);
  const mapRef = useRef<MapView>(null);
  const vivo = useRef(true);

  useEffect(() => {
    vivo.current = true;
    let timer: ReturnType<typeof setInterval> | null = null;

    const consultar = async () => {
      // Con la app en segundo plano no se pregunta: nadie está viendo el mapa.
      if (AppState.currentState !== "active") return;
      try {
        const r = await getUbicacionDomiciliario(pedidoId);
        if (vivo.current) setUbi(r);
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

  const region = {
    latitude: ubi.lat!,
    longitude: ubi.lng!,
    latitudeDelta: 0.012,
    longitudeDelta: 0.012,
  };

  return (
    <View className="bg-white rounded-2xl overflow-hidden">
      <View style={{ padding: 16, paddingBottom: 10, flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Feather name="navigation" size={16} color="#1FAF55" />
        <Text style={{ fontSize: 15, fontWeight: "800", color: "#1A1C1A", flex: 1 }}>Por dónde viene</Text>
        <Text style={{ fontSize: 11.5, color: "#6D7B6C" }}>
          {(ubi.actualizado_hace_seg ?? 0) < 60
            ? "hace un momento"
            : `hace ${Math.round((ubi.actualizado_hace_seg ?? 0) / 60)} min`}
        </Text>
      </View>

      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={{ height: 200, width: "100%" }}
        region={region}
        // El mapa es para MIRAR: sin gestos no se desplaza sin querer al hacer
        // scroll por el detalle del pedido.
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        pointerEvents="none"
      >
        <Marker coordinate={{ latitude: ubi.lat!, longitude: ubi.lng! }} title="Tu repartidor">
          <View style={{ backgroundColor: "#1FAF55", padding: 7, borderRadius: 999, borderWidth: 2, borderColor: "#fff" }}>
            <Feather name="truck" size={14} color="#fff" />
          </View>
        </Marker>
        {ubi.destino && (
          <Marker coordinate={{ latitude: ubi.destino.lat, longitude: ubi.destino.lng }} title="Tu dirección">
            <View style={{ backgroundColor: "#D33587", padding: 7, borderRadius: 999, borderWidth: 2, borderColor: "#fff" }}>
              <Feather name="home" size={14} color="#fff" />
            </View>
          </Marker>
        )}
      </MapView>
    </View>
  );
}
