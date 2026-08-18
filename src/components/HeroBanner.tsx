// Hero banner de patrocinados. Extraido de app/(tabs)/index.tsx sin cambiarle el
// comportamiento: ahora lo dibuja el registro de secciones, que necesita poder
// montarlo desde una fila de secciones_inicio.

import { View, Text, Pressable, FlatList, Dimensions, type NativeSyntheticEvent, type NativeScrollEvent } from "react-native";
import { useRef, useState, useEffect } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { ShimmerImage } from "./ShimmerImage";
import type { Patrocinado } from "../lib/api";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Etiqueta y color por tipo de patrocinado.
//
// SIGUE VIVIENDO EN EL CLIENTE y eso es una limitacion conocida: un tipo nuevo
// creado en el backend no tiene entrada aqui. Lo que SI se arreglo es la mentira
// del respaldo: antes cualquier tipo desconocido se pintaba como "Descuento"
// gris, afirmandole al cliente algo que nadie dijo. Ahora se muestra el nombre
// del tipo tal cual viene, que a lo sumo se ve poco pulido pero no miente.
const TIPO_CFG: Record<string, { label: string; color: string }> = {
  banner:           { label: "Descuento",        color: "#6B7280" },
  oferta:           { label: "Oferta",           color: "#D33587" },
  oferta_relampago: { label: "Oferta Relámpago", color: "#DC2626" },
  promocion:        { label: "Promoción",        color: "#7C3AED" },
  imperdible:       { label: "Imperdible",       color: "#EA580C" },
  irresistible:     { label: "Irresistible",     color: "#DC2626" },
};

function cfgDe(tipo: string | undefined) {
  if (tipo && TIPO_CFG[tipo]) return TIPO_CFG[tipo];
  if (tipo) return { label: tipo.replace(/_/g, " "), color: "#6B7280" };
  return TIPO_CFG.banner;
}

// `aSangre`: el banner ocupa TODO el ancho, sin margenes ni esquinas
// redondeadas, pegado al header. Es como lo pide el diseno 1.3.0. Se deja como
// opcion y no como unica forma porque el carrusel de la version anterior sigue
// midiendo sus paginas con el ancho con margen, y cambiarlo a ciegas descuadra
// el snap entre diapositivas.
export function HeroSlide({ banner, onPress, aSangre = false }: { banner: Patrocinado | undefined; onPress: () => void; aSangre?: boolean }) {
  const cfg = cfgDe(banner?.tipo);
  const titulo = banner?.titulo ?? "Descuentos en\ndomicilio";
  const imgUrl = banner?.imagen_url;

  return (
    // Fondo de marca como fallback: si el banner no trae imagen, el hero se ve
    // intencional en verde en vez de depender de un CDN externo que puede romperse.
    <View style={{ width: aSangre ? SCREEN_WIDTH : SCREEN_WIDTH - 32, height: 220, borderRadius: aSangre ? 0 : 12, overflow: "hidden", backgroundColor: "#1FAF55" }}>
      {imgUrl ? (
        <ShimmerImage imageUrl={imgUrl} style={{ width: "100%", height: 220, position: "absolute" }} contentFit="cover" />
      ) : null}
      <LinearGradient
        colors={["rgba(0,0,0,0.52)", "rgba(0,0,0,0.10)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ position: "absolute", width: "100%", height: "100%" }}
      />
      <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: 20, gap: 6 }}>
        <View style={{ width: "58%", gap: 6 }}>
          <View style={{ alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, backgroundColor: cfg.color }}>
            <Text style={{ color: "#fff", fontSize: 12, fontWeight: "800", letterSpacing: 1.5, textTransform: "uppercase" }}>
              {cfg.label}
            </Text>
          </View>
          <Text style={{ color: "#fff", fontSize: 22, fontWeight: "800", lineHeight: 26 }}>{titulo}</Text>
          <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 12 }}>Domicilio en Florencia</Text>
          <Pressable
            style={{ alignSelf: "flex-start", marginTop: 4, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 12, backgroundColor: "#1FAF55" }}
            onPress={onPress}
            accessibilityRole="button"
            // El titulo del banner trae saltos de linea; en voz alta molestan.
            accessibilityLabel={`Pedir ahora: ${titulo.replace(/\n/g, " ")}`}
            hitSlop={6}
          >
            <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>Pedir ahora</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export function HeroCarousel({ banners, router }: { banners: Patrocinado[]; router: ReturnType<typeof useRouter> }) {
  const flatRef = useRef<FlatList>(null);
  const activeIndexRef = useRef(0);
  const [activeIndex, setActiveIndex] = useState(0);

  // Clon del primer banner al final para scroll infinito hacia la derecha
  const extended = banners.length > 1 ? [...banners, banners[0]] : banners;

  useEffect(() => {
    if (banners.length <= 1) return;
    const timer = setInterval(() => {
      const next = activeIndexRef.current + 1;
      if (next >= extended.length) {
        flatRef.current?.scrollToIndex({ index: 0, animated: false });
        activeIndexRef.current = 0;
        setActiveIndex(0);
        return;
      }
      flatRef.current?.scrollToIndex({ index: next, animated: true });
      activeIndexRef.current = next;
      setActiveIndex(next);
    }, 7000);
    return () => clearInterval(timer);
  }, [banners.length, extended.length]);

  const handleScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / (SCREEN_WIDTH - 32));
    if (idx >= banners.length) {
      flatRef.current?.scrollToIndex({ index: 0, animated: false });
      activeIndexRef.current = 0;
      setActiveIndex(0);
    } else {
      activeIndexRef.current = idx;
      setActiveIndex(idx);
    }
  };

  const dotIndex = activeIndex % banners.length;

  return (
    <View>
      <FlatList
        ref={flatRef}
        data={extended}
        horizontal
        pagingEnabled={false}
        snapToInterval={SCREEN_WIDTH - 32}
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        onMomentumScrollEnd={handleScrollEnd}
        onScrollToIndexFailed={() => {
          flatRef.current?.scrollToIndex({ index: 0, animated: false });
          activeIndexRef.current = 0;
          setActiveIndex(0);
        }}
        renderItem={({ item }) => (
          <HeroSlide
            banner={item}
            onPress={() => router.push(item.producto?.id ? `/product/${item.producto.id}` : "/ofertas")}
          />
        )}
      />
      {banners.length > 1 && (
        <View style={{ flexDirection: "row", justifyContent: "center", paddingTop: 8, gap: 6 }}>
          {banners.map((_, i) => (
            <View
              key={i}
              style={{
                width: dotIndex === i ? 20 : 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: dotIndex === i ? "#1FAF55" : "#D1D5DB",
              }}
            />
          ))}
        </View>
      )}
    </View>
  );
}
