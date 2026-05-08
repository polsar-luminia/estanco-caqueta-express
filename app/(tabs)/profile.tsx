import { View, Text, Pressable, ScrollView, Linking, Alert, Image } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Clipboard from "expo-clipboard";
import Toast from "react-native-toast-message";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../../src/stores/auth";
import { useCartStore } from "../../src/stores/cart";
import { WHATSAPP_SOPORTE } from "../../src/constants/config";
import { formatCOP } from "../../src/lib/format";
import { getCuponesDisponibles } from "../../src/lib/api";
import { CopyIcon } from "../../src/components/icons/AppIcons";

function MenuItem({ icon, label, badge, onPress }: { icon: string; label: string; badge?: string; onPress?: () => void }) {
  const iconMap: Record<string, keyof typeof Feather.glyphMap> = {
    "person": "map-pin",
    "payments": "credit-card",
    "receipt_long": "file-text",
    "confirmation_number": "tag",
    "help_center": "help-circle",
    "policy": "shield",
    "chat": "message-circle",
    "notifications": "bell",
  };

  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: "row", alignItems: "center", justifyContent: "space-between",
        padding: 16, borderBottomWidth: 0.5, borderBottomColor: "#F4F4F0",
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <Feather name={iconMap[icon] || "circle"} size={20} color={icon === "confirmation_number" ? "#D33587" : "#9E9E9E"} />
        <Text style={{ fontSize: 15, fontWeight: "500", color: "#1A1C1A" }}>{label}</Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        {badge && (
          <View style={{ backgroundColor: "#D33587", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
            <Text style={{ color: "#fff", fontSize: 9, fontWeight: "700", textTransform: "uppercase" }}>{badge}</Text>
          </View>
        )}
        <Feather name="chevron-right" size={18} color="#D1D5DB" />
      </View>
    </Pressable>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const cliente = useAuthStore((s) => s.cliente);
  const logout = useAuthStore((s) => s.logout);
  const clearCart = useCartStore((s) => s.clear);
  const queryClient = useQueryClient();

  const { data: cupones = [] } = useQuery({
    queryKey: ["cupones-disponibles"],
    queryFn: getCuponesDisponibles,
    staleTime: 5 * 60 * 1000,
  });
  const cuponesNuevos = cupones.filter((c) => !c.ya_usado).length;

  const handleLogout = () => {
    Alert.alert("Cerrar sesión", "¿Quieres salir de tu cuenta?", [
      { text: "No" },
      {
        text: "Sí", style: "destructive", onPress: async () => {
          clearCart();
          queryClient.clear();
          await logout();
          Toast.show({ type: "success", text1: "Sesión cerrada" });
        },
      },
    ]);
  };

  // Iniciales del avatar — máx 2 letras
  const initials = cliente?.nombre
    ?.split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "U";

  const puntos = cliente?.puntos || 0;
  // Aproximación de pedidos hasta que el backend devuelva total_pedidos
  const pedidosAprox = Math.floor(puntos / 10);
  const ahorroTotal = cliente?.ahorro_total ?? 0;

  // Progress bar puntos (0-100 por ciclo)
  const pct = Math.min(100, ((puntos % 100) / 100) * 100);
  const puntosNext = 100 - (puntos % 100);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#FAFAF6" }} contentContainerStyle={{ paddingBottom: 112 }}>

      {/* ── Header oscuro ────────────────────────────────────── */}
      <View style={{ backgroundColor: "#1A1C1A", paddingBottom: 28, position: "relative", overflow: "hidden" }}>
        {/* Glow verde — top right */}
        <View style={{
          position: "absolute", top: -40, right: -40,
          width: 160, height: 160, borderRadius: 80,
          backgroundColor: "rgba(31,175,85,0.09)",
        }} />
        {/* Glow pink — bottom left */}
        <View style={{
          position: "absolute", bottom: -20, left: -20,
          width: 120, height: 120, borderRadius: 60,
          backgroundColor: "rgba(211,53,135,0.07)",
        }} />

        {/* Avatar + nombre */}
        <View style={{ alignItems: "center", paddingTop: insets.top + 16, gap: 8 }}>
          <LinearGradient
            colors={["#1FAF55", "#006D30"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              width: 76, height: 76, borderRadius: 38,
              alignItems: "center", justifyContent: "center",
              borderWidth: 3, borderColor: "rgba(255,255,255,0.12)",
              shadowColor: "#1FAF55", shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.30, shadowRadius: 24, elevation: 8,
            }}
          >
            <Text style={{ fontSize: 26, fontWeight: "900", color: "#fff", letterSpacing: -1 }}>
              {initials}
            </Text>
          </LinearGradient>

          <View style={{ alignItems: "center" }}>
            <Text style={{ fontSize: 20, fontWeight: "800", color: "#fff" }}>
              {cliente?.nombre || "Usuario"}
            </Text>
            <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>
              {cliente?.telefono}
            </Text>
          </View>
        </View>

        {/* Stats row flotante */}
        <View style={{
          marginHorizontal: 16, marginTop: 16,
          backgroundColor: "#FFFFFF", borderRadius: 16,
          paddingVertical: 14, flexDirection: "row",
          shadowColor: "#000", shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.10, shadowRadius: 24, elevation: 6,
          marginBottom: -28, position: "relative", zIndex: 2,
        }}>
          {[
            { label: "Pedidos", value: String(pedidosAprox), color: "#1FAF55", sub: "realizados" },
            { label: "Puntos", value: `${puntos} pts`, color: "#D33587", sub: "100 = envío gratis" },
            { label: "Ahorro", value: formatCOP(ahorroTotal), color: "#2A6FDB", sub: "en total" },
          ].map((stat, i) => (
            <View key={stat.label} style={{
              flex: 1, alignItems: "center",
              borderLeftWidth: i > 0 ? 1 : 0, borderLeftColor: "#E2E3DF",
            }}>
              <Text style={{
                fontSize: 10, fontWeight: "700", color: stat.color,
                textTransform: "uppercase", letterSpacing: 1, marginBottom: 3,
              }}>
                {stat.label}
              </Text>
              <Text style={{ fontSize: 18, fontWeight: "800", color: "#1A1C1A" }}>{stat.value}</Text>
              <Text style={{ fontSize: 9, color: "#BCCABA", marginTop: 1 }}>{stat.sub}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Spacer para compensar el float del stats row */}
      <View style={{ height: 28 }} />

      {/* ── Progress bar de puntos ───────────────────────────── */}
      <View style={{
        marginHorizontal: 24, marginBottom: 12,
        backgroundColor: "#FFFFFF", borderRadius: 16,
        padding: 14, borderWidth: 1, borderColor: "#E2E3DF",
      }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <Text style={{ fontSize: 13, fontWeight: "700", color: "#1A1C1A" }}>Progreso de puntos</Text>
          <Text style={{ fontSize: 11, fontWeight: "700", color: "#D33587" }}>
            {puntosNext} pts para envío gratis
          </Text>
        </View>
        <View style={{ height: 6, borderRadius: 3, backgroundColor: "#F4F4F0" }}>
          <LinearGradient
            colors={["#1FAF55", "#006D30"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ height: 6, borderRadius: 3, width: `${pct}%` as `${number}%` }}
          />
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 5 }}>
          <Text style={{ fontSize: 9, color: "#BCCABA" }}>0 pts</Text>
          <Text style={{ fontSize: 9, color: "#BCCABA" }}>100 pts</Text>
        </View>
      </View>

      {/* ── Código de referido ───────────────────────────────── */}
      {cliente?.codigo_referido ? (
        <View style={{
          marginHorizontal: 24, marginBottom: 24,
          backgroundColor: "#F4F4F0", borderRadius: 16,
          padding: 14, flexDirection: "row", alignItems: "center", gap: 12,
        }}>
          <View style={{ flex: 1 }}>
            <Text style={{
              fontSize: 10, fontWeight: "700", color: "#6D7B6C",
              textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 4,
            }}>
              Código de referido
            </Text>
            <Text style={{ fontSize: 20, fontWeight: "900", color: "#1A1C1A", letterSpacing: 3 }}>
              {cliente.codigo_referido}
            </Text>
            <Text style={{ fontSize: 11, color: "#BCCABA", marginTop: 3 }}>
              Comparte y gana puntos
            </Text>
          </View>
          <Pressable
            onPress={() => {
              Clipboard.setStringAsync(cliente.codigo_referido!);
              Toast.show({ type: "success", text1: "Código copiado", visibilityTime: 1500 });
            }}
            style={{
              backgroundColor: "#1FAF55", borderRadius: 10,
              paddingHorizontal: 14, paddingVertical: 10,
              flexDirection: "row", alignItems: "center", gap: 6,
            }}
          >
            <CopyIcon color="#fff" size={14} />
            <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>Copiar</Text>
          </Pressable>
        </View>
      ) : null}

      {/* ── Información Personal ─────────────────────────────── */}
      <View style={{ marginHorizontal: 24, marginBottom: 24 }}>
        <Text style={{ fontSize: 10, fontWeight: "900", color: "#9E9E9E", textTransform: "uppercase", letterSpacing: 2, marginBottom: 12 }}>
          Información Personal
        </Text>
        <View style={{ backgroundColor: "#FFFFFF", borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: "#F4F4F0" }}>
          <MenuItem icon="person" label="Mis Direcciones" onPress={() => router.push("/profile/direcciones")} />
          <MenuItem icon="payments" label="Métodos de Pago" onPress={() => router.push("/profile/metodos-pago")} />
          <MenuItem icon="notifications" label="Notificaciones" onPress={() => router.push("/profile/notificaciones")} />
        </View>
      </View>

      {/* ── Pedidos y Promociones ────────────────────────────── */}
      <View style={{ marginHorizontal: 24, marginBottom: 24 }}>
        <Text style={{ fontSize: 10, fontWeight: "900", color: "#9E9E9E", textTransform: "uppercase", letterSpacing: 2, marginBottom: 12 }}>
          Pedidos y Promociones
        </Text>
        <View style={{ backgroundColor: "#FFFFFF", borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: "#F4F4F0" }}>
          <MenuItem
            icon="receipt_long"
            label="Historial de Pedidos"
            onPress={() => router.push("/(tabs)/orders")}
          />
          <MenuItem
            icon="confirmation_number"
            label="Cupones y Descuentos"
            badge={cuponesNuevos > 0 ? `${cuponesNuevos} disponible${cuponesNuevos > 1 ? "s" : ""}` : undefined}
            onPress={() => router.push("/profile/cupones")}
          />
        </View>
      </View>

      {/* ── Soporte ──────────────────────────────────────────── */}
      <View style={{ marginHorizontal: 24, marginBottom: 24 }}>
        <Text style={{ fontSize: 10, fontWeight: "900", color: "#9E9E9E", textTransform: "uppercase", letterSpacing: 2, marginBottom: 12 }}>
          Soporte
        </Text>
        <View style={{ backgroundColor: "#FFFFFF", borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: "#F4F4F0" }}>
          <MenuItem
            icon="chat"
            label="Soporte WhatsApp"
            onPress={() => Linking.openURL(WHATSAPP_SOPORTE)}
          />
          <MenuItem
            icon="help_center"
            label="Centro de Ayuda"
            onPress={() => router.push("/support/help")}
          />
          <MenuItem
            icon="policy"
            label="Términos y Condiciones"
            onPress={() => router.push("/support/terms")}
          />
        </View>
      </View>

      {/* ── Cerrar Sesión — sutil oscuro ─────────────────────── */}
      <View style={{ marginHorizontal: 24, marginTop: 8 }}>
        <Pressable
          onPress={handleLogout}
          style={{
            backgroundColor: "#1A1C1A",
            borderRadius: 14,
            paddingVertical: 14,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <Feather name="log-out" size={17} color="rgba(255,255,255,0.7)" />
          <Text style={{ color: "rgba(255,255,255,0.85)", fontWeight: "700", fontSize: 14, letterSpacing: 0.3 }}>
            Cerrar Sesión
          </Text>
        </Pressable>
      </View>

      {/* ── Branding Polo & Salazar — NO MODIFICAR ───────────── */}
      <View style={{ alignItems: "center", marginTop: 16, gap: 4 }}>
        <Text style={{ fontSize: 10, color: "#BCCABA", textTransform: "uppercase", letterSpacing: 2 }}>
          Un producto de
        </Text>
        <Image
          source={require("../../assets/logo-polo-salazar.png")}
          style={{ width: 180, height: 72 }}
          resizeMode="contain"
        />
      </View>

      {/* ── Versión y créditos — NO MODIFICAR ────────────────── */}
      <View style={{ alignItems: "center", marginBottom: 24, gap: 2 }}>
        <Text style={{ textAlign: "center", fontSize: 9, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: 2 }}>
          Versión 1.0.0
        </Text>
        <Text style={{ textAlign: "center", fontSize: 9, color: "#9E9E9E" }}>
          Creado por{" "}
          <Text
            style={{ color: "#D33587", fontWeight: "700" }}
            onPress={() => Linking.openURL("https://hola.luminiatech.digital")}
          >
            LuminIA
          </Text>
        </Text>
      </View>
    </ScrollView>
  );
}
