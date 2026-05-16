import { useEffect, useCallback, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { useQuery } from "@tanstack/react-query";
import { getInterstitial, type Interstitial as InterstitialData } from "../lib/api";
import { tracker } from "../lib/tracker";
import { SplashBranded } from "./SplashBranded";

const IMAGEN_TIMEOUT_MS = 7_000;

export function Interstitial({ onFinish }: { onFinish: () => void }) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const imageTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);

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

  // Timeout de carga: si la imagen no cargó en 7s → saltar al home
  useEffect(() => {
    if (!data) return;
    imageTimeoutRef.current = setTimeout(onFinish, IMAGEN_TIMEOUT_MS);
    return () => {
      if (imageTimeoutRef.current !== null) clearTimeout(imageTimeoutRef.current);
    };
  }, [data, onFinish]);

  // Limpiar timer de duración al desmontar
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  // Timer de duración arranca solo cuando la imagen ya es visible en pantalla
  const handleLoad = useCallback(() => {
    if (!data) return;
    if (imageTimeoutRef.current !== null) {
      clearTimeout(imageTimeoutRef.current);
      imageTimeoutRef.current = null;
    }
    setImageLoaded(true);
    tracker.track("interstitial_mostrado", { interstitial_id: data.id });
    timerRef.current = setTimeout(() => {
      tracker.track("interstitial_completado", { interstitial_id: data.id });
      onFinish();
    }, data.duracion_segundos * 1000);
  }, [data, onFinish]);

  // Mientras la query carga, cubrir el home para evitar el flash.
  // CRÍTICO: absoluteFillObject — sin esto SplashBranded (flex:1) se vuelve
  // hermano flex del <Stack> en _layout y reparten la pantalla 50/50
  // (home/skeletons arriba, splash abajo). Debe ser overlay absoluto.
  if (isLoading) {
    return (
      <View style={StyleSheet.absoluteFillObject}>
        <SplashBranded />
      </View>
    );
  }
  // Sin datos o error → fail-fast effect ya llamó onFinish
  if (!data) return null;

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
      {!imageLoaded && (
        <View style={StyleSheet.absoluteFillObject}>
          <SplashBranded />
        </View>
      )}
    </View>
  );
}
