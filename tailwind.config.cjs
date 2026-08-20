/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      fontFamily: {
        // Las de marca, con los MISMOS alias que registra useFonts en
        // app/_layout.tsx (ver src/constants/theme.ts → fuentes). Si el alias no
        // coincide, nativewind emite un fontFamily que no existe y el texto sale
        // con la tipografia del sistema, sin ningun error.
        titulo: ["ArchivoBlack"],
        destacado: ["Oswald"],
        // Heredadas: apuntan a fuentes que NO se cargan en ningun lado, asi que
        // hoy caen al sistema. Se dejan para no romper una clase suelta que
        // siga usandolas; no usarlas en codigo nuevo.
        headline: ["PlusJakartaSans_700Bold"],
        body: ["Inter_400Regular"],
      },
      colors: {
        brand: {
          50: "#F0FFF4",
          100: "#C6F6D5",
          200: "#9AE6B4",
          300: "#68D391",
          400: "#48BB78",
          500: "#1FAF55",
          600: "#17994A",
          700: "#14863F",
          800: "#0F6B32",
          900: "#0A5025",
        },
        magenta: {
          50: "#FDE8F2",
          100: "#F9C5DE",
          200: "#F29DC6",
          300: "#E870AA",
          400: "#D84D93",
          500: "#D33587",
          600: "#C42D78",
          700: "#A52565",
          800: "#871D52",
          900: "#691540",
        },
        accent: {
          50: "#FFF8E1",
          100: "#FFECB3",
          200: "#FFE082",
          300: "#FFD54F",
          400: "#FFCA28",
          500: "#B38B2E",
          600: "#9E7A28",
          700: "#8A6B22",
          800: "#755B1C",
          900: "#614C16",
        },
        // Stitch design tokens
        surface: {
          DEFAULT: "#FAFAF6",
          low: "#F4F4F0",
          high: "#E8E8E5",
          highest: "#E2E3DF",
          container: "#EEEEEA",
        },
        "on-surface": "#1A1C1A",
        "on-surface-variant": "#3D4A3E",
        outline: {
          DEFAULT: "#6D7B6C",
          variant: "#BCCABA",
        },
      },
    },
  },
  plugins: [],
};
