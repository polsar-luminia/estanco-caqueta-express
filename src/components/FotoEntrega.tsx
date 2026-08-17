import { useEffect, useState } from "react";
import { View, Text } from "react-native";
import { Image } from "expo-image";
import { getToken } from "../lib/api";
import { colors } from "../constants/theme";

/**
 * La foto de "así se entregó tu pedido".
 *
 * POR QUÉ ES UN COMPONENTE Y NO UN `<Image>` SUELTO (078): hasta hoy la foto se
 * servía desde una URL pública — nginx entregaba el directorio sin
 * autenticación y lo único que la protegía era que el nombre fuera un UUID no
 * adivinable. "Seguridad por URL secreta" aguanta mientras nadie comparta el
 * enlace, lo pegue en un chat o lo deje en el historial de un navegador
 * prestado, y son fotos de las casas de los clientes.
 *
 * Ahora el enlace exige la sesión del cliente, así que hay que mandar el
 * `Authorization` — y el token se lee de SecureStore, que es asíncrono. De ahí
 * el estado: no se puede pintar la imagen hasta tenerlo.
 *
 * El servidor además comprueba que el pedido sea de quien pregunta: sin eso,
 * cambiar el número en la URL mostraría la puerta de la casa de otra persona.
 */
export function FotoEntrega({ uri }: { uri: string }) {
  const [token, setToken] = useState<string | null>(null);
  const [fallo, setFallo] = useState(false);

  useEffect(() => {
    let vivo = true;
    getToken().then((t) => {
      if (vivo) setToken(t);
    });
    return () => {
      vivo = false;
    };
  }, []);

  // Sin sesión no hay foto que mostrar, y tampoco hay nada que explicar: si el
  // token no está, el usuario ya está de salida hacia el login.
  if (!token) return null;

  // Un hueco silencioso es peor que decirlo: el cliente vería un recuadro gris y
  // no sabría si es su conexión o si nunca hubo foto.
  if (fallo) {
    return (
      <Text style={{ color: colors.muted, fontSize: 13 }}>
        No pudimos cargar la foto en este momento.
      </Text>
    );
  }

  return (
    <View>
      <Image
        source={{ uri, headers: { Authorization: `Bearer ${token}` } }}
        accessibilityLabel="Foto de la entrega de tu pedido"
        contentFit="cover"
        style={{ width: "100%", height: 200, borderRadius: 12 }}
        transition={150}
        onError={() => setFallo(true)}
      />
    </View>
  );
}
