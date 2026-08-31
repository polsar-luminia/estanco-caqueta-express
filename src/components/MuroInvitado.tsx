import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { CartIcon } from "./icons/TabIcons";
import { colors, shadows, fuentes } from "../constants/theme";

/**
 * Lo que ve un invitado cuando toca algo que exige cuenta.
 *
 * POR QUE EXISTE (auditoria del ingreso, 31-ago-2026): tanto el carrito como el
 * perfil hacian `<Redirect href="/(auth)/register" />` a secas, y ahi se cerraba
 * un bucle medido — 151 dispositivos abrieron /register dentro de los 10 minutos
 * siguientes a fallar el login, y 40 recibieron "este número ya tiene una
 * cuenta" (50 eventos `registro_codigo_fallido` con motivo
 * telefono_ya_registrado). Alguien que no puede entrar deduce que no tiene
 * cuenta, va a crearla, y el sistema le dice que ya la tiene.
 *
 * El del PERFIL es el peor de los dos y se encontro despues: quien toca el icono
 * de su cuenta esta buscando SU cuenta, o sea que es de los que mas
 * probablemente ya la tiene, y recibia un formulario de registro.
 *
 * Un componente y no dos copias: eran dos puertas al mismo sitio y se
 * arreglaron con dos semanas de diferencia justamente porque nadie vio que eran
 * el mismo caso.
 */
export function MuroInvitado({
  titulo,
  subtitulo,
}: {
  titulo: string;
  subtitulo: string;
}) {
  const router = useRouter();
  return (
    <View className="flex-1 items-center justify-center px-8" style={{ backgroundColor: colors.bg }}>
      <CartIcon color="#BCCABA" size={48} />
      <Text style={{ fontSize: 20, fontFamily: fuentes.titulo, color: "#3D4A3C", marginTop: 12, textAlign: "center" }}>
        {titulo}
      </Text>
      <Text style={{ fontSize: 14, fontFamily: fuentes.destacado, color: colors.muted, marginTop: 6, marginBottom: 26, textAlign: "center" }}>
        {subtitulo}
      </Text>

      <Pressable
        onPress={() => router.push("/(auth)/register")}
        accessibilityRole="button"
        accessibilityLabel="Crear una cuenta nueva"
        style={{ width: "100%", backgroundColor: colors.green, paddingVertical: 16, borderRadius: 14, alignItems: "center", ...shadows.greenBtn }}
      >
        <Text style={{ color: colors.white, fontFamily: fuentes.destacado, fontSize: 16 }}>Crear mi cuenta</Text>
      </Pressable>

      <Pressable
        onPress={() => router.push("/(auth)/login")}
        accessibilityRole="button"
        accessibilityLabel="Iniciar sesión con una cuenta existente"
        style={{ width: "100%", marginTop: 12, paddingVertical: 15, borderRadius: 14, borderWidth: 1.5, borderColor: colors.green, alignItems: "center" }}
      >
        <Text style={{ color: colors.green, fontFamily: fuentes.destacado, fontSize: 16 }}>Ya tengo cuenta</Text>
      </Pressable>
    </View>
  );
}
