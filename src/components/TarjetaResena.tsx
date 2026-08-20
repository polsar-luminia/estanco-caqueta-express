/**
 * Tarjeta de calificación en el detalle del pedido (bloque C).
 *
 * Solo aparece en pedidos entregados. Si ya se calificó, muestra la reseña en
 * lugar del formulario: la calificación no se edita — una reseña que se puede
 * cambiar después deja de ser una foto de cómo se sintió el cliente ese día.
 *
 * El comentario es opcional a propósito. Pedir texto obligatorio convierte una
 * acción de 3 segundos en una tarea, y lo que se pierde son justamente las
 * calificaciones de la gente que estuvo conforme y no tiene nada que agregar.
 */

import { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Toast from "react-native-toast-message";
import { getResena, crearResena } from "../lib/api";
import { tracker } from "../lib/tracker";
import { colors, fuentes } from "../constants/theme";
import { CARD_SHADOW } from "../constants/styles";
import { Estrellas } from "./Estrellas";

export interface TarjetaResenaProps {
  pedidoId: number;
  /** Llega en 1 desde el deep link del push: abre el formulario ya desplegado. */
  abrirAlEntrar?: boolean;
  /** Nombre del domiciliario asignado (071). Si llega, la tarjeta pregunta
      tambien por el — "¿Qué tal estuvo el servicio de NOMBRE?". */
  nombreDomiciliario?: string | null;
}

export function TarjetaResena({ pedidoId, abrirAlEntrar = false, nombreDomiciliario = null }: TarjetaResenaProps) {
  const queryClient = useQueryClient();
  const [estrellas, setEstrellas] = useState(0);
  const [comentario, setComentario] = useState("");
  const [estrellasDomi, setEstrellasDomi] = useState(0);
  const [comentarioDomi, setComentarioDomi] = useState("");

  const { data: resena, isLoading } = useQuery({
    queryKey: ["resena", pedidoId],
    queryFn: () => getResena(pedidoId),
    staleTime: Infinity,
  });

  const mutation = useMutation({
    mutationFn: () => crearResena(pedidoId, estrellas, comentario, estrellasDomi || undefined, comentarioDomi || undefined),
    onSuccess: (nueva) => {
      // La satisfacción por fin es medible. Solo las estrellas: el comentario es
      // texto libre del cliente y no tiene por qué salir del teléfono en un evento.
      tracker.track("resena_enviada", { estrellas: nueva.estrellas }, "orders/[id]");
      queryClient.setQueryData(["resena", pedidoId], nueva);
      Toast.show({ type: "success", text1: "Gracias por calificar" });
    },
    onError: (err: Error) => {
      Toast.show({ type: "error", text1: "No se pudo enviar", text2: err.message });
      // 409 = ya existía una reseña (doble envío, o la dejó en otro dispositivo).
      // Se refresca para mostrar la que ya está en vez de dejar el formulario.
      queryClient.invalidateQueries({ queryKey: ["resena", pedidoId] });
    },
  });

  if (isLoading) return null;

  // Ya calificó: se muestra lo que dejó, sin posibilidad de editar.
  if (resena) {
    return (
      <View className="bg-white rounded-2xl p-6" style={CARD_SHADOW}>
        <Text className="text-base font-bold text-on-surface mb-3">Tu calificación</Text>
        <Estrellas valor={resena.estrellas} readonly tamano={24} />
        {resena.comentario && (
          <Text className="text-sm text-gray-600 mt-3 text-center italic">
            “{resena.comentario}”
          </Text>
        )}
        {resena.estrellas_domiciliario ? (
          <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 10, alignItems: "center" }}>
            <Text className="text-xs text-gray-500 mb-1">Tu domiciliario</Text>
            <Estrellas valor={resena.estrellas_domiciliario} readonly tamano={18} />
            {resena.comentario_domiciliario && (
              <Text className="text-sm text-gray-600 mt-2 text-center italic">
                “{resena.comentario_domiciliario}”
              </Text>
            )}
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View
      className="bg-white rounded-2xl p-6"
      style={[CARD_SHADOW, abrirAlEntrar ? { borderWidth: 2, borderColor: colors.green } : null]}
    >
      <Text className="text-base font-bold text-on-surface text-center">
        ¿Cómo te fue con tu pedido?
      </Text>
      <Text className="text-sm text-gray-500 text-center mt-1 mb-4">
        Toca las estrellas. Te toma 10 segundos.
      </Text>

      <Estrellas valor={estrellas} onChange={setEstrellas} mostrarEtiqueta />

      {/* El campo de texto aparece solo después de elegir estrellas: mostrarlo
          antes hace ver la tarea más larga de lo que es. */}
      {estrellas > 0 && (
        <>
          <TextInput
            value={comentario}
            onChangeText={setComentario}
            placeholder="¿Quieres contarnos algo más? (opcional)"
            placeholderTextColor={colors.faint}
            multiline
            maxLength={1000}
            accessibilityLabel="Comentario opcional sobre tu pedido"
            style={{
              marginTop: 16,
              minHeight: 72,
              borderWidth: 1,
              borderColor: colors.line,
              borderRadius: 12,
              padding: 12,
              fontSize: 14,
              color: colors.ink,
              textAlignVertical: "top",
            }}
          />

          {/* Calificacion del domiciliario (072): solo si el pedido tuvo uno
              asignado. Opcional — no calificarlo no bloquea la reseña general. */}
          {nombreDomiciliario ? (
            <View style={{ marginTop: 18, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 14 }}>
              <Text className="text-sm font-bold text-on-surface text-center">
                ¿Qué tal estuvo el servicio de {nombreDomiciliario}?
              </Text>
              <View style={{ marginTop: 8 }}>
                <Estrellas valor={estrellasDomi} onChange={setEstrellasDomi} />
              </View>
              {estrellasDomi > 0 && (
                <TextInput
                  value={comentarioDomi}
                  onChangeText={setComentarioDomi}
                  placeholder={`¿Algo sobre ${nombreDomiciliario}? (opcional)`}
                  placeholderTextColor={colors.faint}
                  multiline
                  maxLength={1000}
                  accessibilityLabel="Comentario opcional sobre tu domiciliario"
                  style={{
                    marginTop: 10,
                    minHeight: 56,
                    borderWidth: 1,
                    borderColor: colors.line,
                    borderRadius: 12,
                    padding: 12,
                    fontSize: 14,
                    color: colors.ink,
                    textAlignVertical: "top",
                  }}
                />
              )}
            </View>
          ) : null}

          <Pressable
            onPress={() => mutation.mutate()}
            disabled={mutation.isPending}
            accessibilityRole="button"
            accessibilityLabel={`Enviar calificación de ${estrellas} estrellas`}
            accessibilityState={{ disabled: mutation.isPending }}
            style={{
              marginTop: 12,
              minHeight: 48,
              borderRadius: 12,
              backgroundColor: colors.green,
              alignItems: "center",
              justifyContent: "center",
              opacity: mutation.isPending ? 0.6 : 1,
            }}
          >
            {mutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ fontSize: 16, fontFamily: fuentes.destacado, color: "#fff" }}>
                Enviar calificación
              </Text>
            )}
          </Pressable>
        </>
      )}
    </View>
  );
}
