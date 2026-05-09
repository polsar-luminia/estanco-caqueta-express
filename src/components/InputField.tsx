import { ReactNode, useRef, useState } from "react";
import { View, Text, TextInput, Pressable, KeyboardTypeOptions } from "react-native";
import { EyeIcon, EyeOffIcon } from "./icons/AppIcons";

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
}: InputFieldProps) {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const autoCapitalizeFinal =
    autoCapitalize ??
    (keyboardType === "phone-pad" || keyboardType === "email-address" ? "none" : "words");

  // Asegurar foco explicito al tocar cualquier parte del campo (no solo el TextInput).
  // Sin esto, en algunos casos (sin border/shadow visibles) iOS no detecta correctamente
  // el TextInput como target de tap.
  const focusInput = () => inputRef.current?.focus();

  return (
    <View style={{ marginBottom: 12 }}>
      <Text
        style={{
          fontSize: 10,
          fontWeight: "700",
          color: "#6D7B6C",
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
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: focused || error ? "#FFFFFF" : "#F4F4F0",
          borderRadius: 999,
          paddingHorizontal: 20,
          paddingVertical: 14,
          borderWidth: error ? 1 : focused ? 1.5 : 0,
          borderColor: error ? "#D33587" : focused ? "#1FAF55" : "transparent",
          shadowColor: focused && !error ? "#1FAF55" : "transparent",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: focused && !error ? 0.10 : 0,
          shadowRadius: 16,
          elevation: focused && !error ? 3 : 0,
        }}
      >
        <View style={{ marginRight: 12 }}>{icon}</View>
        <TextInput
          ref={inputRef}
          style={{ flex: 1, fontSize: 16, color: "#1A1C1A" }}
          placeholder={placeholder}
          placeholderTextColor="#BCCABA"
          keyboardType={keyboardType}
          secureTextEntry={secureTextEntry}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => { setFocused(false); onBlur?.(); }}
          autoCapitalize={autoCapitalizeFinal}
          returnKeyType={returnKeyType ?? "next"}
          onSubmitEditing={onSubmitEditing}
        />
        {showToggle && onToggleSecure && (
          <Pressable
            onPress={onToggleSecure}
            hitSlop={8}
            accessibilityLabel={secureTextEntry ? "Mostrar contraseña" : "Ocultar contraseña"}
            accessibilityRole="button"
          >
            {secureTextEntry
              ? <EyeIcon color="#6D7B6C" size={18} />
              : <EyeOffIcon color="#6D7B6C" size={18} />}
          </Pressable>
        )}
      </Pressable>
      {error ? (
        <Text
          style={{
            fontSize: 11,
            color: "#D33587",
            fontWeight: "500",
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
