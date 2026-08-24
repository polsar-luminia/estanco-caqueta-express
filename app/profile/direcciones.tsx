import { useState, useRef } from "react";
import { View, Text, Pressable, ScrollView, TextInput, Alert, RefreshControl } from "react-native";
import { Stack, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BackButton } from "../../src/components/BackButton";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import Toast from "react-native-toast-message";
import { getDirecciones, crearDireccion, setPredeterminada, eliminarDireccion, ubicacionABody, type UbicacionCapturada } from "../../src/lib/api";
import { nuevoUuidV4 } from "../../src/lib/uuid";
import { UbicacionButton } from "../../src/components/UbicacionButton";
import { BuscadorDireccion } from "../../src/components/BuscadorDireccion";
import { colors, shadows, fuentes } from "../../src/constants/theme";
import { tracker } from "../../src/lib/tracker";

const ORIGEN = "perfil";

export default function DireccionesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [mostrarForm, setMostrarForm] = useState(false);
  const [direccion, setDireccion] = useState("");
  const [etiqueta, setEtiqueta] = useState("");
  const [notas, setNotas] = useState("");
  const [ubicacion, setUbicacion] = useState<UbicacionCapturada | null>(null);
  // Ver BuscadorDireccion: con el punto puesto, las sugerencias estorban.
  const [silenciado, setSilenciado] = useState(false);
  // Salida de "fuera de zona" del mapa (Direcciones 1.3.2): habilita guardar
  // sin `ubicacion` SOLO para la dirección con la que se concedió. Cambiar el
  // texto la revoca — ver el onChangeText de abajo.
  const [permitirSinPin, setPermitirSinPin] = useState(false);

  const { data: direcciones = [], isLoading, isError, isFetching } = useQuery({
    queryKey: ["direcciones"],
    queryFn: getDirecciones,
  });

  const refetch = () => queryClient.invalidateQueries({ queryKey: ["direcciones"] });

  // Idempotency-Key por intento de guardado: un doble-tap o reintento de red
  // reutiliza la misma key y el servidor devuelve la respuesta original en vez
  // de crear la dirección dos veces. Se limpia al guardar con éxito.
  const idemKeyRef = useRef<string | null>(null);

  const mutCrear = useMutation({
    mutationFn: (data: Parameters<typeof crearDireccion>[0]) => {
      if (!idemKeyRef.current) idemKeyRef.current = nuevoUuidV4();
      return crearDireccion(data, idemKeyRef.current);
    },
    onSuccess: () => {
      idemKeyRef.current = null;
      if (!ubicacion) {
        tracker.track('direccion_sin_pin_guardada', { origen: ORIGEN }, ORIGEN);
      }
      refetch();
      setMostrarForm(false);
      setDireccion(""); setNotas(""); setEtiqueta(""); setUbicacion(null); setPermitirSinPin(false);
      Toast.show({ type: "success", text1: "Dirección guardada" });
    },
    onError: (err: Error) => Toast.show({ type: "error", text1: err.message }),
  });

  const mutPredeterminada = useMutation({
    mutationFn: setPredeterminada,
    onSuccess: refetch,
  });

  const mutEliminar = useMutation({
    mutationFn: eliminarDireccion,
    onSuccess: (_data, id) => {
      const d = direcciones.find((x) => x.id === id);
      tracker.track('direccion_eliminada', { con_pin: d?.lat != null, era_predeterminada: !!d?.predeterminada }, ORIGEN);
      refetch();
      Toast.show({ type: "success", text1: "Dirección eliminada" });
    },
    onError: (err: Error) => Toast.show({ type: "error", text1: "No se pudo eliminar", text2: err.message }),
  });

  const handleGuardar = () => {
    if (!direccion.trim()) {
      Toast.show({ type: "error", text1: "Ingresa una dirección" });
      return;
    }
    // El punto es obligatorio para direcciones NUEVAS. Una dirección sin
    // coordenadas es una dirección que el domiciliario tiene que adivinar, y hoy
    // el 61% de las guardadas está así. Las que ya existen no se tocan: se
    // completan cuando el cliente las use.
    //
    // Única excepción: `permitirSinPin`, que solo se enciende cuando el mapa
    // mismo dijo "por ahora no llegamos hasta aquí" y la persona eligió
    // guardar el texto de todos modos (Direcciones 1.3.2). No deja a nadie sin
    // salida: el mapa funciona sin ningún permiso de ubicación.
    if ((!ubicacion || ubicacion.lat == null) && !permitirSinPin) {
      Toast.show({
        type: "error",
        text1: "Falta el punto de entrega",
        text2: "Usa tu ubicación o ubícala en el mapa para que el domiciliario llegue exacto",
      });
      return;
    }
    mutCrear.mutate({
      // Vacío se OMITE (no "Casa" a mano): al crear, el servidor ya aplica ese
      // default (clientes.js). Al editar es distinto — ver [id].tsx.
      ...(etiqueta.trim() ? { etiqueta: etiqueta.trim() } : {}),
      direccion: direccion.trim(),
      notas: notas.trim() || undefined,
      // ubicacionABody(null) = {}: es justo lo que necesita el camino
      // "guardar sin el punto" (permitirSinPin) — sin coords, dirección manual.
      ...ubicacionABody(ubicacion),
    });
  };

  const handleEliminar = (id: number) => {
    Alert.alert("Eliminar dirección", "¿Estás seguro?", [
      { text: "No" },
      { text: "Sí", style: "destructive", onPress: () => mutEliminar.mutate(id) },
    ]);
  };

  return (
    <View className="flex-1" style={{ backgroundColor: colors.bg }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", paddingTop: insets.top + 12, paddingBottom: 14, paddingHorizontal: 16, backgroundColor: colors.bg }}>
        <BackButton style={{ paddingRight: 16 }} />
        <Text style={{ flex: 1, fontSize: 17, fontFamily: fuentes.destacado, color: "#1A1C1A", textAlign: "center", marginRight: 60 }}>
          Mis Direcciones
        </Text>
      </View>

      <ScrollView automaticallyAdjustKeyboardInsets keyboardDismissMode="interactive"
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={!isLoading && isFetching} onRefresh={refetch} />}
      >
        {isError ? (
          <View className="items-center py-12">
            <Feather name="alert-circle" size={40} color="#D1D5DB" />
            <Text style={{ fontSize: 16, fontFamily: fuentes.destacado, color: "#6D7B6C", marginTop: 12 }}>No pudimos cargar tus direcciones</Text>
            <Pressable onPress={() => refetch()} accessibilityRole="button" accessibilityLabel="Reintentar cargar tus direcciones" style={{ marginTop: 12, paddingHorizontal: 24, paddingVertical: 10, minHeight: 44, justifyContent: "center", backgroundColor: "#1FAF55", borderRadius: 999 }}>
              <Text style={{ color: "#fff", fontFamily: fuentes.destacado }}>Reintentar</Text>
            </Pressable>
          </View>
        ) : isLoading ? (
          <Text style={{ color: "#9E9E9E", textAlign: "center", marginTop: 32 }}>Cargando...</Text>
        ) : direcciones.length === 0 && !mostrarForm ? (
          <View className="items-center py-12">
            <Feather name="map-pin" size={40} color="#D1D5DB" />
            <Text style={{ fontSize: 16, fontFamily: fuentes.destacado, color: "#6D7B6C", marginTop: 12 }}>No tienes direcciones guardadas</Text>
            <Text style={{ fontFamily: fuentes.destacado, fontSize: 13, color: "#9E9E9E", marginTop: 4 }}>Agrega una para agilizar tus pedidos</Text>
          </View>
        ) : (
          direcciones.map((d) => (
            <View key={d.id} style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 1.5, borderColor: d.predeterminada ? colors.green : "transparent", ...shadows.card }}>
              <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                  <Feather name="map-pin" size={16} color={d.predeterminada ? "#1FAF55" : "#9E9E9E"} />
                  <View style={{ flex: 1 }}>
                    {/* flexWrap: con PREDETERMINADA + CON UBICACIÓN la fila se
                        desbordaba por encima de la basura de eliminar y la
                        dejaba intocable. Los chips ahora bajan de línea. La
                        etiqueta ahora es texto libre (Direcciones 1.3.2):
                        numberOfLines evita que una larga vuelva a desbordar. */}
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <Text style={{ fontSize: 14, fontFamily: fuentes.destacado, color: "#1A1C1A", flexShrink: 1 }} numberOfLines={1}>{d.etiqueta}</Text>
                      {d.predeterminada && (
                        <View style={{ backgroundColor: "rgba(31,175,85,0.1)", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 }}>
                          <Text style={{ fontSize: 12, fontFamily: fuentes.destacado, color: "#1FAF55" }}>PRINCIPAL</Text>
                        </View>
                      )}
                      {d.lat != null && (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 2, backgroundColor: "rgba(31,175,85,0.1)", borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}>
                          <Feather name="map-pin" size={8} color="#1FAF55" />
                          <Text style={{ fontSize: 12, fontFamily: fuentes.destacado, color: "#1FAF55" }}>CON UBICACIÓN</Text>
                        </View>
                      )}
                    </View>
                    <Text style={{ fontFamily: fuentes.destacado, fontSize: 13, color: "#6D7B6C", marginTop: 2 }}>{d.direccion}</Text>
                    {d.notas ? <Text style={{ fontFamily: fuentes.destacado, fontSize: 12, color: "#9E9E9E", fontStyle: "italic", marginTop: 2 }}>{d.notas}</Text> : null}
                  </View>
                </View>
                <Pressable
                  onPress={() => handleEliminar(d.id)}
                  style={{ padding: 4, marginLeft: 8 }}
                  // Icono de 16 px en la esquina de la tarjeta: el hitSlop lo lleva
                  // a 44 pt sin empujar el texto de la dirección.
                  hitSlop={12}
                  accessibilityLabel={`Eliminar dirección ${d.etiqueta}`}
                  accessibilityRole="button"
                >
                  <Feather name="trash-2" size={16} color="#D33587" />
                </Pressable>
              </View>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
                {!d.predeterminada && (
                  <Pressable
                    onPress={() => mutPredeterminada.mutate(d.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Marcar ${d.etiqueta} como dirección predeterminada`}
                    // Solo vertical: los dos botones de la fila están a 8 px y un
                    // hitSlop horizontal haría que se solaparan.
                    hitSlop={{ top: 8, bottom: 8 }}
                    style={{ flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.lowfill, alignItems: "center" }}
                  >
                    <Text style={{ fontSize: 12, fontFamily: fuentes.destacado, color: "#1FAF55" }}>Predeterminada</Text>
                  </Pressable>
                )}
                {/* "Editar ubicación"/"Agregar ubicación" se reemplazó por un
                    único "Editar" (Direcciones 1.3.2): etiqueta, dirección,
                    notas y pin ahora viven en una pantalla propia — no un
                    <Modal>, porque el Toast raíz queda detrás de un Modal
                    nativo (ver cart.tsx:762) y esta pantalla tiene dos toasts
                    de error. El mapa se alcanza desde adentro. */}
                <Pressable
                  onPress={() => router.push(`/profile/direccion/${d.id}`)}
                  accessibilityRole="button"
                  accessibilityLabel={`Editar ${d.etiqueta}`}
                  hitSlop={{ top: 8, bottom: 8 }}
                  style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.lowfill }}
                >
                  <Feather name="edit-2" size={12} color="#1FAF55" />
                  <Text style={{ fontSize: 12, fontFamily: fuentes.destacado, color: "#1FAF55" }}>Editar</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}

        {/* Formulario nueva dirección */}
        {mostrarForm ? (
          <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 16, ...shadows.card }}>
            <Text style={{ fontSize: 16, fontFamily: fuentes.destacado, color: colors.ink, marginBottom: 16 }}>Nueva dirección</Text>

            {/* El punto es OBLIGATORIO al crear (ver handleGuardar), salvo que
                el mapa mismo haya dicho "fuera de zona" y se eligió guardar
                sin él. Va primero porque es lo que define la dirección; el
                texto de abajo es la referencia para el último tramo. */}
            <UbicacionButton
              value={ubicacion}
              textoDireccion={direccion}
              origen={ORIGEN}
              onSinPin={() => setPermitirSinPin(true)}
              onChange={(u) => {
                setUbicacion(u);
                setSilenciado(!!u);
                // Un punto elegido en el mapa (pin_mapa) siempre reescribe la
                // dirección; el GPS solo la llena si está vacía (no pisa lo escrito).
                if (u?.geocoded_direccion && (u.metodo_ubicacion === "pin_mapa" || !direccion.trim())) {
                  setDireccion(u.geocoded_direccion);
                }
              }}
            />

            {permitirSinPin && (!ubicacion || ubicacion.lat == null) ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16, backgroundColor: "rgba(220,38,38,0.08)", borderRadius: 8, padding: 10 }}>
                <Feather name="alert-triangle" size={14} color="#DC2626" />
                <Text style={{ flex: 1, fontSize: 12.5, lineHeight: 17, fontFamily: fuentes.destacado, color: "#DC2626" }}>
                  Fuera de nuestra zona · se guardará sin punto en el mapa
                </Text>
              </View>
            ) : null}

            {/* Etiqueta libre (Direcciones 1.3.2): los chips "Casa/Trabajo/Otro"
                se cayeron — 10 direcciones quedaron como "Otro" sin decir nada,
                y nada en el backend ni en el admin depende de esos literales.
                Vacío = "Casa" (el default del servidor). */}
            <Text style={{ fontSize: 12, fontFamily: fuentes.destacado, color: "#6D7B6C", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Etiqueta</Text>
            <TextInput
              style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 13, paddingHorizontal: 14, paddingVertical: 13, fontFamily: fuentes.destacado, fontSize: 14, color: colors.ink, marginBottom: 4 }}
              placeholder="Casa"
              placeholderTextColor="#BCCABA"
              value={etiqueta}
              // NUNCA trim() aquí: borraría el espacio en cada tecla y "Casa de
              // mi mamá" sería imposible de escribir. El trim va al guardar.
              onChangeText={setEtiqueta}
              maxLength={24}
              accessibilityLabel="Etiqueta de la dirección"
            />
            <Text style={{ fontSize: 11.5, fontFamily: fuentes.destacado, color: "#9AA69A", marginBottom: 16 }}>Si lo dejas vacío, la llamamos Casa.</Text>

            <Text style={{ fontSize: 12, fontFamily: fuentes.destacado, color: "#6D7B6C", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Dirección *</Text>
            {/* Tercer camino para fijar el punto: escribir y elegir una sugerencia
                de Google, que trae las coordenadas puestas. Sin llave configurada
                se comporta como el campo de texto de siempre. */}
            <View style={{ marginBottom: 12 }}>
              <BuscadorDireccion
                value={direccion}
                onChangeText={(t) => {
                  setDireccion(t);
                  setSilenciado(false);
                  // El permiso de guardar sin pin es para ESTA dirección; si el
                  // texto cambia, hay que volver a pasar por el mapa.
                  setPermitirSinPin(false);
                }}
                silenciado={silenciado}
                onUbicacion={setUbicacion}
                placeholder="Ej: Carrera 15 # 12-34"
                accessibilityLabel="Dirección"
              />
            </View>

            <Text style={{ fontSize: 12, fontFamily: fuentes.destacado, color: "#6D7B6C", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Notas (opcional)</Text>
            <TextInput style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 13, paddingHorizontal: 14, paddingVertical: 13, fontFamily: fuentes.destacado, fontSize: 14, color: colors.ink, marginBottom: 16 }} placeholder="Ej: portería, dejar con vigilante" placeholderTextColor="#BCCABA" value={notas} onChangeText={setNotas} multiline maxLength={300} />

            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable
                onPress={() => { setMostrarForm(false); setUbicacion(null); setPermitirSinPin(false); }}
                accessibilityRole="button"
                accessibilityLabel="Cancelar y cerrar el formulario de nueva dirección"
                style={{ flex: 1, paddingVertical: 12, minHeight: 44, justifyContent: "center", borderRadius: 12, backgroundColor: colors.lowfill, alignItems: "center" }}
              >
                <Text style={{ fontSize: 14, fontFamily: fuentes.destacado, color: "#6D7B6C" }}>Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={handleGuardar}
                disabled={mutCrear.isPending}
                accessibilityRole="button"
                accessibilityLabel="Guardar la nueva dirección"
                accessibilityState={{ disabled: mutCrear.isPending }}
                style={{ flex: 2, paddingVertical: 12, minHeight: 44, justifyContent: "center", borderRadius: 12, backgroundColor: "#1FAF55", alignItems: "center" }}
              >
                <Text style={{ fontSize: 14, fontFamily: fuentes.destacado, color: "#fff" }}>{mutCrear.isPending ? "Guardando..." : "Guardar"}</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable
            onPress={() => setMostrarForm(true)}
            accessibilityRole="button"
            accessibilityLabel="Agregar una dirección nueva"
            style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, minHeight: 44, borderRadius: 16, borderWidth: 2, borderColor: "#1FAF55", borderStyle: "dashed" }}
          >
            <Feather name="plus" size={18} color="#1FAF55" />
            <Text style={{ fontSize: 14, fontFamily: fuentes.destacado, color: "#1FAF55" }}>Agregar dirección</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}
