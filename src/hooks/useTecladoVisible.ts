/**
 * ¿Está el teclado abierto?
 *
 * Se usa para esconder la barra inferior del carrito mientras el cliente escribe.
 * Con el teclado arriba, el total y el botón de pedir ocupan un tercio de lo que
 * queda de pantalla sin aportar nada — y en el carrito tapan justamente las
 * sugerencias de dirección, que es lo que la persona está mirando.
 */

import { useEffect, useState } from "react";
import { Keyboard, Platform } from "react-native";

export function useTecladoVisible(): boolean {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // En iOS los eventos `Will` llegan antes de la animación, así la barra
    // desaparece a la vez que sube el teclado en vez de un instante después.
    // Android solo emite los `Did`.
    const abrir = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const cerrar = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const s1 = Keyboard.addListener(abrir, () => setVisible(true));
    const s2 = Keyboard.addListener(cerrar, () => setVisible(false));
    return () => {
      s1.remove();
      s2.remove();
    };
  }, []);

  return visible;
}
