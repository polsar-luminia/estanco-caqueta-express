import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { useQuery } from "@tanstack/react-query";
import { getInterstitial, type Interstitial as InterstitialData } from "../lib/api";
import { tracker } from "../lib/tracker";

export function Interstitial({ onFinish }: { onFinish: () => void }) {
  const { data, isLoading, isError } = useQuery<InterstitialData | null>({
    queryKey: ["interstitial"],
    queryFn: getInterstitial,
    staleTime: 60_000,
    retry: false,
  });

  useEffect(() => {
    if (isLoading) return;
    if (isError || !data) {
      onFinish();
      return;
    }
    tracker.track("interstitial_mostrado", { interstitial_id: data.id });
    const t = setTimeout(() => {
      tracker.track("interstitial_completado", { interstitial_id: data.id });
      onFinish();
    }, data.duracion_segundos * 1000);
    return () => clearTimeout(t);
  }, [isLoading, isError, data, onFinish]);

  if (isLoading || !data) return null;

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="auto" accessible accessibilityViewIsModal>
      <Image
        source={{ uri: data.imagen_url }}
        style={StyleSheet.absoluteFillObject}
        contentFit="cover"
        cachePolicy="memory-disk"
      />
    </View>
  );
}
