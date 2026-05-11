import { StyleSheet, View, Image } from "react-native";

const SPLASH_ICON = require("../../assets/splash-icon.png");

export function SplashBranded() {
  return (
    <View style={styles.container}>
      <Image
        source={SPLASH_ICON}
        style={styles.icon}
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
    // Mantener sincronizado con app.json → splash.backgroundColor
    backgroundColor: "#1FAF55",
    alignItems: "center",
    justifyContent: "center",
  },
  icon: {
    width: 200,
    height: 200,
  },
});
