import { useState, useRef, useEffect } from "react";
import { View, Text, Pressable, ScrollView, KeyboardAvoidingView, Platform, Image, Alert, Linking } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Link, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Toast from "react-native-toast-message";
import * as Sentry from "@sentry/react-native";
import { useAuthStore } from "../../src/stores/auth";
import { solicitarCodigoRegistro, type ApiError } from "../../src/lib/api";
import { aplicarModoPorTelefono } from "../../src/lib/backendPruebas";
import { tracker } from "../../src/lib/tracker";
import { metaLogRegistration } from "../../src/lib/metaEvents";
import { DateValue, toISODate, calcularEdad } from "../../src/components/DateSelector";
import { InputField } from "../../src/components/InputField";
import { UserIcon, PhoneIcon, LockIcon } from "../../src/components/icons/AppIcons";
import { colors, shadows, fuentes } from "../../src/constants/theme";

export default function RegisterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [aceptaMercadeo, setAceptaMercadeo] = useState(false);
  const [fecha, setFecha] = useState<DateValue>({});
  // Campo único DD/MM/AAAA con auto-formato (reemplaza los 3 selectores con modal)
  const [fechaTexto, setFechaTexto] = useState("");
  const [errorFecha, setErrorFecha] = useState("");
  const [loading, setLoading] = useState(false);
  const register = useAuthStore((s) => s.register);
  const submittingRef = useRef(false);

  // Paso 2 — verificación del teléfono por OTP. El formulario NO se desmonta
  // (mismo screen, dos pasos): "cambiar número" conserva todo lo escrito y la
  // contraseña nunca viaja por params de navegación.
  const [paso, setPaso] = useState<"formulario" | "codigo">("formulario");
  // Por dónde salió el código de verdad: WhatsApp, o SMS si la WABA falló. El
  // copy depende de esto — decir "revisa WhatsApp" cuando llegó por SMS confunde.
  const [canal, setCanal] = useState<"whatsapp" | "sms">("whatsapp");
  const [codigo, setCodigo] = useState("");
  const [errorCodigo, setErrorCodigo] = useState("");
  const [cooldownSegundos, setCooldownSegundos] = useState(0);
  const [reenviando, setReenviando] = useState(false);
  const reenviandoRef = useRef(false);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cooldown 30 s del reenvío (cada envío cuesta). El servidor tiene su propio
  // cooldown de 60 s con replay idempotente: reenviar a los 30 devuelve el MISMO
  // código vigente con 200, así que nunca se le muestra un error al usuario.
  const iniciarCooldown = () => {
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    setCooldownSegundos(30);
    cooldownRef.current = setInterval(() => {
      setCooldownSegundos((s) => {
        if (s <= 1) { clearInterval(cooldownRef.current!); cooldownRef.current = null; return 0; }
        return s - 1;
      });
    }, 1000);
  };
  useEffect(() => () => { if (cooldownRef.current) clearInterval(cooldownRef.current); }, []);

  // Errores de validación en tiempo real (onBlur)
  const [errorNombre, setErrorNombre] = useState("");
  const [errorTelefono, setErrorTelefono] = useState("");
  const [errorPassword, setErrorPassword] = useState("");

  const validarNombre = () => {
    if (nombre.trim().length < 2) {
      setErrorNombre("Ingresa tu nombre completo");
    } else {
      setErrorNombre("");
    }
  };

  const validarTelefono = () => {
    if (!telefono.trim()) {
      setErrorTelefono("");
      return;
    }
    if (!/^\d{10}$/.test(telefono.trim())) {
      setErrorTelefono("10 dígitos sin +57");
    } else {
      setErrorTelefono("");
    }
  };

  const validarPassword = () => {
    if (!password) {
      setErrorPassword("");
      return;
    }
    if (password.length < 8) {
      setErrorPassword("Mínimo 8 caracteres");
    } else {
      setErrorPassword("");
    }
  };

  // Auto-formato DD/MM/AAAA: inserta las barras mientras escribe y valida
  // fecha + edad apenas completa los 8 dígitos.
  const handleFechaChange = (text: string) => {
    const digits = text.replace(/\D/g, "").slice(0, 8);
    let out = digits;
    if (digits.length > 4) out = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    else if (digits.length > 2) out = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    setFechaTexto(out);

    if (digits.length === 8) {
      const v: DateValue = {
        day: Number(digits.slice(0, 2)),
        month: Number(digits.slice(2, 4)),
        year: Number(digits.slice(4)),
      };
      if (!toISODate(v)) {
        setErrorFecha("Fecha inválida (DD/MM/AAAA)");
        setFecha({});
        return;
      }
      const edad = calcularEdad(v);
      if (edad === null || edad < 18) {
        setErrorFecha("Debes tener 18 años o más");
        setFecha({});
        return;
      }
      setErrorFecha("");
      setFecha(v);
    } else {
      setFecha({});
      setErrorFecha("");
    }
  };

  // Diálogo "número ya registrado": acciones directas en vez de toast seco — el
  // usuario suele no saber que ya tenía cuenta (ej. pruebas previas) y se atasca
  // intentando adivinar contraseñas.
  const alertaYaRegistrado = () => {
    tracker.track('registro_codigo_fallido', { motivo: 'telefono_ya_registrado' }, 'register');
    Alert.alert(
      "Este número ya tiene cuenta",
      "Parece que ya te habías registrado con este teléfono. ¿Qué quieres hacer?",
      [
        { text: "Iniciar sesión", onPress: () => router.push("/(auth)/login") },
        { text: "Recuperar contraseña", onPress: () => router.push("/(auth)/forgot-password") },
        { text: "Cancelar", style: "cancel" },
      ],
    );
  };

  const esYaRegistrado = (msg: string) =>
    /ya tiene una cuenta|ya está registrado|Ya existe una cuenta/i.test(msg);

  // Paso 1 → 2: valida el formulario y manda el código de verificación. La
  // cuenta NO se crea aquí — solo al verificar el código en handleCrearCuenta.
  const handleContinuar = async () => {
    if (submittingRef.current) return;
    if (!nombre || !telefono || !password) {
      Toast.show({ type: "error", text1: "Completa todos los campos" });
      return;
    }
    if (!/^\d{10}$/.test(telefono.trim())) {
      Toast.show({ type: "error", text1: "Teléfono inválido", text2: "10 dígitos sin +57 (ej: 3001234567)" });
      return;
    }
    if (password.length < 8) {
      Toast.show({ type: "error", text1: "Contraseña muy corta", text2: "Mínimo 8 caracteres" });
      return;
    }
    const iso = toISODate(fecha);
    if (!iso) {
      Toast.show({ type: "error", text1: "Fecha de nacimiento inválida", text2: "Escríbela como DD/MM/AAAA (ej: 15/03/1995)" });
      return;
    }
    const edad = calcularEdad(fecha);
    if (edad === null || edad < 18) {
      Toast.show({ type: "error", text1: "Debes tener 18 años o más para registrarte" });
      return;
    }
    submittingRef.current = true;
    setLoading(true);
    try {
      // Numero de prueba -> staging desde el primer paso del registro.
      await aplicarModoPorTelefono(telefono);
      const res = await solicitarCodigoRegistro(telefono.trim());
      tracker.track('registro_codigo_solicitado', { canal: res.canal }, 'register');
      setCanal(res.canal);
      setCodigo("");
      setErrorCodigo("");
      setPaso("codigo");
      iniciarCooldown();
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      const msg = apiErr instanceof Error ? apiErr.message : "No se pudo enviar el código";
      if (apiErr?.status === 409 || esYaRegistrado(msg)) {
        alertaYaRegistrado();
      } else if (apiErr?.status === 503) {
        // WhatsApp Y SMS caídos: sin código no hay registro. La salida es soporte.
        tracker.track('registro_codigo_fallido', { motivo: 'envio_fallido' }, 'register');
        const soporteUrl = apiErr.body?.soporte_url;
        Alert.alert(
          "No pudimos enviarte el código",
          msg,
          soporteUrl
            ? [
                { text: "Escríbenos por WhatsApp", onPress: () => Linking.openURL(soporteUrl) },
                { text: "Cancelar", style: "cancel" },
              ]
            : [{ text: "Entendido" }],
        );
      } else if (apiErr?.status === 429) {
        tracker.track('registro_codigo_fallido', { motivo: 'limite_alcanzado' }, 'register');
        Toast.show({ type: "error", text1: "Demasiados intentos", text2: msg });
      } else {
        tracker.track('registro_codigo_fallido', { motivo: 'envio_fallido' }, 'register');
        Sentry.captureException(apiErr instanceof Error ? apiErr : new Error(msg), { tags: { flow: "auth", screen: "register" } });
        Toast.show({ type: "error", text1: "No pudimos enviarte el código", text2: msg });
      }
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  // Paso 2: verifica el código y crea la cuenta en la misma llamada. Al éxito,
  // el guard de (auth)/_layout encadena solo a edad-confirmar → dirección.
  const handleCrearCuenta = async () => {
    if (submittingRef.current) return;
    if (!/^\d{6}$/.test(codigo.trim())) {
      setErrorCodigo("Debe ser exactamente 6 dígitos");
      return;
    }
    const iso = toISODate(fecha);
    if (!iso) {
      // No debería pasar (el paso 1 ya validó), pero mejor rebotar al formulario
      // que mandar un registro inválido.
      setPaso("formulario");
      return;
    }
    submittingRef.current = true;
    setLoading(true);
    try {
      await register(telefono.trim(), nombre.trim(), password, iso, aceptaMercadeo, codigo.trim());
      tracker.track('registro_codigo_verificado', {}, 'register');
      tracker.track('registro_completado', { telefono_verificado: true }, 'register');
      tracker.track('consentimiento_mercadeo_cambiado', { otorgado: aceptaMercadeo, origen: 'registro' }, 'register');
      metaLogRegistration();
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      const msg = apiErr instanceof Error ? apiErr.message : "No se pudo crear la cuenta";
      if (apiErr?.status === 409 || esYaRegistrado(msg)) {
        // Carrera: alguien registró el número entre el paso 1 y este. El backend
        // hizo ROLLBACK, así que el código sigue vigente si quiere reintentar.
        alertaYaRegistrado();
      } else if (/inválido|expirado/i.test(msg)) {
        // Error inline bajo el input, no toast: el usuario está mirando el campo
        // y tiene "Reenviar código" a un tap.
        tracker.track('registro_codigo_fallido', { motivo: 'codigo_invalido' }, 'register');
        setErrorCodigo("Código inválido o expirado. Revisa el mensaje o pide uno nuevo.");
      } else {
        Sentry.captureException(apiErr instanceof Error ? apiErr : new Error(msg), { tags: { flow: "auth", screen: "register" } });
        Toast.show({ type: "error", text1: "No pudimos crear tu cuenta", text2: msg });
      }
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  const handleReenviar = async () => {
    if (reenviandoRef.current || cooldownSegundos > 0) return;
    reenviandoRef.current = true;
    setReenviando(true);
    try {
      const res = await solicitarCodigoRegistro(telefono.trim());
      tracker.track('registro_codigo_reenviado', { canal: res.canal }, 'register');
      setCanal(res.canal);
      Toast.show({
        type: "success",
        text1: "Código reenviado",
        text2: res.canal === "sms" ? "Revisa tus mensajes SMS en unos segundos" : "Revisa tu WhatsApp en unos segundos",
      });
      iniciarCooldown();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Intenta de nuevo";
      Toast.show({ type: "error", text1: "No se pudo reenviar", text2: msg });
    } finally {
      reenviandoRef.current = false;
      setReenviando(false);
    }
  };

  // "¿Número equivocado?" — vuelve al formulario con TODO lo escrito intacto.
  // Los códigos ya enviados al número anterior expiran solos en 15 min.
  const volverAlFormulario = () => {
    setPaso("formulario");
    setCodigo("");
    setErrorCodigo("");
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, position: "relative" }}>
      {/* Glow verde — top left */}
      <View style={{
        position: "absolute", top: -80, left: -50,
        width: 240, height: 240, borderRadius: 120,
        backgroundColor: "rgba(31,175,85,0.07)",
      }} />
      {/* Glow pink — bottom right */}
      <View style={{
        position: "absolute", bottom: 60, right: -50,
        width: 200, height: 200, borderRadius: 100,
        backgroundColor: "rgba(211,53,135,0.05)",
      }} />

      {/* Botón Volver — guest browsing. En el paso del código vuelve al
          formulario (con todo lo escrito), no al catálogo. */}
      <Pressable
        onPress={() => {
          if (paso === "codigo") { volverAlFormulario(); return; }
          if (router.canGoBack()) router.back();
          else router.replace("/(tabs)");
        }}
        hitSlop={12}
        style={{
          position: "absolute",
          top: insets.top + 8,
          left: 16,
          zIndex: 10,
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          paddingHorizontal: 12,
          paddingVertical: 8,
          backgroundColor: "rgba(255,255,255,0.75)",
          borderRadius: 999,
          borderWidth: 1,
          borderColor: "rgba(226,227,223,0.6)",
        }}
        accessibilityRole="button"
        accessibilityLabel="Volver"
      >
        <Feather name="chevron-left" size={20} color={colors.ink} />
        <Text style={{ fontSize: 14, fontFamily: fuentes.destacado, color: colors.ink }}>
          Volver
        </Text>
      </Pressable>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0}
        style={{ flex: 1 }}
      >
        <ScrollView automaticallyAdjustKeyboardInsets keyboardDismissMode="interactive"
          contentContainerStyle={{ padding: 24, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo zone */}
          <View style={{ alignItems: "center", paddingTop: 40, paddingBottom: 24 }}>
            <Image
              source={require("../../assets/logo-estanco.png")}
              style={{ width: 200, height: 48 }}
              resizeMode="contain"
            />
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 }}>
              <View style={{ width: 16, height: 1, backgroundColor: colors.line }} />
              <Text style={{ fontFamily: fuentes.destacado, fontSize: 12, color: colors.faint }}>Crea tu cuenta gratis</Text>
              <View style={{ width: 16, height: 1, backgroundColor: colors.line }} />
            </View>
          </View>

          {paso === "formulario" ? (<>
          {/* Form */}
          <InputField
            label="Nombre Completo"
            icon={<UserIcon color={colors.muted} size={18} />}
            placeholder="Ej. Juan Pérez"
            value={nombre}
            onChangeText={setNombre}
            onBlur={validarNombre}
            error={errorNombre}
          />
          <InputField
            label="Número de Teléfono"
            icon={<PhoneIcon color={colors.muted} size={18} />}
            placeholder="+57 300 000 0000"
            value={telefono}
            onChangeText={setTelefono}
            keyboardType="phone-pad"
            onBlur={validarTelefono}
            error={errorTelefono}
          />
          <InputField
            label="Contraseña"
            icon={<LockIcon color={colors.muted} size={18} />}
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPass}
            showToggle
            onToggleSecure={() => setShowPass(!showPass)}
            onBlur={validarPassword}
            error={errorPassword}
          />

          {/* Fecha de nacimiento — un solo campo con auto-formato */}
          <InputField
            label="Fecha de Nacimiento"
            icon={<Feather name="calendar" size={18} color={colors.muted} />}
            placeholder="DD/MM/AAAA"
            value={fechaTexto}
            onChangeText={handleFechaChange}
            keyboardType="number-pad"
            error={errorFecha}
          />

          {/* Mercadeo: casilla APARTE y DESMARCADA por defecto.
              Aparte, porque no se puede condicionar el servicio a aceptar publicidad:
              crear la cuenta y recibir ofertas son dos decisiones distintas.
              Desmarcada, porque una casilla premarcada no es una autorizacion expresa
              — es una que el usuario no tomo. Si no la toca, no se manda nada. */}
          <Pressable
            onPress={() => setAceptaMercadeo((v) => !v)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: aceptaMercadeo }}
            accessibilityLabel="Quiero recibir ofertas y promociones por WhatsApp y notificaciones"
            hitSlop={8}
            style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, marginTop: 18, paddingHorizontal: 4 }}
          >
            <View
              style={{
                width: 22, height: 22, borderRadius: 6, marginTop: 1,
                borderWidth: 2,
                borderColor: aceptaMercadeo ? colors.green : colors.muted,
                backgroundColor: aceptaMercadeo ? colors.green : "transparent",
                alignItems: "center", justifyContent: "center",
              }}
            >
              {aceptaMercadeo && <Feather name="check" size={14} color="#fff" />}
            </View>
            <Text style={{ flex: 1, fontFamily: fuentes.destacado, fontSize: 12.5, color: colors.muted, lineHeight: 17 }}>
              Quiero recibir ofertas y promociones por WhatsApp y notificaciones.{" "}
              <Text style={{ color: colors.faint }}>
                Opcional — puedes cambiarlo cuando quieras desde tu perfil.
              </Text>
            </Text>
          </Pressable>

          {/* Aceptación implícita de políticas: el toque en "Crear Cuenta" es la
              aceptación expresa (patrón estándar; reemplaza los 2 checkboxes). */}
          <Text style={{ fontFamily: fuentes.destacado, fontSize: 12.5, color: colors.muted, textAlign: "center", marginTop: 12, lineHeight: 17, paddingHorizontal: 8 }}>
            Al crear tu cuenta aceptas los{" "}
            <Text
              style={{ color: colors.green, fontFamily: fuentes.destacado }}
              onPress={() => router.push("/support/terms")}
              accessibilityRole="link"
              accessibilityLabel="Leer los Términos y Condiciones"
            >
              Términos y Condiciones
            </Text>
            {" "}y autorizas el{" "}
            <Text
              style={{ color: colors.green, fontFamily: fuentes.destacado }}
              onPress={() => router.push("/support/privacy")}
              accessibilityRole="link"
              accessibilityLabel="Leer la política de Tratamiento de Datos"
            >
              Tratamiento de tus Datos
            </Text>
            .
          </Text>

          {/* CTA — Continuar: manda el código de verificación. La cuenta se
              crea en el paso 2, con el código puesto. */}
          <Pressable
            onPress={handleContinuar}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Continuar y verificar número"
            accessibilityState={{ disabled: loading }}
            style={{ marginTop: 14 }}
          >
            <LinearGradient
              colors={loading ? [colors.faint, "#757575"] : [colors.green, colors.greenDeep]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                borderRadius: 14,
                paddingVertical: 16,
                alignItems: "center",
                justifyContent: "center",
                ...(loading ? {} : shadows.greenBtn),
              }}
            >
              <Text style={{ color: colors.white, fontFamily: fuentes.destacado, fontSize: 17 }}>
                {loading ? "Enviando código..." : "Continuar"}
              </Text>
            </LinearGradient>
          </Pressable>

          {/* Footer — link a login */}
          <View style={{ alignItems: "center", marginTop: 16 }}>
            <View style={{ flexDirection: "row" }}>
              <Text style={{ color: colors.muted, fontFamily: fuentes.destacado, fontSize: 13 }}>¿Ya tienes una cuenta? </Text>
              <Link href="/(auth)/login" asChild>
                <Pressable
                  accessibilityRole="link"
                  accessibilityLabel="Iniciar sesión con una cuenta existente"
                  hitSlop={16}
                >
                  <Text style={{ color: colors.offer, fontSize: 13, fontFamily: fuentes.destacado }}>Inicia sesión</Text>
                </Pressable>
              </Link>
            </View>
          </View>
          </>) : (<>
          {/* Paso 2 — verificación del número por código */}
          <View style={{ alignItems: "center", marginBottom: 18, paddingHorizontal: 8 }}>
            <Text style={{ fontSize: 18, fontFamily: fuentes.destacado, color: colors.ink, marginBottom: 6 }}>
              Verifica tu número
            </Text>
            <Text style={{ fontFamily: fuentes.destacado, fontSize: 13.5, color: colors.muted, textAlign: "center", lineHeight: 19 }}>
              Te enviamos un código de 6 dígitos por{" "}
              <Text style={{ fontFamily: fuentes.destacado, color: colors.ink }}>
                {canal === "sms" ? "SMS" : "WhatsApp"}
              </Text>{" "}
              al <Text style={{ fontFamily: fuentes.destacado, color: colors.ink }}>{telefono.trim()}</Text>.
            </Text>
          </View>

          <InputField
            label="Código de verificación"
            icon={<Feather name="message-circle" size={18} color={colors.muted} />}
            placeholder="000000"
            value={codigo}
            onChangeText={(t: string) => { setCodigo(t.replace(/\D/g, "").slice(0, 6)); if (errorCodigo) setErrorCodigo(""); }}
            keyboardType="number-pad"
            error={errorCodigo}
          />

          {/* CTA — Crear Cuenta (verifica el código y registra) */}
          <Pressable
            onPress={handleCrearCuenta}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Crear cuenta"
            accessibilityState={{ disabled: loading }}
            style={{ marginTop: 14 }}
          >
            <LinearGradient
              colors={loading ? [colors.faint, "#757575"] : [colors.green, colors.greenDeep]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                borderRadius: 14,
                paddingVertical: 16,
                alignItems: "center",
                justifyContent: "center",
                ...(loading ? {} : shadows.greenBtn),
              }}
            >
              <Text style={{ color: colors.white, fontFamily: fuentes.destacado, fontSize: 17 }}>
                {loading ? "Creando cuenta..." : "Crear Cuenta"}
              </Text>
            </LinearGradient>
          </Pressable>

          {/* Reenviar con cooldown */}
          <Pressable
            onPress={handleReenviar}
            disabled={reenviando || cooldownSegundos > 0}
            accessibilityRole="button"
            accessibilityLabel="Reenviar código de verificación"
            accessibilityState={{ disabled: reenviando || cooldownSegundos > 0 }}
            hitSlop={8}
            style={{ alignItems: "center", marginTop: 18 }}
          >
            <Text style={{
              fontSize: 13.5, fontFamily: fuentes.destacado,
              color: cooldownSegundos > 0 ? colors.faint : colors.green,
            }}>
              {cooldownSegundos > 0
                ? `Reenviar código (${cooldownSegundos}s)`
                : reenviando ? "Reenviando..." : "Reenviar código"}
            </Text>
          </Pressable>

          {/* Cambiar número — vuelve al formulario con todo intacto */}
          <Pressable
            onPress={volverAlFormulario}
            accessibilityRole="button"
            accessibilityLabel="Corregir el número de teléfono"
            hitSlop={8}
            style={{ alignItems: "center", marginTop: 14 }}
          >
            <Text style={{ fontFamily: fuentes.destacado, fontSize: 13, color: colors.muted }}>
              ¿Número equivocado? <Text style={{ color: colors.offer, fontFamily: fuentes.destacado }}>Corrígelo</Text>
            </Text>
          </Pressable>
          </>)}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
