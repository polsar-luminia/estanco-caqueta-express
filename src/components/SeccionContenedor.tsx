// Envoltorio de una seccion de la portada: le pone su fondo y su borde de arriba.
//
// POR QUE ES UN COMPONENTE Y NO ESTILO SUELTO EN CADA SECCION: el color y la
// curva vienen del servidor (migracion 083). Si cada tipo de seccion se pintara
// su propio fondo, agregar el cuarto tipo significaria acordarse de copiar esto
// otra vez — y el que se olvide no falla, simplemente sale sobre el fondo blanco
// y nadie lo nota hasta que alguien compara con el diseno.
//
// La curva esta medida del borrador: la profundidad es el 7,2% del ancho de la
// pantalla y el punto mas hondo cae en el centro. Se dibuja con SVG y no con
// borderRadius porque un radio da un arco de circunferencia en las esquinas, no
// una onda que cruza todo el ancho.

import { View, useWindowDimensions, type ViewStyle } from "react-native";
import Svg, { Path } from "react-native-svg";
import type { ReactNode } from "react";

const PROFUNDIDAD = 0.072;

interface Props {
  colorFondo?: string | null;
  bordeSuperior?: string | null;
  children: ReactNode;
  style?: ViewStyle;
}

export function SeccionContenedor({ colorFondo, bordeSuperior, children, style }: Props) {
  const { width } = useWindowDimensions();

  // Sin color propio no hay nada que envolver: la seccion se dibuja sobre el
  // fondo de la pantalla, que es como se ven casi todas.
  if (!colorFondo) return <View style={style}>{children}</View>;

  const curvo = bordeSuperior === "curvo";
  const d = Math.round(width * PROFUNDIDAD);

  return (
    <View style={style}>
      {curvo && (
        // La franja mide `d` de alto. En los bordes el color la llena entera y
        // en el centro no llega: eso es lo que produce la onda contra el fondo
        // de la pantalla, sin tener que saber de que color es ese fondo.
        <Svg width={width} height={d} viewBox={`0 0 ${width} ${d}`}>
          <Path d={`M0 0 Q ${width / 2} ${d * 2} ${width} 0 L ${width} ${d} L 0 ${d} Z`} fill={colorFondo} />
        </Svg>
      )}
      <View style={{ backgroundColor: colorFondo }}>{children}</View>
    </View>
  );
}
