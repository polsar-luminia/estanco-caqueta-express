import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    // RN usa require() para assets binarios (PNG/JPG). En vitest no hay
    // transformer para binarios → los aliaseamos a un stub vacío.
    server: {
      deps: {
        inline: [/\.(png|jpg|jpeg|gif|webp|svg)$/],
      },
    },
  },
  resolve: {
    alias: [
      { find: "expo-secure-store", replacement: path.resolve(__dirname, "./src/__mocks__/expo-secure-store.ts") },
      { find: "@react-native-async-storage/async-storage", replacement: path.resolve(__dirname, "./src/__mocks__/async-storage.ts") },
      { find: "@sentry/react-native", replacement: path.resolve(__dirname, "./src/__mocks__/sentry-react-native.ts") },
      { find: "react-native", replacement: path.resolve(__dirname, "./src/__mocks__/react-native.ts") },
      { find: "react-native-svg", replacement: path.resolve(__dirname, "./src/__mocks__/react-native-svg.ts") },
      { find: "expo-notifications", replacement: path.resolve(__dirname, "./src/__mocks__/expo-notifications.ts") },
      { find: "expo-image", replacement: path.resolve(__dirname, "./src/__mocks__/expo-image.ts") },
      // Stub para assets de imagen (PNG/JPG/etc). RN usa require() en el código.
      { find: /\.(png|jpg|jpeg|gif|webp|svg)$/, replacement: path.resolve(__dirname, "./src/__mocks__/image-asset.ts") },
    ],
  },
});
