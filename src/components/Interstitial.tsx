import { useEffect, useCallback, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { useQuery } from "@tanstack/react-query";
import { getInterstitial, type Interstitial as InterstitialData } from "../lib/api";
import { tracker } from "../lib/tracker";

export function Interstitial({ onFinish }: { onFinish: () => void }) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data, isLoading, isError } = useQuery<InterstitialData | null>({
    queryKey: ["interstitial"],
    queryFn: getInterstitial,
    staleTime: 60_000,
    retry: false,
  });

  // Fail-fast: sin datos o error → saltar al home
  useEffect(() => {
    if (isLoading) return;
    if (isError || !data) onFinish();
  }, [isLoading, isError, data, onFinish]);

  // Limpiar timer al desmontar
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  // Timer arranca solo cuando la imagen ya es visible en pantalla
  const handleLoad = useCallback(() => {
    if (!data) return;
    tracker.track("interstitial_mostrado", { interstitial_id: data.id });
    timerRef.current = setTimeout(() => {
      tracker.track("interstitial_completado", { interstitial_id: data.id });
      onFinish();
    }, data.duracion_segundos * 1000);
  }, [data, onFinish]);

  if (isLoading || !data) return null;

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="auto" accessible accessibilityViewIsModal>
      <Image
        source={{ uri: data.imagen_url }}
        style={StyleSheet.absoluteFillObject}
        contentFit="cover"
        cachePolicy="memory-disk"
        onLoad={handleLoad}
        onError={() => onFinish()}
      />
    </View>
  );
}
