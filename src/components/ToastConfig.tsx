import { View, Text } from "react-native";
import type { BaseToastProps } from "react-native-toast-message";
import { fuentes } from "../constants/theme";

function ToastBase({ text1, text2, bgColor }: BaseToastProps & { bgColor: string }) {
  return (
    <View style={{ backgroundColor: bgColor, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, marginHorizontal: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 4 }}>
      {text1 ? <Text style={{ color: "#fff", fontFamily: fuentes.destacado, fontSize: 14 }}>{text1}</Text> : null}
      {text2 ? <Text style={{ color: "rgba(255,255,255,0.85)", fontFamily: fuentes.destacado, fontSize: 12, marginTop: 2 }}>{text2}</Text> : null}
    </View>
  );
}

export const toastConfig = {
  success: (props: BaseToastProps) => <ToastBase {...props} bgColor="#17994A" />,
  error: (props: BaseToastProps) => <ToastBase {...props} bgColor="#DC2626" />,
  info: (props: BaseToastProps) => <ToastBase {...props} bgColor="#D33587" />,
};
