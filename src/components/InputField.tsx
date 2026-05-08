import { ReactNode } from "react";
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
  const autoCapitalizeFinal =
    autoCapitalize ??
    (keyboardType === "phone-pad" || keyboardType === "email-address" ? "none" : "words");

  return (
    <View style={{ gap: 4, marginBottom: 12 }}>
      <Text
        style={{
          fontSize: 10,
          fontWeight: "700",
          color: "#6D7B6C",
          textTransform: "uppercase",
          letterSpacing: 1,
          marginLeft: 16,
        }}
      >
        {label}
      </Text>
      <View
        className="flex-row items-center"
        style={{
          backgroundColor: "#F4F4F0",
          borderRadius: 999,
          paddingHorizontal: 20,
          paddingVertical: 14,
          borderWidth: error ? 1 : 0,
          borderColor: error ? "#D33587" : "transparent",
        }}
      >
        <View style={{ marginRight: 12 }}>{icon}</View>
        <TextInput
          className="flex-1 text-base"
          style={{ color: "#1A1C1A" }}
          placeholder={placeholder}
          placeholderTextColor="#BCCABA"
          keyboardType={keyboardType}
          secureTextEntry={secureTextEntry}
          value={value}
          onChangeText={onChangeText}
          onBlur={onBlur}
          autoCapitalize={autoCapitalizeFinal}
          returnKeyType={returnKeyType ?? "next"}
          onSubmitEditing={onSubmitEditing}
        />
        {showToggle && onToggleSecure && (
          <Pressable
            onPress={onToggleSecure}
            accessibilityLabel={secureTextEntry ? "Mostrar contraseña" : "Ocultar contraseña"}
            accessibilityRole="button"
          >
            {secureTextEntry
              ? <EyeIcon color="#6D7B6C" size={18} />
              : <EyeOffIcon color="#6D7B6C" size={18} />}
          </Pressable>
        )}
      </View>
      {error ? (
        <Text
          style={{
            fontSize: 11,
            color: "#D33587",
            fontWeight: "500",
            marginLeft: 16,
            marginTop: 2,
          }}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}
