import { useState } from "react";
import { View, Text, Pressable, ScrollView, TextInput, Alert, RefreshControl } from "react-native";
import { Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BackButton } from "../../src/components/BackButton";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import Toast from "react-native-toast-message";
import { useRouter } from "expo-router";
import { getDirecciones, crearDireccion, editarDireccion, setPredeterminada, eliminarDireccion, ubicacionABody, type UbicacionCapturada } from "../../src/lib/api";
import { BarrioSelector, type BarrioSeleccionado } from "../../src/components/BarrioSelector";
import { UbicacionButton } from "../../src/components/UbicacionButton";
import { useUbicacionPicker } from "../../src/stores/ubicacionPicker";

export default function DireccionesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const abrirPicker = useUbicacionPicker((s) => s.abrir);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [direccion, setDireccion] = useState("");
  const [barrioObj, setBarrioObj] = useState<BarrioSeleccionado | null>(null);
  const [barrioTexto, setBarrioTexto] = useState("");
  const [etiqueta, setEtiqueta] = useState("Casa");
  const [notas, setNotas] = useState("");
  const [ubicacion, setUbicacion] = useState<UbicacionCapturada | null>(null);

  const { data: direcciones = [], isLoading, isError, isFetching } = useQuery({
    queryKey: ["direcciones"],
    queryFn: getDirecciones,
  });

  const refetch = () => queryClient.invalidateQueries({ queryKey: ["direcciones"] });

  const mutCrear = useMutation({
    mutationFn: crearDireccion,
    onSuccess: () => {
      refetch();
      setMostrarForm(false);
      setDireccion(""); setBarrioObj(null); setBarrioTexto(""); setNotas(""); setEtiqueta("Casa"); setUbicacion(null);
      Toast.show({ type: "success", text1: "Dirección guardada" });
    },
    onError: (err: Error) => Toast.show({ type: "error", text1: err.message }),
  });

  const mutPredeterminada = useMutation({
    mutationFn: setPredeterminada,
    onSuccess: refetch,
  });

  const mutEditarUbic = useMutation({
    mutationFn: ({ id, u }: { id: number; u: UbicacionCapturada }) => editarDireccion(id, ubicacionABody(u)),
    onSuccess: () => { refetch(); Toast.show({ type: "success", text1: "Ubicación actualizada" }); },
    onError: (err: Error) => Toast.show({ type: "error", text1: "No se pudo actualizar", text2: err.message }),
  });

  const abrirMapaDireccion = (d: { id: number; lat?: number | null; lng?: number | null }) => {
    abrirPicker(
      (u) => mutEditarUbic.mutate({ id: d.id, u }),
      d.lat != null && d.lng != null ? { lat: d.lat, lng: d.lng } : null,
    );
    router.push("/ubicacion");
  };

  const mutEliminar = useMutation({
    mutationFn: eliminarDireccion,
    onSuccess: () => { refetch(); Toast.show({ type: "success", text1: "Dirección eliminada" }); },
    onError: (err: Error) => Toast.show({ type: "error", text1: "No se pudo eliminar", text2: err.message }),
  });

  const handleGuardar = () => {
    if (!direccion.trim()) {
      Toast.show({ type: "error", text1: "Ingresa una dirección" });
      return;
    }
    const barrioNombre = barrioObj?.nombre || barrioTexto.trim() || undefined;
    mutCrear.mutate({ etiqueta, direccion: direccion.trim(), barrio: barrioNombre, barrio_id: barrioObj?.id, notas: notas.trim() || undefined, ...ubicacionABody(ubicacion) });
  };

  const handleEliminar = (id: number) => {
    Alert.alert("Eliminar dirección", "¿Estás seguro?", [
      { text: "No" },
      { text: "Sí", style: "destructive", onPress: () => mutEliminar.mutate(id) },
    ]);
  };

  const etiquetas = ["Casa", "Trabajo", "Otro"];

  return (
    <View className="flex-1" style={{ backgroundColor: "#FAFAF6" }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", paddingTop: insets.top + 12, paddingBottom: 16, paddingHorizontal: 16, backgroundColor: "#FAFAF6", borderBottomWidth: 1, borderBottomColor: "#EFEFEB" }}>
        <BackButton style={{ paddingRight: 16 }} />
        <Text style={{ flex: 1, fontSize: 17, fontWeight: "800", color: "#1A1C1A", textAlign: "center", marginRight: 60 }}>
          Mis Direcciones
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={!isLoading && isFetching} onRefresh={refetch} />}
      >
        {isError ? (
          <View className="items-center py-12">
            <Feather name="alert-circle" size={40} color="#D1D5DB" />
            <Text style={{ fontSize: 16, fontWeight: "600", color: "#6D7B6C", marginTop: 12 }}>No pudimos cargar tus direcciones</Text>
            <Pressable onPress={() => refetch()} style={{ marginTop: 12, paddingHorizontal: 24, paddingVertical: 10, backgroundColor: "#1FAF55", borderRadius: 999 }}>
              <Text style={{ color: "#fff", fontWeight: "600" }}>Reintentar</Text>
            </Pressable>
          </View>
        ) : isLoading ? (
          <Text style={{ color: "#9E9E9E", textAlign: "center", marginTop: 32 }}>Cargando...</Text>
        ) : direcciones.length === 0 && !mostrarForm ? (
          <View className="items-center py-12">
            <Feather name="map-pin" size={40} color="#D1D5DB" />
            <Text style={{ fontSize: 16, fontWeight: "600", color: "#6D7B6C", marginTop: 12 }}>No tienes direcciones guardadas</Text>
            <Text style={{ fontSize: 13, color: "#9E9E9E", marginTop: 4 }}>Agrega una para agilizar tus pedidos</Text>
          </View>
        ) : (
          direcciones.map((d) => (
            <View key={d.id} style={{ backgroundColor: "#fff", borderRadius: 16, padding: 16, borderWidth: 2, borderColor: d.predeterminada ? "#1FAF55" : "#F4F4F0" }}>
              <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                  <Feather name="map-pin" size={16} color={d.predeterminada ? "#1FAF55" : "#9E9E9E"} />
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text style={{ fontSize: 14, fontWeight: "700", color: "#1A1C1A" }}>{d.etiqueta}</Text>
                      {d.predeterminada && (
                        <View style={{ backgroundColor: "rgba(31,175,85,0.1)", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 }}>
                          <Text style={{ fontSize: 8, fontWeight: "700", color: "#1FAF55" }}>PREDETERMINADA</Text>
                        </View>
                      )}
                      {d.lat != null && (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 2, backgroundColor: "rgba(31,175,85,0.1)", borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}>
                          <Feather name="map-pin" size={8} color="#1FAF55" />
                          <Text style={{ fontSize: 8, fontWeight: "700", color: "#1FAF55" }}>CON UBICACIÓN</Text>
                        </View>
                      )}
                    </View>
                    <Text style={{ fontSize: 13, color: "#6D7B6C", marginTop: 2 }}>{d.direccion}</Text>
                    {d.barrio ? <Text style={{ fontSize: 12, color: "#9E9E9E", marginTop: 1 }}>{d.barrio}</Text> : null}
                    {d.notas ? <Text style={{ fontSize: 11, color: "#9E9E9E", fontStyle: "italic", marginTop: 2 }}>{d.notas}</Text> : null}
                  </View>
                </View>
                <Pressable
                  onPress={() => handleEliminar(d.id)}
                  style={{ padding: 4 }}
                  accessibilityLabel="Eliminar dirección"
                  accessibilityRole="button"
                >
                  <Feather name="trash-2" size={16} color="#D33587" />
                </Pressable>
              </View>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
                {!d.predeterminada && (
                  <Pressable onPress={() => mutPredeterminada.mutate(d.id)} style={{ flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: "#F4F4F0", alignItems: "center" }}>
                    <Text style={{ fontSize: 12, fontWeight: "600", color: "#1FAF55" }}>Predeterminada</Text>
                  </Pressable>
                )}
                <Pressable onPress={() => abrirMapaDireccion(d)} disabled={mutEditarUbic.isPending} style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 8, borderRadius: 8, backgroundColor: "#F4F4F0" }}>
                  <Feather name="map" size={12} color="#1FAF55" />
                  <Text style={{ fontSize: 12, fontWeight: "600", color: "#1FAF55" }}>{d.lat != null ? "Editar ubicación" : "Agregar ubicación"}</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}

        {/* Formulario nueva dirección */}
        {mostrarForm ? (
          <View style={{ backgroundColor: "#fff", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#E5E7EB" }}>
            <Text style={{ fontSize: 15, fontWeight: "700", color: "#1A1C1A", marginBottom: 16 }}>Nueva dirección</Text>

            {/* Ubicación GPS (opcional): al capturar, auto-llena la dirección (editable). */}
            <UbicacionButton
              value={ubicacion}
              onChange={(u) => {
                setUbicacion(u);
                if (u?.geocoded_direccion && !direccion.trim()) setDireccion(u.geocoded_direccion);
              }}
            />

            {/* Etiqueta */}
            <Text style={{ fontSize: 10, fontWeight: "700", color: "#6D7B6C", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Etiqueta</Text>
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
              {etiquetas.map((e) => (
                <Pressable key={e} onPress={() => setEtiqueta(e)} style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, backgroundColor: etiqueta === e ? "#1FAF55" : "#F4F4F0" }}>
                  <Text style={{ fontSize: 13, fontWeight: "600", color: etiqueta === e ? "#fff" : "#6D7B6C" }}>{e}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={{ fontSize: 10, fontWeight: "700", color: "#6D7B6C", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Dirección *</Text>
            <TextInput style={{ backgroundColor: "#F4F4F0", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 14, color: "#1A1C1A", marginBottom: 12 }} placeholder="Carrera 15 # 12-34" placeholderTextColor="#BCCABA" value={direccion} onChangeText={setDireccion} />

            <Text style={{ fontSize: 10, fontWeight: "700", color: "#6D7B6C", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Barrio</Text>
            <BarrioSelector
              value={barrioObj}
              onSelect={setBarrioObj}
              textoLibre={barrioTexto}
              onTextoLibreChange={setBarrioTexto}
            />

            <Text style={{ fontSize: 10, fontWeight: "700", color: "#6D7B6C", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Notas (opcional)</Text>
            <TextInput style={{ backgroundColor: "#F4F4F0", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 14, color: "#1A1C1A", marginBottom: 16 }} placeholder="Portería, dejar con vigilante..." placeholderTextColor="#BCCABA" value={notas} onChangeText={setNotas} multiline />

            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable onPress={() => { setMostrarForm(false); setUbicacion(null); }} style={{ flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: "#F4F4F0", alignItems: "center" }}>
                <Text style={{ fontSize: 14, fontWeight: "600", color: "#6D7B6C" }}>Cancelar</Text>
              </Pressable>
              <Pressable onPress={handleGuardar} disabled={mutCrear.isPending} style={{ flex: 2, paddingVertical: 12, borderRadius: 12, backgroundColor: "#1FAF55", alignItems: "center" }}>
                <Text style={{ fontSize: 14, fontWeight: "700", color: "#fff" }}>{mutCrear.isPending ? "Guardando..." : "Guardar"}</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable onPress={() => setMostrarForm(true)} style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 16, borderWidth: 2, borderColor: "#1FAF55", borderStyle: "dashed" }}>
            <Feather name="plus" size={18} color="#1FAF55" />
            <Text style={{ fontSize: 14, fontWeight: "700", color: "#1FAF55" }}>Agregar dirección</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}
