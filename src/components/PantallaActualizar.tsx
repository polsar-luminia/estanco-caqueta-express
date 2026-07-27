/**
 * Pantalla de actualización obligatoria (bloque G).
 *
 * Cubre la app entera y NO se puede cerrar: no hay botón de atrás, no hay gesto
 * de descarte, no hay "más tarde". Si se pudiera saltar, el bloqueo no sería un
 * bloqueo. Por eso la única acción es el botón que lleva a la tienda.
 *
 * Nunca aparece por sí sola: solo la muestra el guard de _layout cuando el
 * servidor dice que la versión instalada quedó por debajo del mínimo, y ese
 * mínimo nace en 1.0.0 (que toda versión cumple).
 */

import { View, Text, Pressable, Linking, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors } from "../constants/theme";
import { APP_STORE_URL, PLAY_STORE_URL } from "../constants/config";

export function PantallaActualizar({ mensaje }: { mensaje?: string | null }) {
  const url = Platform.OS === "ios" ? APP_STORE_URL : PLAY_STORE_URL;

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.bg,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 32,
      }}
      // El lector de pantalla tampoco debe poder salirse a la app de atrás.
      accessibilityViewIsModal
    >
      <View
        style={{
          width: 84,
          height: 84,
          borderRadius: 42,
          backgroundColor: "rgba(31,175,85,0.12)",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 24,
        }}
      >
        <Feather name="download" size={38} color={colors.green} />
      </View>

      <Text
        style={{
          fontSize: 22,
          fontWeight: "800",
          color: colors.ink,
          textAlign: "center",
        }}
      >
        Actualiza la app
      </Text>

      <Text
        style={{
          fontSize: 15,
          lineHeight: 22,
          color: colors.muted,
          textAlign: "center",
          marginTop: 12,
        }}
      >
        {mensaje || "Actualiza la app para seguir pidiendo. Esta versión ya no es compatible."}
      </Text>

      <Pressable
        onPress={() => Linking.openURL(url).catch(() => {})}
        accessibilityRole="button"
        accessibilityLabel={
          Platform.OS === "ios" ? "Actualizar en el App Store" : "Actualizar en Google Play"
        }
        style={{
          minHeight: 52,
          alignSelf: "stretch",
          borderRadius: 14,
          backgroundColor: colors.green,
          alignItems: "center",
          justifyContent: "center",
          marginTop: 28,
        }}
      >
        <Text style={{ fontSize: 16, fontWeight: "800", color: "#fff" }}>
          {Platform.OS === "ios" ? "Abrir App Store" : "Abrir Google Play"}
        </Text>
      </Pressable>
    </View>
  );
}
