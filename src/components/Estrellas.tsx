/**
 * Selector de 1 a 5 estrellas (bloque C).
 *
 * Cinco Pressable de verdad y no un gesto de arrastre: arrastrar sobre estrellas
 * es preciso en un mouse y una loteria en un celular. Tocar la que se quiere es
 * inequivoco, y ademas cada estrella puede tener su propia etiqueta para el lector
 * de pantalla — un slider de estrellas se anuncia como "3 de 5" y no dice de que.
 */

import { View, Text, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { fuentes } from "../constants/theme";

const ETIQUETAS = ["Muy malo", "Malo", "Regular", "Bueno", "Excelente"];
const DORADO = "#E4A400";

export interface EstrellasProps {
  valor: number;
  onChange?: (v: number) => void;
  /** Solo lectura: para mostrar una reseña ya enviada. */
  readonly?: boolean;
  tamano?: number;
  /** Muestra "Bueno", "Excelente"... debajo. */
  mostrarEtiqueta?: boolean;
}

export function Estrellas({
  valor,
  onChange,
  readonly = false,
  tamano = 36,
  mostrarEtiqueta = false,
}: EstrellasProps) {
  return (
    <View style={{ alignItems: "center" }}>
      <View
        style={{ flexDirection: "row", justifyContent: "center" }}
        accessibilityRole={readonly ? "text" : "radiogroup"}
        accessibilityLabel={readonly ? `Calificación: ${valor} de 5 estrellas` : "Calificación"}
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable
            key={n}
            onPress={readonly ? undefined : () => onChange?.(n)}
            disabled={readonly}
            accessibilityRole={readonly ? undefined : "radio"}
            accessibilityState={readonly ? undefined : { selected: valor === n }}
            accessibilityLabel={readonly ? undefined : `${n} ${n === 1 ? "estrella" : "estrellas"} — ${ETIQUETAS[n - 1]}`}
            // 44 pt de objetivo tactil aunque el icono sea mas chico.
            style={{
              minWidth: 44,
              minHeight: 44,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Feather
              name="star"
              size={tamano}
              color={n <= valor ? DORADO : "#D8DCD6"}
              // Feather no trae relleno: se simula superponiendo el icono en el
              // mismo color del trazo cuando esta activa.
              style={n <= valor ? { textShadowColor: DORADO, textShadowRadius: 1 } : undefined}
            />
          </Pressable>
        ))}
      </View>

      {mostrarEtiqueta && valor > 0 && (
        <Text style={{ fontSize: 14, fontFamily: fuentes.destacado, color: "#6D7B6C", marginTop: 2 }}>
          {ETIQUETAS[valor - 1]}
        </Text>
      )}
    </View>
  );
}
