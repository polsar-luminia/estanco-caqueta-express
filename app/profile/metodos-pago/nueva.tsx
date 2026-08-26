// Alta de tarjeta — PLAN-UI-PAGO-TARJETA-PRUEBAS.md sección "2 · Alta de
// tarjeta". Pantalla completa (fullScreenModal, ver app/profile/_layout.tsx):
// formulario propio → JWE contra Wompi directo (nunca por polo-api, ver
// src/lib/wompiJwe.ts) → fuente de pago con 3DS → polling de
// BROWSER_INFO/FINGERPRINT/CHALLENGE hasta AVAILABLE.
//
// HIGIENE DE ESTA PANTALLA (no negociable, INFORME-WOMPI §8.3 + plan §2):
// - number/cvc/exp_month/exp_year/card_holder NUNCA se persisten (ni
//   AsyncStorage, ni el store de Zustand, ni nada fuera de este componente),
//   nunca van a un console.log, nunca a Sentry (breadcrumbs/extra de este
//   archivo jamás incluyen esos campos) y nunca a tracker.track().
// - Los TextInput llevan autoComplete="off" + autoCorrect/spellCheck en false
//   + importantForAutofill="no" (Android) + textContentType="none" (iOS).
// - Pantalla marcada fuera de capturas/grabaciones con expo-screen-capture
//   mientras está montada.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  ActivityIndicator,
  Linking,
  BackHandler,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import * as Sentry from "@sentry/react-native";
import Toast from "react-native-toast-message";
import { WebView } from "react-native-webview";
import * as ScreenCapture from "expo-screen-capture";
import { colors, radii, fuentes } from "../../../src/constants/theme";
import { CheckboxRow } from "../../../src/components/CheckboxRow";
import { LogoFranquicia } from "../../../src/components/LogoFranquicia";
import { useAuthStore } from "../../../src/stores/auth";
import { tracker } from "../../../src/lib/tracker";
import { modoPruebasActivo } from "../../../src/lib/backendPruebas";
import {
  getTokensAceptacion,
  getLlaveTokenizacion,
  tokenizarTarjeta,
  crearMetodoPago,
  getEstadoMetodoPago,
} from "../../../src/lib/api";

// --- Helpers de formato (solo cosméticos: la validación real de la tarjeta
// la hace Wompi) ---

function soloDigitos(s: string): string {
  return s.replace(/\D/g, "");
}

function formatearNumero(s: string): string {
  const d = soloDigitos(s).slice(0, 19);
  return d.replace(/(.{4})/g, "$1 ").trim();
}

function formatearVencimiento(s: string): string {
  const d = soloDigitos(s).slice(0, 4);
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)}/${d.slice(2)}`;
}

/** Detección de franquicia por BIN — SOLO cosmética (pintar el logo mientras
 *  se escribe). La que se guarda es la que confirma Wompi en el servidor. */
function detectarFranquiciaPorBin(numeroLimpio: string): string {
  if (/^4/.test(numeroLimpio)) return "VISA";
  if (/^(5[1-5]|2[2-7])/.test(numeroLimpio)) return "MASTERCARD";
  return "";
}

// AAD/HTML de 3DS viaja HTML-escapado (`&lt;` → `<`) — la doc de Wompi lo
// advierte dos veces: sin desescapar, el WebView muestra texto plano en vez
// de ejecutar el HTML del banco.
function desescaparHtml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 3 * 60 * 1000; // 3 min — guion de prueba #9 del plan
const OFFLINE_AVISO_MS = 30 * 1000;

type MotivoFallo = "bin_sin_3ds" | "declinada" | "challenge_abandonado" | "timeout" | "red" | "error";
type Paso = "formulario" | "token" | "fuente" | "challenge" | "cobro";

type EstadoPantalla =
  | { tipo: "formulario" }
  | { tipo: "procesando"; mensaje: string }
  | { tipo: "challenge"; html: string }
  | { tipo: "exito" }
  | { tipo: "error"; motivo: MotivoFallo; titulo: string; mensaje: string; ofrecerReintentar: boolean };

export default function NuevaTarjetaScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { origen: origenParam } = useLocalSearchParams<{ origen?: string }>();
  const origen: "perfil" | "checkout" = origenParam === "checkout" ? "checkout" : "perfil";

  const cliente = useAuthStore((s) => s.cliente);

  // --- Formulario ---
  const [numero, setNumero] = useState("");
  const [vencimiento, setVencimiento] = useState("");
  const [cvc, setCvc] = useState("");
  const [titular, setTitular] = useState("");
  const [email, setEmail] = useState(cliente?.email ?? "");
  const [aceptaPrivacidad, setAceptaPrivacidad] = useState(false);
  const [aceptaDatos, setAceptaDatos] = useState(false);
  const [errores, setErrores] = useState<Record<string, string>>({});

  const numeroLimpio = soloDigitos(numero);
  const franquicia = detectarFranquiciaPorBin(numeroLimpio);

  const { data: tokensAceptacion } = useQuery({
    queryKey: ["tokens-aceptacion"],
    queryFn: getTokensAceptacion,
    staleTime: 5 * 60 * 1000,
  });

  // --- Máquina de estados del alta ---
  const [pantalla, setPantalla] = useState<EstadoPantalla>({ tipo: "formulario" });
  const [confirmarSalidaChallenge, setConfirmarSalidaChallenge] = useState(false);
  const [offline, setOffline] = useState(false);

  // Refs de control del ciclo de vida del polling — evitan setState sobre un
  // componente desmontado y evitan disparar dos pollings en paralelo.
  const montadoRef = useRef(true);
  const pollingActivoRef = useRef(false);
  const inicioProcesoRef = useRef<number | null>(null);
  const inicioOfflineRef = useRef<number | null>(null);
  const franquiciaConfirmadaRef = useRef<string>("");
  const challengeTrackeadoRef = useRef(false);
  const vioChallengeRef = useRef(false);
  const iniciadoTrackeadoRef = useRef(false);

  useEffect(() => {
    montadoRef.current = true;
    // Fuera de capturas/grabaciones mientras esta pantalla está viva —
    // número/cvc pasan por acá aunque nunca se persistan.
    ScreenCapture.preventScreenCaptureAsync().catch(() => {});
    return () => {
      montadoRef.current = false;
      pollingActivoRef.current = false;
      ScreenCapture.allowScreenCaptureAsync().catch(() => {});
    };
  }, []);

  useEffect(() => {
    if (iniciadoTrackeadoRef.current) return;
    iniciadoTrackeadoRef.current = true;
    tracker.track("tarjeta_guardado_iniciado", { origen }, "profile/metodos-pago/nueva");
  }, [origen]);

  // Back de Android durante el challenge: la misma pregunta que el botón X,
  // nunca un pop silencioso a mitad de autenticación.
  useEffect(() => {
    if (pantalla.tipo !== "challenge") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      setConfirmarSalidaChallenge(true);
      return true;
    });
    return () => sub.remove();
  }, [pantalla.tipo]);

  const validar = useCallback((): boolean => {
    const nuevos: Record<string, string> = {};
    if (numeroLimpio.length < 13 || numeroLimpio.length > 19) {
      nuevos.numero = "Número de tarjeta inválido";
    }
    const [mmStr, aaStr] = vencimiento.split("/");
    const mm = Number(mmStr);
    if (!mmStr || !aaStr || aaStr.length !== 2 || mm < 1 || mm > 12) {
      nuevos.vencimiento = "Vencimiento inválido";
    }
    if (cvc.length < 3 || cvc.length > 4) {
      nuevos.cvc = "CVC inválido";
    }
    if (!titular.trim()) {
      nuevos.titular = "Escribe el nombre como aparece en la tarjeta";
    }
    if (!REGEX_EMAIL.test(email.trim())) {
      nuevos.email = "Correo inválido";
    }
    if (!aceptaPrivacidad || !aceptaDatos) {
      nuevos.contratos = "Acepta los dos contratos de Wompi para continuar";
    }
    setErrores(nuevos);
    return Object.keys(nuevos).length === 0;
  }, [numeroLimpio, vencimiento, cvc, titular, email, aceptaPrivacidad, aceptaDatos]);

  // Mismo router.back() en los dos orígenes: desde "perfil" vuelve a Mis
  // tarjetas, desde "checkout" vuelve al carrito con la hoja de medio de pago
  // (fase 3) — ese lado ya deja "efectivo" como medio por defecto, así que no
  // hace falta que esta pantalla le mande nada explícito.
  const irAContraEntrega = useCallback(() => {
    router.back();
  }, [router]);

  const reportarFallo = useCallback(
    (motivo: MotivoFallo, paso: Paso, titulo: string, mensaje: string, ofrecerReintentar: boolean, err?: unknown) => {
      tracker.track(
        "tarjeta_guardado_fallido",
        { motivo, paso, franquicia: franquiciaConfirmadaRef.current || franquicia || "otra" },
        "profile/metodos-pago/nueva"
      );
      if (err && motivo === "error") {
        Sentry.captureException(err instanceof Error ? err : new Error(String(err)), {
          tags: { flow: "pago_tarjeta", paso },
        });
      }
      setPantalla({ tipo: "error", motivo, titulo, mensaje, ofrecerReintentar });
    },
    [franquicia]
  );

  const finalizarExito = useCallback(
    (brandFinal: string) => {
      const segundos = inicioProcesoRef.current ? Math.round((Date.now() - inicioProcesoRef.current) / 1000) : 0;
      tracker.track(
        "tarjeta_guardada",
        { franquicia: brandFinal || franquicia || "otra", con_3ds: vioChallengeRef.current, segundos },
        "profile/metodos-pago/nueva"
      );
      queryClient.invalidateQueries({ queryKey: ["metodos-pago"] });
      setPantalla({ tipo: "exito" });
      Toast.show({ type: "success", text1: "Tarjeta guardada" });
      setTimeout(() => {
        if (!montadoRef.current) return;
        router.back();
      }, 900);
    },
    [franquicia, queryClient, router]
  );

  const poll = useCallback(
    async (paymentSourceId: string) => {
      if (!montadoRef.current || !pollingActivoRef.current) return;

      // Timeout de 3 min: la tarjeta puede haber quedado guardada del lado
      // de Wompi — nunca decir "no se guardó".
      if (inicioProcesoRef.current && Date.now() - inicioProcesoRef.current > POLL_TIMEOUT_MS) {
        pollingActivoRef.current = false;
        reportarFallo(
          "timeout",
          "fuente",
          "Esto se está demorando",
          "Esto se está demorando más de lo normal. Revisa Mis tarjetas en un momento.",
          false
        );
        return;
      }

      try {
        const data = await getEstadoMetodoPago(paymentSourceId);
        if (!montadoRef.current || !pollingActivoRef.current) return;
        setOffline(false);
        inicioOfflineRef.current = null;

        if (data.metodo) {
          // AVAILABLE: el backend ya escribió la fila real sobre el placeholder.
          pollingActivoRef.current = false;
          finalizarExito(data.metodo.brand);
          return;
        }

        if (data.status === "DECLINED" || data.status === "ERROR") {
          pollingActivoRef.current = false;
          const sinIntentoDe3ds = !data.three_ds_auth || !data.three_ds_auth.current_step;
          if (sinIntentoDe3ds) {
            reportarFallo(
              "bin_sin_3ds",
              "fuente",
              "Tu banco no permite guardar esta tarjeta",
              "Tu banco no permite guardar esta tarjeta para pagos en la app. Puedes pagar contra entrega cuando llegue tu pedido.",
              false
            );
          } else {
            reportarFallo(
              "declinada",
              "fuente",
              "Tu banco rechazó la tarjeta",
              "Tu banco rechazó la tarjeta. Puedes intentar con otra o pagar contra entrega.",
              true
            );
          }
          return;
        }

        const paso3ds = data.three_ds_auth;
        if (paso3ds?.current_step_status === "ABANDONED") {
          pollingActivoRef.current = false;
          reportarFallo(
            "challenge_abandonado",
            "challenge",
            "No terminaste la confirmación",
            "No terminaste la confirmación de tu banco. La tarjeta no quedó guardada.",
            true
          );
          return;
        }

        const html = paso3ds?.three_ds_method_data ? desescaparHtml(paso3ds.three_ds_method_data) : null;
        if (paso3ds?.current_step === "CHALLENGE" && html) {
          vioChallengeRef.current = true;
          if (!challengeTrackeadoRef.current) {
            challengeTrackeadoRef.current = true;
            tracker.track(
              "tarjeta_3ds_challenge_mostrado",
              { franquicia: franquicia || "otra" },
              "profile/metodos-pago/nueva"
            );
          }
          setPantalla({ tipo: "challenge", html });
        } else if (paso3ds?.current_step === "BROWSER_INFO" || paso3ds?.current_step === "FINGERPRINT") {
          vioChallengeRef.current = true;
          // Invisible: el HTML que manda Wompi se autoenvía al banco solo.
          setPantalla({ tipo: "procesando", mensaje: "Verificando tu tarjeta…" });
        }

        // Siga en curso: reprogramar el siguiente poll.
        setTimeout(() => poll(paymentSourceId), POLL_INTERVAL_MS);
      } catch (err) {
        if (!montadoRef.current || !pollingActivoRef.current) return;
        // Red caída a mitad: no se abandona el polling, se reintenta con el
        // MISMO payment_source_id (nunca se crea una fuente nueva). A los
        // 30s seguidos sin respuesta se muestra el aviso offline.
        if (!inicioOfflineRef.current) inicioOfflineRef.current = Date.now();
        if (Date.now() - inicioOfflineRef.current > OFFLINE_AVISO_MS) {
          setOffline(true);
        }
        setTimeout(() => poll(paymentSourceId), POLL_INTERVAL_MS);
        void err;
      }
    },
    [finalizarExito, franquicia, reportarFallo]
  );

  const onGuardar = useCallback(async () => {
    if (!validar()) return;
    inicioProcesoRef.current = Date.now();
    setPantalla({ tipo: "procesando", mensaje: "Verificando tu tarjeta…" });

    const [mmStr, aaStr] = vencimiento.split("/");
    const datosTarjeta = {
      number: numeroLimpio,
      cvc,
      exp_month: mmStr.padStart(2, "0"),
      exp_year: aaStr,
      card_holder: titular.trim(),
    };

    try {
      const infoTokenizacion = await getLlaveTokenizacion();
      let token;
      try {
        const resultado = await tokenizarTarjeta(infoTokenizacion, datosTarjeta);
        token = resultado.id;
      } catch (err) {
        reportarFallo(
          "declinada",
          "token",
          "Tu banco rechazó la tarjeta",
          "Wompi no pudo procesar los datos de la tarjeta. Revisa el número, el vencimiento y el CVC.",
          true,
          err
        );
        return;
      }

      // Los datos de la tarjeta ya cumplieron su función (viajaron cifrados
      // dentro del JWE hacia Wompi) — no queda ninguna razón para conservarlos
      // en memoria un segundo más.
      datosTarjeta.number = "";
      datosTarjeta.cvc = "";

      const resp = await crearMetodoPago({
        token,
        customer_email: email.trim(),
        acceptance_token: tokensAceptacion?.acceptance_token ?? "",
        accept_personal_auth: tokensAceptacion?.accept_personal_auth ?? "",
      });

      if (resp.estado === "listo") {
        finalizarExito(resp.metodo.brand);
        return;
      }

      // 3DS en curso (o declinada de una, que también llega como "en_curso"
      // con status DECLINED — el primer poll lo resuelve).
      pollingActivoRef.current = true;
      poll(resp.payment_source_id);
    } catch (err) {
      const esRed = err instanceof Error && /sin conexión/i.test(err.message);
      reportarFallo(
        esRed ? "red" : "error",
        "fuente",
        "No se pudo guardar la tarjeta",
        esRed
          ? "Sin conexión. Revisa tu internet e intenta de nuevo."
          : "Algo falló guardando tu tarjeta. Intenta de nuevo en un momento.",
        true,
        err
      );
    }
  }, [validar, vencimiento, numeroLimpio, cvc, titular, email, tokensAceptacion, poll, reportarFallo, finalizarExito]);

  const cerrarPantalla = useCallback(() => {
    if (pantalla.tipo === "procesando") return; // campos bloqueados, sin salida
    if (pantalla.tipo === "challenge") {
      setConfirmarSalidaChallenge(true);
      return;
    }
    router.back();
  }, [pantalla.tipo, router]);

  const abandonarChallenge = useCallback(() => {
    pollingActivoRef.current = false;
    setConfirmarSalidaChallenge(false);
    reportarFallo(
      "challenge_abandonado",
      "challenge",
      "No terminaste la confirmación",
      "No terminaste la confirmación de tu banco. La tarjeta no quedó guardada.",
      true
    );
  }, [reportarFallo]);

  const abrirContrato = (cual: "privacidad" | "datos", url: string | null) => {
    if (!url) return;
    tracker.track("tarjeta_contratos_abiertos", { cual }, "profile/metodos-pago/nueva");
    Linking.openURL(url).catch(() => {});
  };

  const enviando = pantalla.tipo === "procesando";
  const cardStyleInput = {
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radii.input,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: fuentes.destacado,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: colors.lowfill,
  } as const;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Header propio: headerShown:false en el Stack (ver profile/_layout.tsx) */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingTop: insets.top + 12,
          paddingBottom: 16,
          paddingHorizontal: 16,
          backgroundColor: colors.bg,
          borderBottomWidth: 1,
          borderBottomColor: colors.line,
        }}
      >
        <Pressable
          onPress={cerrarPantalla}
          disabled={enviando}
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
          hitSlop={10}
          style={{ paddingRight: 16, opacity: enviando ? 0.3 : 1 }}
        >
          <Feather name="x" size={22} color={colors.ink} />
        </Pressable>
        <Text style={{ flex: 1, fontSize: 17, fontFamily: fuentes.destacado, color: colors.ink, textAlign: "center", marginRight: 38 }}>
          {pantalla.tipo === "challenge" ? "Tu banco está confirmando que eres tú" : "Guardar tarjeta"}
        </Text>
      </View>

      {pantalla.tipo === "formulario" && (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          {modoPruebasActivo() && (
            <View style={{ backgroundColor: "rgba(228,164,0,0.12)", borderRadius: 12, padding: 12, marginBottom: 16 }}>
              <Text style={{ fontFamily: fuentes.destacado, fontSize: 12.5, color: "#8A6400", lineHeight: 18 }}>
                Sandbox de Wompi — no se cobra plata real. Usa 4242 4242 4242 4242.
              </Text>
            </View>
          )}

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <Text style={{ fontSize: 12, fontFamily: fuentes.destacado, color: colors.muted, textTransform: "uppercase", letterSpacing: 1 }}>
              Número de tarjeta
            </Text>
            {franquicia !== "" && <LogoFranquicia brand={franquicia} size={28} />}
          </View>
          <TextInput
            value={numero}
            onChangeText={(t) => setNumero(formatearNumero(t))}
            placeholder="0000 0000 0000 0000"
            placeholderTextColor={colors.faint}
            keyboardType="number-pad"
            maxLength={23}
            autoComplete="off"
            autoCorrect={false}
            spellCheck={false}
            importantForAutofill="no"
            textContentType="none"
            style={[cardStyleInput, { marginBottom: errores.numero ? 4 : 12 }]}
          />
          {errores.numero && <Text style={{ color: colors.danger, fontSize: 12, fontFamily: fuentes.destacado, marginBottom: 12 }}>{errores.numero}</Text>}

          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, fontFamily: fuentes.destacado, color: colors.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
                Vence (MM/AA)
              </Text>
              <TextInput
                value={vencimiento}
                onChangeText={(t) => setVencimiento(formatearVencimiento(t))}
                placeholder="MM/AA"
                placeholderTextColor={colors.faint}
                keyboardType="number-pad"
                maxLength={5}
                autoComplete="off"
                autoCorrect={false}
                spellCheck={false}
                importantForAutofill="no"
                textContentType="none"
                style={[cardStyleInput, { marginBottom: errores.vencimiento ? 4 : 12 }]}
              />
              {errores.vencimiento && <Text style={{ color: colors.danger, fontSize: 12, fontFamily: fuentes.destacado, marginBottom: 12 }}>{errores.vencimiento}</Text>}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, fontFamily: fuentes.destacado, color: colors.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
                CVC
              </Text>
              <TextInput
                value={cvc}
                onChangeText={(t) => setCvc(soloDigitos(t).slice(0, 4))}
                placeholder="123"
                placeholderTextColor={colors.faint}
                keyboardType="number-pad"
                maxLength={4}
                secureTextEntry
                autoComplete="off"
                autoCorrect={false}
                spellCheck={false}
                importantForAutofill="no"
                textContentType="none"
                style={[cardStyleInput, { marginBottom: errores.cvc ? 4 : 12 }]}
              />
              {errores.cvc && <Text style={{ color: colors.danger, fontSize: 12, fontFamily: fuentes.destacado, marginBottom: 12 }}>{errores.cvc}</Text>}
            </View>
          </View>

          <Text style={{ fontSize: 12, fontFamily: fuentes.destacado, color: colors.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
            Nombre como aparece en la tarjeta
          </Text>
          <TextInput
            value={titular}
            onChangeText={setTitular}
            placeholder="JUAN PEREZ"
            placeholderTextColor={colors.faint}
            autoCapitalize="characters"
            autoComplete="off"
            autoCorrect={false}
            spellCheck={false}
            importantForAutofill="no"
            textContentType="none"
            style={[cardStyleInput, { marginBottom: errores.titular ? 4 : 12 }]}
          />
          {errores.titular && <Text style={{ color: colors.danger, fontSize: 12, fontFamily: fuentes.destacado, marginBottom: 12 }}>{errores.titular}</Text>}

          {!cliente?.email && (
            <>
              <Text style={{ fontSize: 12, fontFamily: fuentes.destacado, color: colors.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
                Correo (lo pide Wompi para el recibo)
              </Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="tucorreo@ejemplo.com"
                placeholderTextColor={colors.faint}
                keyboardType="email-address"
                autoCapitalize="none"
                style={[cardStyleInput, { marginBottom: errores.email ? 4 : 12 }]}
              />
              {errores.email && <Text style={{ color: colors.danger, fontSize: 12, fontFamily: fuentes.destacado, marginBottom: 12 }}>{errores.email}</Text>}
            </>
          )}

          <View style={{ marginTop: 8 }}>
            <CheckboxRow checked={aceptaPrivacidad} onToggle={() => setAceptaPrivacidad((v) => !v)} etiqueta="Acepto la política de privacidad de Wompi">
              <Text>
                Acepto la{" "}
                <Text
                  style={{ color: colors.greenInk, textDecorationLine: "underline" }}
                  onPress={() => abrirContrato("privacidad", tokensAceptacion?.permalink_acceptance ?? null)}
                >
                  política de privacidad
                </Text>{" "}
                de Wompi
              </Text>
            </CheckboxRow>
            <CheckboxRow checked={aceptaDatos} onToggle={() => setAceptaDatos((v) => !v)} etiqueta="Autorizo el tratamiento de mis datos personales">
              <Text>
                Autorizo el{" "}
                <Text
                  style={{ color: colors.greenInk, textDecorationLine: "underline" }}
                  onPress={() => abrirContrato("datos", tokensAceptacion?.permalink_personal_auth ?? null)}
                >
                  tratamiento de mis datos personales
                </Text>
              </Text>
            </CheckboxRow>
            {errores.contratos && <Text style={{ color: colors.danger, fontSize: 12, fontFamily: fuentes.destacado, marginTop: 8 }}>{errores.contratos}</Text>}
          </View>

          <Pressable
            onPress={onGuardar}
            accessibilityRole="button"
            accessibilityLabel="Guardar tarjeta"
            style={{ marginTop: 20, paddingVertical: 16, borderRadius: 16, alignItems: "center", backgroundColor: colors.green }}
          >
            <Text style={{ fontSize: 15.5, fontFamily: fuentes.destacado, color: "#fff" }}>Guardar tarjeta</Text>
          </Pressable>
          <Text style={{ fontSize: 12, color: colors.muted, fontFamily: fuentes.destacado, textAlign: "center", marginTop: 12, lineHeight: 17 }}>
            No guardamos el número de tu tarjeta. Lo guarda Wompi, la pasarela de pagos.
          </Text>
        </ScrollView>
      )}

      {enviando && (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
          <ActivityIndicator size="large" color={colors.green} />
          <Text style={{ marginTop: 16, fontSize: 15, fontFamily: fuentes.destacado, color: colors.ink, textAlign: "center" }}>
            {pantalla.tipo === "procesando" ? pantalla.mensaje : "Verificando tu tarjeta…"}
          </Text>
          {offline && (
            <View style={{ marginTop: 20, alignItems: "center" }}>
              <Text style={{ fontSize: 13, fontFamily: fuentes.destacado, color: colors.muted, textAlign: "center", marginBottom: 10 }}>
                Sin conexión. Seguimos intentando.
              </Text>
            </View>
          )}
          {/* WebView oculto para BROWSER_INFO/FINGERPRINT: existe pero no se ve. */}
        </View>
      )}

      {pantalla.tipo === "challenge" && (
        <>
          <WebView
            source={{ html: pantalla.html }}
            style={{ flex: 1 }}
            startInLoadingState
            renderLoading={() => (
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                <ActivityIndicator size="large" color={colors.green} />
              </View>
            )}
          />
          <Modal visible={confirmarSalidaChallenge} transparent animationType="fade">
            <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", padding: 24 }}>
              <View style={{ backgroundColor: "#fff", borderRadius: 20, padding: 20, width: "100%" }}>
                <Text style={{ fontSize: 16, fontFamily: fuentes.destacado, color: colors.ink, marginBottom: 8 }}>
                  ¿Seguro que quieres salir?
                </Text>
                <Text style={{ fontSize: 13.5, fontFamily: fuentes.destacado, color: colors.muted, marginBottom: 20, lineHeight: 19 }}>
                  Tu banco está confirmando que eres tú. Si sales ahora, la tarjeta no va a quedar guardada.
                </Text>
                <Pressable
                  onPress={() => setConfirmarSalidaChallenge(false)}
                  accessibilityRole="button"
                  style={{ paddingVertical: 14, borderRadius: 14, backgroundColor: colors.green, alignItems: "center", marginBottom: 8 }}
                >
                  <Text style={{ fontSize: 14.5, fontFamily: fuentes.destacado, color: "#fff" }}>Seguir esperando</Text>
                </Pressable>
                <Pressable onPress={abandonarChallenge} accessibilityRole="button" style={{ paddingVertical: 12, alignItems: "center" }}>
                  <Text style={{ fontSize: 14, fontFamily: fuentes.destacado, color: colors.danger }}>Salir de todas formas</Text>
                </Pressable>
              </View>
            </View>
          </Modal>
        </>
      )}

      {pantalla.tipo === "exito" && (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.greenTint, alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
            <Feather name="check" size={36} color={colors.green} />
          </View>
          <Text style={{ fontSize: 17, fontFamily: fuentes.destacado, color: colors.ink }}>Tarjeta guardada</Text>
        </View>
      )}

      {pantalla.tipo === "error" && (
        <View style={{ flex: 1, padding: 24, justifyContent: "center" }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: "rgba(220,38,38,0.1)", alignItems: "center", justifyContent: "center", marginBottom: 20, alignSelf: "center" }}>
            <Feather name="alert-circle" size={30} color={colors.danger} />
          </View>
          <Text style={{ fontSize: 19, fontFamily: fuentes.destacado, color: colors.ink, textAlign: "center", marginBottom: 10 }}>
            {pantalla.titulo}
          </Text>
          <Text style={{ fontSize: 14.5, fontFamily: fuentes.destacado, color: colors.muted, textAlign: "center", marginBottom: 28, lineHeight: 21 }}>
            {pantalla.mensaje}
          </Text>
          {pantalla.ofrecerReintentar && (
            <Pressable
              onPress={() => setPantalla({ tipo: "formulario" })}
              accessibilityRole="button"
              style={{ paddingVertical: 16, borderRadius: 16, backgroundColor: colors.green, alignItems: "center", marginBottom: 12 }}
            >
              <Text style={{ fontSize: 15, fontFamily: fuentes.destacado, color: "#fff" }}>Intentar de nuevo</Text>
            </Pressable>
          )}
          <Pressable
            onPress={irAContraEntrega}
            accessibilityRole="button"
            style={{ paddingVertical: 16, borderRadius: 16, backgroundColor: pantalla.ofrecerReintentar ? colors.lowfill : colors.green, alignItems: "center" }}
          >
            <Text style={{ fontSize: 15, fontFamily: fuentes.destacado, color: pantalla.ofrecerReintentar ? colors.ink : "#fff" }}>
              Pagar contra entrega
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
