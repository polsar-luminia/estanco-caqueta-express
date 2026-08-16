// Franja naranja fija mientras la app apunta al STAGING (modo pruebas).
//
// SIEMPRE visible a proposito: un modo de pruebas silencioso termina en "por
// que no me llegan los pedidos" con la tienda abierta de verdad. Si esta
// franja no se ve, la app esta contra produccion. Ver src/lib/backendPruebas.ts.

import { useSyncExternalStore } from "react";
import { View, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { modoPruebasActivo, suscribirModoPruebas } from "../lib/backendPruebas";

export function BannerModoPruebas() {
  const activo = useSyncExternalStore(suscribirModoPruebas, modoPruebasActivo, modoPruebasActivo);
  const insets = useSafeAreaInsets();
  if (!activo) return null;

  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: insets.top,
        left: 0,
        right: 0,
        alignItems: "center",
        zIndex: 9999,
      }}
    >
      <View
        style={{
          backgroundColor: "#f97316",
          borderRadius: 999,
          paddingHorizontal: 12,
          paddingVertical: 3,
          shadowColor: "#000",
          shadowOpacity: 0.15,
          shadowRadius: 4,
          shadowOffset: { width: 0, height: 2 },
          elevation: 3,
        }}
      >
        <Text style={{ color: "#fff", fontSize: 11, fontWeight: "800", letterSpacing: 0.5 }}>
          MODO PRUEBAS · staging
        </Text>
      </View>
    </View>
  );
}
