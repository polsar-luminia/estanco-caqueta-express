// Debe ser el PRIMER import del bundle: wompiJwe.ts (pago con tarjeta, fase
// 2) llama a crypto.getRandomValues para la CEK/IV del JWE, y este polyfill
// tiene que estar instalado antes de que cualquier otro módulo lo use.
import "react-native-get-random-values";
import "expo-router/entry";
