/**
 * Recordatorio de frío — última pregunta antes de cobrar (bloque H).
 *
 * Se intercepta el tap de "Confirmar pedido" y se muestra esta tarjeta SOLO si se
 * cumplen las tres: la bandera `frio_recordatorio_activo` está prendida, hay al
 * menos un producto elegible, y el check del carrito está apagado. Si ya lo marcó,
 * no sale: volvérselo a preguntar es tratarlo de distraído y arriesgar que se
 * arrepienta.
 *
 * REGLA CENTRAL: los dos BOTONES terminan en un pedido creado. Es una bifurcación,
 * no un desvío — se toca una vez y se compra. Por eso la tarjeta tiene que mostrar
 * el total resultante ANTES de que toque: cobrar $1.000 extra sin que el número
 * aparezca en la misma pantalla donde se acepta es exactamente el tipo de detalle
 * que después llega como queja.
 *
 * Tocar FUERA de la tarjeta no es ninguna de las dos cosas: solo cierra y devuelve
 * al carrito. Antes equivalía a "No me interesa" y creaba el pedido, así que un
 * roce en el borde bastaba para comprar sin haber decidido nada. Un toque
 * accidental no puede mover plata.
 *
 * La imagen es TODA la tarjeta: la pieza viene diseñada con su tercio inferior
 * libre de arte justamente para que el texto y los botones vayan encima. La
 * tarjeta toma la proporción real del archivo, así que no se recorta ni deja
 * franjas. El precio, los elegibles y los botones son nativos porque todo eso es
 * configurable desde el admin — una imagen estática mentiría apenas alguien cambie
 * `frio_costo`— y porque un botón pintado no se puede tocar, ni deshabilitar, ni
 * leer con VoiceOver, ni cumple los 44 pt.
 */

import { useEffect, useRef, useState } from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Animated,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "../constants/theme";
import { formatCOP } from "../lib/format";

// Paleta de la pieza gráfica aprobada (azul profundo → azul hielo).
const AZUL_PROFUNDO = "#0F3A6B";
const AZUL_MEDIO = "#1B4B8F";
const AZUL_HIELO = "#9DD8F5";

// Proporción de la pieza actual (1080x1920). Solo es el valor de arranque: al
// cargar, la imagen reporta su tamaño real y la tarjeta se ajusta. Si mañana
// suben otra pieza con otra forma, esto no hay que tocarlo.
const RATIO_INICIAL = 1080 / 1920;

export interface FrioRecordatorioProps {
  visible: boolean;
  /** URL de la pieza gráfica. Vacía o rota → sale solo el bloque nativo. */
  imagenUrl?: string | null;
  costo: number;
  /** Nombres de los productos del carrito que sí pueden ir fríos. */
  nombresElegibles: string[];
  /** true cuando TODO el carrito es elegible. */
  todosElegibles: boolean;
  /** El total que se va a cobrar si acepta. */
  totalConFrio: number;
  onAceptar: () => void;
  onRechazar: () => void;
  /** Cerrar sin decidir (tocar fuera, botón atrás). NO crea el pedido. */
  onCerrar: () => void;
  /** El pedido está viajando: botones bloqueados con spinner. */
  enviando?: boolean;
}

// "Águila y Poker" — lista corta en lenguaje natural. Se corta pronto porque cada
// línea de más empuja el bloque hacia arriba, hacia el arte: el cliente no
// necesita el inventario, necesita entender qué le va frío.
function listaLegible(nombres: string[]): string {
  if (nombres.length === 0) return "";
  if (nombres.length === 1) return nombres[0];
  if (nombres.length === 2) return `${nombres[0]} y ${nombres[1]}`;
  return `${nombres[0]} y ${nombres.length - 1} más`;
}

export function FrioRecordatorio({
  visible,
  imagenUrl,
  costo,
  nombresElegibles,
  todosElegibles,
  totalConFrio,
  onAceptar,
  onRechazar,
  onCerrar,
  enviando = false,
}: FrioRecordatorioProps) {
  const { width, height } = useWindowDimensions();
  const anim = useRef(new Animated.Value(0)).current;
  const [ratio, setRatio] = useState(RATIO_INICIAL);

  // Fade + escala corta. Sin rebote a propósito: es una pregunta de cobro, no una
  // promoción.
  useEffect(() => {
    if (!visible) {
      anim.setValue(0);
      return;
    }
    Animated.timing(anim, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [visible, anim]);

  const hayImagen = !!imagenUrl;

  // La tarjeta cabe entera en la pantalla y respeta la proporción de la pieza: se
  // ajusta por el lado que primero se quede sin espacio. Sin esto, en pantallas
  // bajas (SE) una pieza 9:16 se saldría por abajo y se comería los botones.
  const anchoMax = Math.min(width * 0.88, 420);
  const altoMax = height * 0.84;
  let ancho = anchoMax;
  let alto = anchoMax / ratio;
  if (alto > altoMax) {
    alto = altoMax;
    ancho = altoMax * ratio;
  }

  // "Al clima" es como se dice acá, y ahorra media línea frente a "a temperatura
  // ambiente". Cada línea cuenta: el bloque crece hacia arriba, contra el arte.
  const textoElegibles = todosElegibles
    ? "Todo tu pedido va frío."
    : `Solo va frío: ${listaLegible(nombresElegibles)}. El resto, al clima.`;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      // El botón atrás de Android cae aquí. Cierra, no decide.
      onRequestClose={enviando ? undefined : onCerrar}
    >
      <Pressable
        // Tocar fuera cierra y devuelve al carrito, sin crear nada.
        onPress={enviando ? undefined : onCerrar}
        accessibilityRole="button"
        accessibilityLabel="Cerrar y volver al carrito"
        style={{
          flex: 1,
          backgroundColor: "rgba(8,28,52,0.75)",
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 16,
        }}
      >
        <Animated.View
          style={{
            width: hayImagen ? ancho : "88%",
            maxWidth: 420,
            height: hayImagen ? alto : undefined,
            borderRadius: 28,
            overflow: "hidden",
            backgroundColor: AZUL_PROFUNDO,
            opacity: anim,
            transform: [
              { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
            ],
          }}
        >
          {/* El Pressable interno solo detiene la propagación: tocar la tarjeta no la
              cierra. `accessible={false}` para que el lector no lo anuncie como un
              botón — no hace nada al tocarlo, y anunciarlo escondería el contenido
              real de la tarjeta detrás de un elemento vacío. */}
          <Pressable style={{ flex: 1 }} onPress={() => {}} accessible={false} accessibilityViewIsModal>
            {hayImagen && (
              <Image
                source={{ uri: imagenUrl! }}
                // Sin este label, el lector de pantalla anuncia una tarjeta muda.
                accessibilityLabel="Asegura el frío de tus bebidas"
                contentFit="cover"
                style={StyleSheet.absoluteFill}
                transition={120}
                onLoad={(e) => {
                  const w = e.source?.width;
                  const h = e.source?.height;
                  if (w && h) setRatio(w / h);
                }}
              />
            )}

            <View
              style={{
                flex: 1,
                // Con imagen el contenido se apoya abajo, sobre la zona que la pieza
                // dejó libre. Sin imagen no hay nada que respetar y va centrado.
                justifyContent: hayImagen ? "flex-end" : "center",
              }}
            >
              <View
                style={{
                  paddingHorizontal: 20,
                  paddingTop: hayImagen ? 16 : 28,
                  paddingBottom: hayImagen ? 22 : 20,
                }}
              >
                {/* El velo va pegado al bloque de texto, no a una fracción fija de
                    la tarjeta. Esa era la falla: con un nombre de producto largo el
                    texto crece hacia arriba y se salía de la zona velada, quedando
                    encima del titular del arte. Anclado aquí, el degradado sube
                    siempre lo mismo por encima del texto, mida lo que mida. */}
                {hayImagen && (
                  <LinearGradient
                    colors={["transparent", "rgba(8,28,52,0.82)", "rgba(8,28,52,0.95)"]}
                    locations={[0, 0.42, 0.78]}
                    style={{ position: "absolute", left: 0, right: 0, bottom: 0, top: -72 }}
                    pointerEvents="none"
                  />
                )}

                {/* Sin imagen la tarjeta pierde el gancho visual, así que el titular
                    pasa a ser texto. El pedido se completa igual. */}
                {!hayImagen && (
                  <Text
                    style={{
                      fontSize: 22,
                      fontWeight: "800",
                      color: colors.white,
                      textAlign: "center",
                      marginBottom: 14,
                    }}
                  >
                    Asegura el frío de tus bebidas
                  </Text>
                )}

                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "800",
                    color: AZUL_HIELO,
                    textAlign: "center",
                  }}
                >
                  Recargo de {formatCOP(costo)}
                </Text>

                <Text
                  style={{
                    fontSize: 14,
                    lineHeight: 19,
                    color: colors.white,
                    textAlign: "center",
                    marginTop: 8,
                  }}
                >
                  {textoElegibles}
                </Text>

                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: "700",
                    color: colors.white,
                    textAlign: "center",
                    marginTop: 10,
                  }}
                >
                  Tu total quedaría en {formatCOP(totalConFrio)}
                </Text>

                <View style={{ marginTop: 14 }}>
                <Pressable
                  onPress={onAceptar}
                  disabled={enviando}
                  accessibilityRole="button"
                  accessibilityLabel={`Sí, asegurar el frío por ${formatCOP(costo)}`}
                  accessibilityState={{ disabled: enviando }}
                  style={{
                    minHeight: 48,
                    borderRadius: 24,
                    backgroundColor: colors.white,
                    alignItems: "center",
                    justifyContent: "center",
                    paddingHorizontal: 16,
                    opacity: enviando ? 0.6 : 1,
                  }}
                >
                  {enviando ? (
                    <ActivityIndicator color={AZUL_PROFUNDO} />
                  ) : (
                    <Text style={{ fontSize: 16, fontWeight: "800", color: AZUL_PROFUNDO }}>
                      ¡Sí, lo quiero asegurar!
                    </Text>
                  )}
                </Pressable>

                <Pressable
                  onPress={onRechazar}
                  disabled={enviando}
                  accessibilityRole="button"
                  accessibilityLabel="No me interesa, pedir sin frío"
                  accessibilityState={{ disabled: enviando }}
                  style={{
                    minHeight: 44,
                    alignItems: "center",
                    justifyContent: "center",
                    marginTop: 8,
                    opacity: enviando ? 0.5 : 1,
                  }}
                >
                  <Text style={{ fontSize: 15, fontWeight: "600", color: AZUL_HIELO }}>
                    No me interesa
                  </Text>
                </Pressable>
                </View>
              </View>
            </View>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

export { AZUL_PROFUNDO, AZUL_MEDIO, AZUL_HIELO };
