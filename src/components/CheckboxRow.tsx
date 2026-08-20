import { View, Text, Pressable } from "react-native";
import { fuentes } from "../constants/theme";

interface CheckboxRowProps {
  checked: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  /** Que se esta aceptando. El lector no puede deducirlo de los hijos si llevan
   *  enlaces embebidos, que es justo el caso de los terminos del registro. */
  etiqueta: string;
}

export function CheckboxRow({ checked, onToggle, children, etiqueta }: CheckboxRowProps) {
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityLabel={etiqueta}
      accessibilityState={{ checked }}
      className="flex-row items-center mt-3"
      style={{ minHeight: 44, gap: 12 }}
    >
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 6,
          borderWidth: 2,
          borderColor: checked ? "#1FAF55" : "#BCCABA",
          backgroundColor: checked ? "#1FAF55" : "transparent",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {checked && (
          <Text style={{ color: "#fff", fontSize: 13, fontFamily: fuentes.destacado, marginTop: -1 }}>✓</Text>
        )}
      </View>
      <Text style={{ flex: 1, fontFamily: fuentes.destacado, fontSize: 13, color: "#1A1C1A", lineHeight: 18 }}>
        {children}
      </Text>
    </Pressable>
  );
}
