/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
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
      },
    },
  },
  plugins: [],
};
