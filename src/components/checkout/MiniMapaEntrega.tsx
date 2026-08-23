// Mini-mapa de punto de entrega, arriba de la tarjeta de "Entrega" del
// checkout — extraído de UbicacionButton.tsx:212-237, con tres diferencias:
//
//   1. Montaje diferido con InteractionManager: ese mapa vive HOY sin esto
//      porque solo se monta después de capturar ubicación, nunca durante una
//      transición. Este se monta AL ENTRAR a la tab, que es exactamente el
//      caso que MapaDomiciliario.tsx y app/ubicacion.tsx documentan como race
//      del render en blanco de Android.
//   2. `liteMode` (Android) + `cacheEnabled` (iOS): el mapa es decorativo y no
//      interactivo, así que se sirve como bitmap — esquiva el race de raíz y
//      el costo de un MapView vivo en una tab que queda montada.
//   3. Pin como View absoluta, no <Marker>: con liteMode/cacheEnabled los
//      marcadores nativos son poco fiables; como el `region` está centrado
//      exactamente en el punto, el pin siempre cae en el centro geométrico.

import { useEffect, useState } from "react";
import { View, Text, Pressable, InteractionManager } from "react-native";
import MapView from "react-native-maps";
import { Feather } from "@expo/vector-icons";
import { colors, radii, fuentes } from "../../constants/theme";

interface Props {
  lat: number;
  lng: number;
  alto?: number;
  eta?: { min: number; max: number } | null;
  onPress?: () => void;
  a11yLabel: string;
}

export function MiniMapaEntrega({ lat, lng, alto = 110, eta, onPress, a11yLabel }: Props) {
  const [montado, setMontado] = useState(false);

  useEffect(() => {
    const tarea = InteractionManager.runAfterInteractions(() => setMontado(true));
    return () => tarea.cancel();
  }, []);

  // Placeholder del MISMO alto exacto para que no haya salto cuando el mapa
  // aparece; sin spinner, porque se resuelve en uno o dos frames.
  if (!montado) {
    return <View style={{ height: alto, borderTopLeftRadius: radii.card, borderTopRightRadius: radii.card, backgroundColor: colors.lowfill }} />;
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={a11yLabel}
      style={{ height: alto, borderTopLeftRadius: radii.card, borderTopRightRadius: radii.card, overflow: "hidden" }}
    >
      <MapView
        style={{ flex: 1 }}
        pointerEvents="none"
        liteMode
        cacheEnabled
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        region={{ latitude: lat, longitude: lng, latitudeDelta: 0.004, longitudeDelta: 0.004 }}
      />
      {/* Pin centrado — el region ya está centrado en el punto exacto. */}
      <View style={{ position: "absolute", top: "50%", left: "50%", marginTop: -18, marginLeft: -9 }} pointerEvents="none">
        <Feather name="map-pin" size={22} color={colors.green} />
      </View>
      {eta ? (
        <View
          style={{
            position: "absolute",
            bottom: 10,
            left: 10,
            backgroundColor: "rgba(255,255,255,0.94)",
            borderRadius: 999,
            paddingHorizontal: 10,
            paddingVertical: 5,
            flexDirection: "row",
            alignItems: "center",
            gap: 5,
          }}
        >
          <Feather name="clock" size={12} color={colors.greenInk} />
          <Text style={{ fontSize: 12, fontFamily: fuentes.destacado, color: colors.greenInk }}>
            Llega en {eta.min}–{eta.max} min
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}
