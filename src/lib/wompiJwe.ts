// JWE para tokenizar tarjeta con Wompi (fase 2 — INFORME-WOMPI-PLAN-GATEWAY §8.2).
//
// El número, el CVC y el vencimiento salen del teléfono ya cifrados con la
// llave PÚBLICA de Wompi: ni siquiera `polo-api` los ve. El JWE compacto
// (RFC 7516) va en el campo `payload` de `POST /tokens/cards`, autenticado
// con la llave pública DEL COMERCIO (Authorization: Bearer, distinta de la
// llave RSA de este archivo — ver `TokenizacionInfo` en src/lib/api.ts).
//
// POR QUÉ node-forge y no WebCrypto/react-native-quick-crypto: RN/Hermes no
// trae WebCrypto (`crypto.subtle`) nativo, y las alternativas nativas
// (react-native-quick-crypto, vía Nitro Modules) exigen infraestructura que
// este repo no tiene montada — sería un módulo nativo nuevo encima de otro
// (react-native-webview) solo para esto. node-forge es JavaScript puro (sin
// bindings nativos), implementa RSA-OAEP y AES-GCM, y quedó probado contra
// el bundler real de este repo: `npx expo export --platform ios` empaqueta
// forge sin pedir polyfills de 'crypto'/'buffer'/'process' — sus únicos
// `require('crypto')` (prng.js, rsa.js, pbkdf2.js) están detrás de
// `forge.util.isNodejs`, que en Hermes siempre da `false`, así que Metro los
// deja sin resolver y no truena.
//
// LA ÚNICA pieza que SÍ hay que traer de fuera es la fuente de aleatoriedad:
// forge, sin `crypto.getRandomValues`, no detecta el entorno de RN y puede
// caer a una semilla débil sin avisar (su detección busca `window.crypto`,
// que no existe aquí). Por eso la CEK y el IV se generan con
// `crypto.getRandomValues` — polyfillado globalmente por
// `react-native-get-random-values` en index.ts, que debe importarse ANTES
// de cualquier otra cosa (incluido este módulo).
//
// LIMITACIÓN CONOCIDA: no se probó contra un dispositivo/simulador real ni
// contra el sandbox de Wompi (esta tarea es solo código — ver reporte). La
// mecánica criptográfica (RSA-OAEP-256 + A256GCM, serialización compacta)
// sigue al pie de la letra RFC 7516/7518; lo no verificado es el contrato
// exacto de Wompi (nombres de campo confirmados por búsqueda: `payload` en
// el body, PEM en `data.publicKey` — ver src/lib/api.ts).

import forge from "node-forge";

export interface DatosTarjetaJWE {
  number: string;
  cvc: string;
  exp_month: string;
  exp_year: string;
  card_holder: string;
}

function base64UrlDesdeBinario(bin: string): string {
  return forge.util.encode64(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** CSPRNG real vía `crypto.getRandomValues` (polyfill en index.ts). NUNCA
 *  `forge.random`: en RN no detecta una fuente segura y no lo dice. */
function bytesAleatoriosBinario(n: number): string {
  if (typeof crypto === "undefined" || typeof crypto.getRandomValues !== "function") {
    throw new Error(
      "crypto.getRandomValues no disponible: falta el import de 'react-native-get-random-values' en index.ts"
    );
  }
  const arr = new Uint8Array(n);
  crypto.getRandomValues(arr);
  let bin = "";
  for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
  return bin;
}

/**
 * Arma el JWE compacto que exige `POST /tokens/cards`:
 * `header.encryptedKey.iv.ciphertext.tag`, los 5 segmentos en base64url.
 *
 * @param publicKeyPem PEM de `GET /pagos/llave-tokenizacion` → `publicKey`
 *   (la llave RSA de Wompi para envolver la CEK — NO la llave pública del
 *   comercio, que es un campo aparte, `wompiPublicKey`, y va en el header
 *   Authorization del POST a Wompi, no acá).
 * @param datos Los 5 campos de la tarjeta. Nunca se guardan ni se loguean:
 *   quien llama a esta función debe descartar el objeto apenas termine.
 */
export function armarJWE(publicKeyPem: string, datos: DatosTarjetaJWE): string {
  if (typeof publicKeyPem !== "string" || !publicKeyPem.includes("BEGIN PUBLIC KEY")) {
    throw new Error("Llave pública de tokenización inválida o ausente");
  }

  const rsaPublicKey = forge.pki.publicKeyFromPem(publicKeyPem);

  // 1. Header protegido — va en claro (es lo único legible del JWE) y ADEMÁS
  // sirve de AAD para el AES-GCM de abajo (RFC 7516 §5.1(14)).
  const headerJson = JSON.stringify({ alg: "RSA-OAEP-256", enc: "A256GCM" });
  // El header es JSON ASCII puro (sin acentos): encodeUtf8 es un no-op aquí,
  // pero se deja explícito por si algún día el header lleva algo no-ASCII.
  const headerB64 = base64UrlDesdeBinario(forge.util.encodeUtf8(headerJson));

  // 2. CEK de 256 bits para AES-GCM.
  const cek = bytesAleatoriosBinario(32);

  // 3. Envolver la CEK con RSA-OAEP-256. El "-256" es SHA-256 en las DOS
  // partes (hash Y MGF1) — con solo el hash en SHA-256 y MGF1 en SHA-1 (el
  // default de forge) esto sería "RSA-OAEP" a secas, que Wompi rechazaría.
  const encryptedKeyBin = rsaPublicKey.encrypt(cek, "RSA-OAEP", {
    md: forge.md.sha256.create(),
    mgf1: { md: forge.md.sha256.create() },
  });
  const encryptedKeyB64 = base64UrlDesdeBinario(encryptedKeyBin);

  // 4. IV de 96 bits — el tamaño que exige GCM.
  const ivBin = bytesAleatoriosBinario(12);
  const ivB64 = base64UrlDesdeBinario(ivBin);

  // 5. Cifrar los datos reales de la tarjeta con AES-256-GCM. AAD =
  // ASCII(BASE64URL(header)) — headerB64 ya es ASCII puro (alfabeto
  // base64url), así que pasarlo tal cual como "binario" de forge es correcto
  // byte a byte.
  const plaintext = forge.util.encodeUtf8(JSON.stringify(datos));
  const cipher = forge.cipher.createCipher("AES-GCM", cek);
  cipher.start({ iv: ivBin, additionalData: headerB64, tagLength: 128 });
  cipher.update(forge.util.createBuffer(plaintext));
  cipher.finish();
  const ciphertextB64 = base64UrlDesdeBinario(cipher.output.getBytes());
  const tagB64 = base64UrlDesdeBinario(cipher.mode.tag.getBytes());

  return `${headerB64}.${encryptedKeyB64}.${ivB64}.${ciphertextB64}.${tagB64}`;
}
