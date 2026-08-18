import { View, Text, Pressable, ScrollView, Linking, Alert, Image } from "react-native";
import { useRouter, Redirect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Constants from "expo-constants";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Clipboard from "expo-clipboard";
import Toast from "react-native-toast-message";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../../src/stores/auth";
import { useCartStore } from "../../src/stores/cart";
import { WHATSAPP_SOPORTE } from "../../src/constants/config";
import { getCuponesDisponibles } from "../../src/lib/api";
import { CopyIcon } from "../../src/components/icons/AppIcons";
import { colors } from "../../src/constants/theme";

function MenuItem({ icon, label, badge, onPress, a11yLabel }: { icon: string; label: string; badge?: string; onPress?: () => void; a11yLabel: string }) {
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
  // Tile de color por sección (rediseño Vibrante).
  const colorMap: Record<string, string> = {
    "person": colors.green,
    "payments": colors.purple,
    "notifications": colors.amber,
    "receipt_long": colors.offer,
    "confirmation_number": colors.pink,
    "chat": colors.green,
    "help_center": colors.blue,
    "policy": colors.faint,
  };

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      // El badge ("2 disponibles") se anexa a la etiqueta porque es información
      // que solo existe visualmente en la fila.
      accessibilityLabel={badge ? `${a11yLabel}, ${badge}` : a11yLabel}
      style={{
        flexDirection: "row", alignItems: "center", justifyContent: "space-between",
        padding: 13, borderBottomWidth: 0.5, borderBottomColor: colors.line,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: colorMap[icon] || colors.faint, alignItems: "center", justifyContent: "center" }}>
          <Feather name={iconMap[icon] || "circle"} size={16} color="#fff" />
        </View>
        <Text style={{ fontSize: 14.5, fontWeight: "600", color: colors.ink }}>{label}</Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        {badge && (
          <View style={{ backgroundColor: colors.pink, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
            <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700", textTransform: "uppercase" }}>{badge}</Text>
          </View>
        )}
        <Feather name="chevron-right" size={18} color="#CBD3C7" />
      </View>
    </Pressable>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const cliente = useAuthStore((s) => s.cliente);
  const logout = useAuthStore((s) => s.logout);
  const clearCart = useCartStore((s) => s.clear);
  const queryClient = useQueryClient();

  const { data: cupones = [] } = useQuery({
    queryKey: ["cupones-disponibles"],
    queryFn: getCuponesDisponibles,
    staleTime: 5 * 60 * 1000,
    enabled: isAuthenticated,
  });
  const cuponesNuevos = cupones.filter((c) => !c.ya_usado).length;

  // A REGISTRO y no a login: el invitado que llega aqui, por defecto, todavia
  // no tiene cuenta. Mismo criterio que el muro del carrito, que ya lo razonaba
  // asi y era el unico sitio que lo aplicaba.
  if (!isAuthenticated) return <Redirect href="/(auth)/register" />;

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
  const totalPedidos = cliente?.total_pedidos ?? 0;

  // Progress bar puntos (0-100 por ciclo)
  const pct = Math.min(100, ((puntos % 100) / 100) * 100);
  const puntosNext = 100 - (puntos % 100);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ paddingBottom: 112 }}>

      {/* ── Header verde (Vibrante) ──────────────────────────── */}
      <LinearGradient
        colors={[colors.green, colors.greenDeep]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingBottom: 28, position: "relative", overflow: "hidden" }}
      >
        {/* Glow blanco sutil */}
        <View style={{
          position: "absolute", top: -50, right: -30,
          width: 160, height: 160, borderRadius: 80,
          backgroundColor: "rgba(255,255,255,0.10)",
        }} />

        {/* Back — perfil ya no es tab, se accede vía push desde el header.
            canGoBack guard evita dead-end en deep-link directo (Apple 5.1.1v). */}
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Volver a la pantalla anterior"
          style={{
            position: "absolute",
            top: insets.top + 8,
            left: 12,
            zIndex: 10,
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            paddingVertical: 6,
            paddingHorizontal: 8,
          }}
        >
          <Feather name="chevron-left" size={22} color="#fff" />
          <Text style={{ fontSize: 15, fontWeight: "600", color: "#fff" }}>Volver</Text>
        </Pressable>

        {/* Avatar + nombre */}
        <View style={{ alignItems: "center", paddingTop: insets.top + 16, gap: 8 }}>
          <View
            style={{
              width: 76, height: 76, borderRadius: 38,
              alignItems: "center", justifyContent: "center",
              backgroundColor: "rgba(255,255,255,0.20)",
              borderWidth: 2, borderColor: "rgba(255,255,255,0.40)",
            }}
          >
            <Text style={{ fontSize: 26, fontWeight: "900", color: "#fff", letterSpacing: -1 }}>
              {initials}
            </Text>
          </View>

          <View style={{ alignItems: "center" }}>
            <Text style={{ fontSize: 20, fontWeight: "800", color: "#fff" }}>
              {cliente?.nombre || "Usuario"}
            </Text>
            <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.80)", marginTop: 2 }}>
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
            { label: "Pedidos", value: String(totalPedidos), color: "#1FAF55", sub: "realizados" },
            { label: "Puntos", value: `${puntos} pts`, color: colors.offer, sub: "200 = envío gratis" },
          ].map((stat, i) => (
            <View key={stat.label} style={{
              flex: 1, alignItems: "center",
              borderLeftWidth: i > 0 ? 1 : 0, borderLeftColor: "#E2E3DF",
            }}>
              <Text style={{
                fontSize: 12, fontWeight: "700", color: stat.color,
                textTransform: "uppercase", letterSpacing: 1, marginBottom: 3,
              }}>
                {stat.label}
              </Text>
              <Text style={{ fontSize: 18, fontWeight: "800", color: "#1A1C1A" }}>{stat.value}</Text>
              <Text style={{ fontSize: 12, color: "#BCCABA", marginTop: 1 }}>{stat.sub}</Text>
            </View>
          ))}
        </View>
      </LinearGradient>

      {/* Spacer para compensar el float del stats row */}
      <View style={{ height: 28 }} />

      {/* ── Progress bar de puntos ───────────────────────────── */}
      <View style={{
        marginHorizontal: 24, marginBottom: 12,
        backgroundColor: "#FFFFFF", borderRadius: 16,
        padding: 14, borderWidth: 1, borderColor: "#E2E3DF",
      }}>
        <View style={{ marginBottom: 8 }}>
          <Text style={{ fontSize: 13, fontWeight: "700", color: "#1A1C1A" }}>Progreso de puntos</Text>
          <Text style={{ fontSize: 12, fontWeight: "600", color: colors.offer, marginTop: 2 }}>
            {puntosNext} pts para tu próximo envío gratis
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
          <Text style={{ fontSize: 12, color: "#BCCABA" }}>0 pts</Text>
          <Text style={{ fontSize: 12, color: "#BCCABA" }}>100 pts</Text>
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
              fontSize: 12, fontWeight: "700", color: "#6D7B6C",
              textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 4,
            }}>
              Código de referido
            </Text>
            <Text style={{ fontSize: 20, fontWeight: "900", color: "#1A1C1A", letterSpacing: 3 }}>
              {cliente.codigo_referido}
            </Text>
            <Text style={{ fontSize: 12, color: "#BCCABA", marginTop: 3 }}>
              Comparte y gana puntos
            </Text>
          </View>
          <Pressable
            onPress={() => {
              Clipboard.setStringAsync(cliente.codigo_referido!);
              Toast.show({ type: "success", text1: "Código copiado", visibilityTime: 1500 });
            }}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`Copiar tu código de referido ${cliente.codigo_referido}`}
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
        <Text style={{ fontSize: 12, fontWeight: "900", color: "#9E9E9E", textTransform: "uppercase", letterSpacing: 2, marginBottom: 12 }}>
          Información Personal
        </Text>
        <View style={{ backgroundColor: "#FFFFFF", borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: "#F4F4F0" }}>
          <MenuItem icon="person" label="Mis Direcciones" a11yLabel="Ver y editar mis direcciones de entrega" onPress={() => router.push("/profile/direcciones")} />
          <MenuItem icon="payments" label="Métodos de Pago" a11yLabel="Ver los métodos de pago aceptados" onPress={() => router.push("/profile/metodos-pago")} />
          <MenuItem icon="notifications" label="Notificaciones y comunicaciones" a11yLabel="Configurar mis notificaciones y si quiero recibir publicidad" onPress={() => router.push("/profile/notificaciones")} />
        </View>
      </View>

      {/* ── Pedidos y Promociones ────────────────────────────── */}
      <View style={{ marginHorizontal: 24, marginBottom: 24 }}>
        <Text style={{ fontSize: 12, fontWeight: "900", color: "#9E9E9E", textTransform: "uppercase", letterSpacing: 2, marginBottom: 12 }}>
          Pedidos y Promociones
        </Text>
        <View style={{ backgroundColor: "#FFFFFF", borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: "#F4F4F0" }}>
          <MenuItem
            icon="receipt_long"
            label="Historial de Pedidos"
            a11yLabel="Ver el historial de mis pedidos"
            onPress={() => router.push("/(tabs)/orders")}
          />
          <MenuItem
            icon="confirmation_number"
            label="Cupones y Descuentos"
            a11yLabel="Ver mis cupones y descuentos"
            badge={cuponesNuevos > 0 ? `${cuponesNuevos} disponible${cuponesNuevos > 1 ? "s" : ""}` : undefined}
            onPress={() => router.push("/profile/cupones")}
          />
        </View>
      </View>

      {/* ── Soporte ──────────────────────────────────────────── */}
      <View style={{ marginHorizontal: 24, marginBottom: 24 }}>
        <Text style={{ fontSize: 12, fontWeight: "900", color: "#9E9E9E", textTransform: "uppercase", letterSpacing: 2, marginBottom: 12 }}>
          Soporte
        </Text>
        <View style={{ backgroundColor: "#FFFFFF", borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: "#F4F4F0" }}>
          <MenuItem
            icon="chat"
            label="Soporte WhatsApp"
            a11yLabel="Escribirle a soporte por WhatsApp"
            onPress={() => Linking.openURL(WHATSAPP_SOPORTE)}
          />
          <MenuItem
            icon="help_center"
            label="Centro de Ayuda"
            a11yLabel="Abrir el centro de ayuda y preguntas frecuentes"
            onPress={() => router.push("/support/help")}
          />
          <MenuItem
            icon="policy"
            label="Términos y Condiciones"
            a11yLabel="Leer los términos y condiciones"
            onPress={() => router.push("/support/terms")}
          />
          <MenuItem
            icon="policy"
            label="Eliminar cuenta"
            a11yLabel="Eliminar mi cuenta de forma permanente"
            onPress={() => router.push("/profile/eliminar-cuenta")}
          />
        </View>
      </View>

      {/* ── Cerrar Sesión — sutil oscuro ─────────────────────── */}
      <View style={{ marginHorizontal: 24, marginTop: 8 }}>
        <Pressable
          onPress={handleLogout}
          accessibilityRole="button"
          accessibilityLabel="Cerrar sesión y salir de mi cuenta"
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
        <Text style={{ fontSize: 12, color: "#BCCABA", textTransform: "uppercase", letterSpacing: 2 }}>
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
        <Text style={{ textAlign: "center", fontSize: 12, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: 2 }}>
          Versión {Constants.expoConfig?.version ?? "1.0.0"}
        </Text>
        <Text style={{ textAlign: "center", fontSize: 12, color: "#9E9E9E" }}>
          Creado por{" "}
          <Text
            style={{ color: "#D33587", fontWeight: "700" }}
            onPress={() => Linking.openURL("https://hola.luminiatech.digital")}
            accessibilityRole="link"
            accessibilityLabel="Abrir el sitio web de LuminIA"
          >
            LuminIA
          </Text>
        </Text>
      </View>
    </ScrollView>
  );
}
