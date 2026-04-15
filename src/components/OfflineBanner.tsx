import { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export function OfflineBanner() {
  const insets = useSafeAreaInsets();
  const [online, setOnline] = useState(true);

  useEffect(() => {
    // Estado inicial real — no asumir online hasta verificar
    NetInfo.fetch().then((state) => {
      setOnline(state.isConnected === true && state.isInternetReachable !== false);
    });
    const unsub = NetInfo.addEventListener((state) => {
      setOnline(state.isConnected === true && state.isInternetReachable !== false);
    });
    return () => unsub();
  }, []);

  if (online) return null;

  return (
    <View style={[styles.banner, { paddingTop: insets.top + 6 }]}>
      <Text style={styles.text}>📡 Sin conexión</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: "#DC2626",
    paddingBottom: 6,
    alignItems: "center",
    zIndex: 9999,
  },
  text: {
    color: "white",
    fontSize: 13,
    fontWeight: "600",
  },
});
