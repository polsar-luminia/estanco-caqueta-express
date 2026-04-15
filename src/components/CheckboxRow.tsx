import { View, Text, Pressable } from "react-native";

interface CheckboxRowProps {
  checked: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

export function CheckboxRow({ checked, onToggle, children }: CheckboxRowProps) {
  return (
    <Pressable onPress={onToggle} className="flex-row items-center mt-3" style={{ gap: 12 }}>
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
          <Text style={{ color: "#fff", fontSize: 13, fontWeight: "800", marginTop: -1 }}>✓</Text>
        )}
      </View>
      <Text style={{ flex: 1, fontSize: 13, color: "#1A1C1A", lineHeight: 18 }}>
        {children}
      </Text>
    </Pressable>
  );
}
