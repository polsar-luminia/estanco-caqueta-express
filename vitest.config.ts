import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "expo-secure-store": path.resolve(__dirname, "./src/__mocks__/expo-secure-store.ts"),
      "@react-native-async-storage/async-storage": path.resolve(__dirname, "./src/__mocks__/async-storage.ts"),
      "react-native": path.resolve(__dirname, "./src/__mocks__/react-native.ts"),
    },
  },
});
