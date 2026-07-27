import { View, Text, Image, Pressable, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "../constants/theme";
import type { Oferta } from "../lib/api";

interface Props {
  ofertas: Oferta[];
  onPress: () => void;
}

const MAX_PREVIEW = 3;

export function OfertasBannerCard({ ofertas, onPress }: Props) {
  if (ofertas.length === 0) return null;

  const preview = ofertas.slice(0, MAX_PREVIEW);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Ver las ${ofertas.length} ofertas de hoy`}
      style={styles.wrapper}
    >
      <LinearGradient
        colors={["#1A0D12", "#3D0B2B", "#6B1040"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        {/* Destello difuso en la esquina superior derecha */}
        <View style={styles.glow} />

        {/* Izquierda: texto */}
        <View style={styles.left}>
          <Text style={styles.eyebrow}>Precios especiales</Text>
          <Text style={styles.title}>
            {ofertas.length} oferta{ofertas.length !== 1 ? "s" : ""}{"\n"}de hoy
          </Text>
          <Text style={styles.sub}>Solo por tiempo limitado</Text>
        </View>

        {/* Derecha: círculos + botón */}
        <View style={styles.right}>
          <View style={styles.circles}>
            {preview.map((oferta, idx) => (
              <View
                key={oferta.id}
                style={[styles.circle, idx > 0 && styles.circleOverlap]}
              >
                {oferta.producto.imagen_url ? (
                  <Image
                    source={{ uri: oferta.producto.imagen_url }}
                    style={styles.circleImage}
                  />
                ) : null}
              </View>
            ))}
          </View>
          <View style={styles.cta}>
            <Text style={styles.ctaText}>Ver ofertas →</Text>
          </View>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: 16,
    overflow: "hidden",
  },
  card: {
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  glow: {
    position: "absolute",
    top: -24,
    right: -24,
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "rgba(211,53,135,0.30)",
  },
  left: {
    flex: 1,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 2,
    textTransform: "uppercase",
    color: "#F9A8D4",
    marginBottom: 5,
  },
  title: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 22,
    marginBottom: 5,
  },
  sub: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 12,
  },
  right: {
    alignItems: "flex-end",
    gap: 12,
  },
  circles: {
    flexDirection: "row",
    alignItems: "center",
  },
  circle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.2)",
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  circleOverlap: {
    marginLeft: -10,
  },
  circleImage: {
    width: "100%",
    height: "100%",
  },
  cta: {
    backgroundColor: "white",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  ctaText: {
    color: colors.offer,
    fontSize: 12,
    fontWeight: "800",
  },
});
