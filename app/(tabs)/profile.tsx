import { View, Text, Pressable, ScrollView, Linking, Alert, Image } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useAuthStore } from "../../src/stores/auth";
import { WHATSAPP_SOPORTE } from "../../src/constants/config";

function MenuItem({ icon, label, badge, onPress }: { icon: string; label: string; badge?: string; onPress?: () => void }) {
  const iconMap: Record<string, keyof typeof Feather.glyphMap> = {
    "person": "map-pin",
    "payments": "credit-card",
    "receipt_long": "file-text",
    "confirmation_number": "tag",
    "help_center": "help-circle",
    "policy": "shield",
    "chat": "message-circle",
  };

  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center justify-between p-4"
      style={{ borderBottomWidth: 0.5, borderBottomColor: "#F4F4F0" }}
    >
      <View className="flex-row items-center" style={{ gap: 14 }}>
        <Feather name={iconMap[icon] || "circle"} size={20} color={icon === "confirmation_number" ? "#D33587" : "#9E9E9E"} />
        <Text style={{ fontSize: 15, fontWeight: "500", color: "#1A1C1A" }}>{label}</Text>
      </View>
      <View className="flex-row items-center" style={{ gap: 8 }}>
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
  const cliente = useAuthStore((s) => s.cliente);
  const logout = useAuthStore((s) => s.logout);

  const handleLogout = () => {
    Alert.alert("Cerrar sesión", "¿Quieres salir de tu cuenta?", [
      { text: "No" },
      { text: "Sí", style: "destructive", onPress: logout },
    ]);
  };

  return (
    <ScrollView className="flex-1 bg-white" contentContainerStyle={{ paddingBottom: 100 }}>
      {/* Profile Header */}
      <View className="items-center mt-8 mb-8">
        <View
          style={{
            width: 100, height: 100, borderRadius: 50,
            backgroundColor: "#F4F4F0",
            borderWidth: 3, borderColor: "rgba(31,175,85,0.15)",
            alignItems: "center", justifyContent: "center",
          }}
        >
          <Text style={{ fontSize: 40 }}>👤</Text>
        </View>
        <Text style={{ fontSize: 22, fontWeight: "700", color: "#1A1C1A", marginTop: 12 }}>
          {cliente?.nombre || "Usuario"}
        </Text>
        <Text style={{ fontSize: 13, color: "#6D7B6C", marginTop: 2 }}>
          {cliente?.telefono}
        </Text>
      </View>

      {/* Stats */}
      <View className="flex-row mx-6 mb-8" style={{ gap: 12 }}>
        <View className="flex-1 items-center py-4 rounded-2xl" style={{ backgroundColor: "#F4F4F0" }}>
          <Text style={{ fontSize: 10, fontWeight: "700", color: "#1FAF55", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 4 }}>
            Pedidos
          </Text>
          <Text style={{ fontSize: 18, fontWeight: "700", color: "#1A1C1A" }}>
            {cliente?.puntos != null ? Math.floor((cliente.puntos || 0) / 100) : 0}
          </Text>
          <Text style={{ fontSize: 9, color: "#6D7B6C", marginTop: 2 }}>envíos gratis</Text>
        </View>
        <View
          className="flex-1 items-center py-4 rounded-2xl"
          style={{ backgroundColor: "#F4F4F0", borderLeftWidth: 2, borderLeftColor: "#D33587" }}
        >
          <Text style={{ fontSize: 10, fontWeight: "700", color: "#D33587", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 4 }}>
            Puntos
          </Text>
          <Text style={{ fontSize: 18, fontWeight: "700", color: "#1A1C1A" }}>
            {cliente?.puntos || 0} pts
          </Text>
          <Text style={{ fontSize: 9, color: "#6D7B6C", marginTop: 2 }}>100 pts = envío gratis</Text>
        </View>
      </View>

      {/* Información Personal */}
      <View className="mx-6 mb-6">
        <Text style={{ fontSize: 10, fontWeight: "900", color: "#9E9E9E", textTransform: "uppercase", letterSpacing: 2, marginBottom: 12 }}>
          Información Personal
        </Text>
        <View className="bg-white rounded-2xl overflow-hidden" style={{ borderWidth: 1, borderColor: "#F4F4F0" }}>
          <MenuItem icon="person" label="Mis Direcciones" onPress={() => router.push("/profile/direcciones")} />
          <MenuItem icon="payments" label="Métodos de Pago" onPress={() => router.push("/profile/metodos-pago")} />
        </View>
      </View>

      {/* Pedidos y Promociones */}
      <View className="mx-6 mb-6">
        <Text style={{ fontSize: 10, fontWeight: "900", color: "#9E9E9E", textTransform: "uppercase", letterSpacing: 2, marginBottom: 12 }}>
          Pedidos y Promociones
        </Text>
        <View className="bg-white rounded-2xl overflow-hidden" style={{ borderWidth: 1, borderColor: "#F4F4F0" }}>
          <MenuItem
            icon="receipt_long"
            label="Historial de Pedidos"
            onPress={() => router.push("/(tabs)/orders")}
          />
          <MenuItem icon="confirmation_number" label="Cupones y Descuentos" badge="3 Nuevos" onPress={() => router.push("/profile/cupones")} />
        </View>
      </View>

      {/* Soporte */}
      <View className="mx-6 mb-6">
        <Text style={{ fontSize: 10, fontWeight: "900", color: "#9E9E9E", textTransform: "uppercase", letterSpacing: 2, marginBottom: 12 }}>
          Soporte
        </Text>
        <View className="bg-white rounded-2xl overflow-hidden" style={{ borderWidth: 1, borderColor: "#F4F4F0" }}>
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

      {/* Logout */}
      <View className="mx-6 mt-2">
        <Pressable
          onPress={handleLogout}
          className="flex-row items-center justify-center py-4 rounded-xl"
          style={{
            backgroundColor: "#D33587",
            shadowColor: "#D33587",
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.2,
            shadowRadius: 16,
            elevation: 4,
            gap: 8,
          }}
        >
          <Feather name="log-out" size={18} color="#fff" />
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15, letterSpacing: 0.5 }}>
            Cerrar Sesión
          </Text>
        </Pressable>

      </View>

      {/* Branding Polo & Salazar */}
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

      {/* Versión y créditos */}
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
