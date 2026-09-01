import { ReactNode, useRef, useState } from "react";
import { View, Text, TextInput, Pressable, KeyboardTypeOptions, TextInputProps, Platform } from "react-native";
import { EyeIcon, EyeOffIcon } from "./icons/AppIcons";
import { colors, radii, fuentes } from "../constants/theme";

interface InputFieldProps {
  label: string;
  icon: ReactNode;
  placeholder: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: KeyboardTypeOptions;
  secureTextEntry?: boolean;
  showToggle?: boolean;
  onToggleSecure?: () => void;
  error?: string;
  onBlur?: () => void;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  returnKeyType?: "done" | "go" | "next" | "search" | "send";
  onSubmitEditing?: () => void;
  // Se exponen para que los campos que CREAN contraseña puedan declararse como
  // tales ante el gestor de contraseñas del sistema. Hasta hoy solo el campo de
  // login los tenia (login.tsx usa su propio TextInput), asi que iOS y Android
  // podian AUTOCOMPLETAR una contraseña existente pero nunca ofrecian GUARDAR
  // la recien creada. Esa es la raiz de "no me acuerdo de mi contraseña": la
  // persona se inventa una en el registro, el telefono no se la guarda, y una
  // semana despues —cuando expira la sesion— tiene que recordarla de memoria.
  textContentType?: TextInputProps["textContentType"];
  autoComplete?: TextInputProps["autoComplete"];
}

export function InputField({
  label,
  icon,
  placeholder,
  value,
  onChangeText,
  keyboardType = "default",
  secureTextEntry = false,
  showToggle = false,
  onToggleSecure,
  error,
  onBlur,
  autoCapitalize,
  returnKeyType,
  onSubmitEditing,
  textContentType,
  autoComplete,
}: InputFieldProps) {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  // Un campo de contraseña NUNCA se capitaliza ni se autocorrige. El default
  // "words" de abajo es correcto para nombres y direcciones, pero sobre una
  // contraseña la rompe en silencio: el teclado le mete mayuscula a la primera
  // letra AL CREARLA (registro y reset usan este componente) mientras que
  // login.tsx tiene su propio TextInput con autoCapitalize="none". La persona
  // guarda "Susana123" creyendo que puso "susana123" y despues no puede entrar,
  // con el mensaje "Teléfono o contraseña incorrectos" apuntando al lado
  // equivocado. Encontrado el 31-ago-2026 con una clienta que fallo 4 intentos
  // seguidos y se rindio. `showToggle` cuenta como contraseña: con el ojito
  // abierto el campo es texto normal y el teclado capitaliza a la vista.
  const esPassword = secureTextEntry || showToggle;
  // ANDROID: con el ojito ABIERTO no basta `autoCapitalize="none"` ni
  // `autoCorrect={false}`. Gboard mantiene la palabra EN COMPOSICION (subrayada,
  // con la tira de sugerencias activa) y al confirmarla —basta con tocar otro
  // campo— la sustituye por la sugerencia resaltada. Escribir `hola` y pasar al
  // campo siguiente deja `Hola ` en el campo: mayuscula inicial Y espacio final.
  //
  // Es el mismo desenlace que el defecto original (la persona guarda una
  // contraseña distinta de la que escribio y despues no puede entrar) por un
  // camino distinto, y por eso el primer arreglo no lo tapaba. Se descubrio el
  // 31-ago-2026 con un explorador que escribio una contraseña de solo letras;
  // la prueba manual habia usado `susana123`, y con digitos Gboard no ofrece
  // sustitucion — por eso paso limpia.
  //
  // `visible-password` mapea a TYPE_TEXT_VARIATION_VISIBLE_PASSWORD, que es el
  // tipo de campo que Gboard SI respeta para apagar sugerencias y composicion.
  // Solo en Android: en iOS no existe ese tipo y el campo seguro ya no compone.
  const keyboardTypeFinal: KeyboardTypeOptions =
    esPassword && !secureTextEntry && Platform.OS === "android"
      ? "visible-password"
      : keyboardType;

  const autoCapitalizeFinal =
    autoCapitalize ??
    (esPassword || keyboardType === "phone-pad" || keyboardType === "email-address"
      ? "none"
      : "words");

  // Asegurar foco explicito al tocar cualquier parte del campo (no solo el TextInput).
  // Sin esto, en algunos casos (sin border/shadow visibles) iOS no detecta correctamente
  // el TextInput como target de tap.
  const focusInput = () => inputRef.current?.focus();

  return (
    <View style={{ marginBottom: 12 }}>
      <Text
        style={{
          fontSize: 12,
          fontFamily: fuentes.destacado,
          color: colors.muted,
          textTransform: "uppercase",
          letterSpacing: 1,
          marginLeft: 16,
          marginBottom: 4,
        }}
      >
        {label}
      </Text>
      <Pressable
        onPress={focusInput}
        accessibilityRole="button"
        accessibilityLabel={`Escribir en el campo ${label}`}
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: focused || error ? colors.surface : colors.lowfill,
          borderRadius: radii.input,
          paddingHorizontal: 18,
          paddingVertical: 14,
          borderWidth: error ? 1 : 1.5,
          borderColor: error ? colors.danger : focused ? colors.green : colors.line,
          shadowColor: focused && !error ? colors.green : "transparent",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: focused && !error ? 0.1 : 0,
          shadowRadius: 16,
          elevation: focused && !error ? 3 : 0,
        }}
      >
        <View style={{ marginRight: 12 }}>{icon}</View>
        <TextInput
          // REMONTAJE AL ALTERNAR EL OJITO. Android fija el `inputType` del campo
          // al crearlo; cambiar `secureTextEntry` sobre el MISMO campo montado no
          // lo reaplica, asi que `visible-password` de abajo no llegaba a surtir
          // efecto y Gboard seguia componiendo y sustituyendo la palabra.
          key={esPassword ? (secureTextEntry ? "oculta" : "visible") : "normal"}
          ref={inputRef}
          style={{ flex: 1, fontFamily: fuentes.destacado, fontSize: 16, color: colors.ink }}
          placeholder={placeholder}
          placeholderTextColor={colors.faint}
          keyboardType={keyboardTypeFinal}
          secureTextEntry={secureTextEntry}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => { setFocused(false); onBlur?.(); }}
          autoCapitalize={autoCapitalizeFinal}
          autoCorrect={!esPassword}
          spellCheck={!esPassword}
          textContentType={textContentType}
          autoComplete={autoComplete}
          returnKeyType={returnKeyType ?? "next"}
          onSubmitEditing={onSubmitEditing}
        />
        {showToggle && onToggleSecure && (
          <Pressable
            onPress={onToggleSecure}
            hitSlop={13}
            accessibilityLabel={secureTextEntry ? "Mostrar contraseña" : "Ocultar contraseña"}
            accessibilityRole="button"
          >
            {secureTextEntry
              ? <EyeIcon color={colors.muted} size={18} />
              : <EyeOffIcon color={colors.muted} size={18} />}
          </Pressable>
        )}
      </Pressable>
      {error ? (
        <Text
          style={{
            fontSize: 12,
            color: colors.danger,
            fontFamily: fuentes.destacado,
            marginLeft: 16,
            marginTop: 4,
          }}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}
