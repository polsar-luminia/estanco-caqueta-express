import { StyleSheet, View, Image } from "react-native";

const LOGO = require("../../assets/logo-estanco.png");

export function SplashBranded() {
  return (
    <View style={styles.container}>
      <View style={styles.glowVerde} />
      <View style={styles.glowMagenta} />
      <Image
        source={LOGO}
        style={styles.logo}
        resizeMode="contain"
        accessible
        accessibilityLabel="Estanco Caquetá Express"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  glowVerde: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: "rgba(31, 175, 85, 0.13)",
    top: -80,
    left: -80,
  },
  glowMagenta: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "rgba(211, 53, 135, 0.09)",
    bottom: -60,
    right: -60,
  },
  logo: {
    width: 220,
    height: 120,
  },
});
