/**
 * Recordatorio de frío — última pregunta antes de cobrar (bloque H).
 *
 * Se intercepta el tap de "Confirmar pedido" y se muestra esta tarjeta SOLO si se
 * cumplen las tres: la bandera `frio_recordatorio_activo` está prendida, hay al
 * menos un producto elegible, y el check del carrito está apagado. Si ya lo marcó,
 * no sale: volvérselo a preguntar es tratarlo de distraído y arriesgar que se
 * arrepienta.
 *
 * REGLA CENTRAL: los dos botones terminan en un pedido creado. Es una bifurcación,
 * no un desvío — se toca una vez y se compra. Nadie vuelve al carrito. Por eso la
 * tarjeta tiene que mostrar el total resultante ANTES de que toque: cobrar $1.000
 * extra sin que el número aparezca en la misma pantalla donde se acepta es
 * exactamente el tipo de detalle que después llega como queja.
 *
 * Lo que va en la imagen y lo que no: la imagen es solo el gancho (marco de hielo,
 * botellas, titular). El precio, los productos elegibles y los botones son texto y
 * componentes nativos, porque todo eso es configurable desde el admin y una imagen
 * estática mentiría apenas alguien cambie `frio_costo` o marque otra categoría.
 * Además, un botón pintado no se puede tocar, ni deshabilitar, ni leer con
 * VoiceOver, ni cumple los 44 pt.
 */

import { useEffect, useRef } from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Animated,
  useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import { colors } from "../constants/theme";
import { formatCOP } from "../lib/format";

// Paleta de la pieza gráfica aprobada (azul profundo → azul hielo).
const AZUL_PROFUNDO = "#0F3A6B";
const AZUL_MEDIO = "#1B4B8F";
const AZUL_HIELO = "#9DD8F5";

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
  /** El pedido está viajando: botones bloqueados con spinner. */
  enviando?: boolean;
}

// "Águila y Poker" — lista corta en lenguaje natural. Con más de tres, se corta:
// el cliente no necesita el inventario, necesita entender qué le va frío.
function listaLegible(nombres: string[]): string {
  if (nombres.length === 0) return "";
  if (nombres.length === 1) return nombres[0];
  if (nombres.length === 2) return `${nombres[0]} y ${nombres[1]}`;
  if (nombres.length === 3) return `${nombres[0]}, ${nombres[1]} y ${nombres[2]}`;
  return `${nombres[0]}, ${nombres[1]} y ${nombres.length - 2} más`;
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
  enviando = false,
}: FrioRecordatorioProps) {
  const { height } = useWindowDimensions();
  const anim = useRef(new Animated.Value(0)).current;

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

  const alturaTarjeta = Math.round(height * 0.7);
  const hayImagen = !!imagenUrl;

  const textoElegibles = todosElegibles
    ? "Todo tu pedido va frío."
    : `Podemos asegurar frío para: ${listaLegible(nombresElegibles)}. El resto va a temperatura ambiente.`;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      // El botón atrás de Android cae aquí. Nunca dejar la tarjeta sin salida.
      onRequestClose={enviando ? undefined : onRechazar}
    >
      <Pressable
        // Tocar el overlay equivale a "No me interesa": el pedido se crea igual.
        onPress={enviando ? undefined : onRechazar}
        accessibilityRole="button"
        accessibilityLabel="Cerrar y pedir sin frío"
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
            width: "88%",
            maxWidth: 420,
            height: alturaTarjeta,
            borderRadius: 28,
            overflow: "hidden",
            backgroundColor: AZUL_PROFUNDO,
            opacity: anim,
            transform: [
              { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
            ],
          }}
        >
          {/* El Pressable interno detiene la propagación: tocar la tarjeta no la cierra. */}
          <Pressable style={{ flex: 1 }} onPress={() => {}} accessibilityViewIsModal>
            {hayImagen && (
              <Image
                source={{ uri: imagenUrl! }}
                // Sin este label, el lector de pantalla anuncia una tarjeta muda.
                accessibilityLabel="Asegura el frío de tus bebidas"
                contentFit="cover"
                style={{ width: "100%", height: "58%" }}
                transition={120}
              />
            )}

            <View
              style={{
                flex: 1,
                paddingHorizontal: 20,
                paddingTop: hayImagen ? 16 : 28,
                paddingBottom: 20,
                justifyContent: hayImagen ? "flex-start" : "center",
              }}
            >
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
                  lineHeight: 20,
                  color: colors.white,
                  textAlign: "center",
                  marginTop: 10,
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
                  marginTop: 14,
                }}
              >
                Tu total quedaría en {formatCOP(totalConFrio)}
              </Text>

              <View style={{ flex: 1, justifyContent: "flex-end", marginTop: 16 }}>
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
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

export { AZUL_PROFUNDO, AZUL_MEDIO, AZUL_HIELO };
