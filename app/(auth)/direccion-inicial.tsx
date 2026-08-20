/**
 * Dirección de entrega, justo después de registrarse.
 *
 * POR QUE EXISTE: hasta ahora la dirección se pedía en el carrito, al tocar
 * "Confirmar pedido". La telemetría dice lo que eso cuesta: de 24 clientes con
 * sesión que armaron carrito en tres días, 15 no tenían dirección guardada — y
 * todos los abandonos del checkout fueron por `sin_direccion` o `sin_ubicacion`.
 *
 * El cliente escogía productos, decidía comprar, y ahí se topaba con un trámite.
 * Pedirla acá cuesta lo mismo pero se paga cuando todavía no ha invertido nada,
 * y el carrito deja de ser una pared.
 *
 * SE PUEDE SALTAR a proposito. El punto del mapa es obligatorio para guardar
 * —una dirección sin coordenadas es una entrega que el domiciliario adivina—,
 * pero obligar a resolverlo AHORA dejaría afuera a quien tiene mala señal o
 * simplemente está mirando. Quien se salta encuentra el mismo muro de siempre en
 * el carrito, que es exactamente donde estábamos: no perdemos nada.
 */

import { useEffect, useRef, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Toast from "react-native-toast-message";
import { Feather } from "@expo/vector-icons";
import { getDirecciones, crearDireccion, ubicacionABody, type UbicacionCapturada } from "../../src/lib/api";
import { UbicacionButton } from "../../src/components/UbicacionButton";
import { BuscadorDireccion } from "../../src/components/BuscadorDireccion";
import { tracker } from "../../src/lib/tracker";
import { colors, radii, fuentes } from "../../src/constants/theme";

const ETIQUETAS = ["Casa", "Trabajo", "Otro"];

export default function DireccionInicialScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const [etiqueta, setEtiqueta] = useState("Casa");
  const [direccion, setDireccion] = useState("");
  const [notas, setNotas] = useState("");
  const [ubicacion, setUbicacion] = useState<UbicacionCapturada | null>(null);
  // Con el punto ya resuelto, la lista de "esto podria ser tu direccion" no
  // aporta nada y encima tapa el mapa que lo confirma.
  const [silenciado, setSilenciado] = useState(false);
  const vistoRef = useRef(false);

  // Quien ya tiene dirección no tiene nada que hacer aquí: pasa de largo. Cubre a
  // quien confirma edad tarde y ya había guardado una antes.
  const { data: direcciones, isLoading } = useQuery({
    queryKey: ["direcciones"],
    queryFn: getDirecciones,
    staleTime: 0,
  });

  useEffect(() => {
    if (!isLoading && direcciones && direcciones.length > 0) {
      router.replace("/(tabs)");
    }
  }, [isLoading, direcciones, router]);

  useEffect(() => {
    if (!isLoading && direcciones && direcciones.length === 0 && !vistoRef.current) {
      vistoRef.current = true;
      tracker.track("direccion_inicial_vista", undefined, "direccion-inicial");
    }
  }, [isLoading, direcciones]);

  const mutCrear = useMutation({
    // Envuelta a proposito: `crearDireccion` recibe una clave de idempotencia como
    // segundo argumento, y react-query le pasaria ahi su propio contexto.
    mutationFn: (datos: Parameters<typeof crearDireccion>[0]) => crearDireccion(datos),
    onSuccess: () => {
      // La lista de direcciones se consultó vacía segundos antes de guardar y el
      // caché la sirve por 5 minutos: sin invalidarla, el carrito y Mis
      // direcciones muestran "sin direcciones" justo después de guardar una.
      queryClient.invalidateQueries({ queryKey: ["direcciones"] });
      tracker.track("direccion_inicial_guardada", undefined, "direccion-inicial");
      Toast.show({ type: "success", text1: "Listo, ya tienes tu dirección" });
      router.replace("/(tabs)");
    },
    onError: (err: Error) =>
      Toast.show({ type: "error", text1: "No se pudo guardar", text2: err.message }),
  });

  const guardar = () => {
    if (!direccion.trim()) {
      Toast.show({ type: "error", text1: "Escribe tu dirección" });
      return;
    }
    // Mismo criterio que "Mis direcciones": sin punto no se guarda. El mapa
    // funciona sin permisos, así que siempre hay una salida.
    if (!ubicacion || ubicacion.lat == null) {
      Toast.show({
        type: "error",
        text1: "Falta el punto de entrega",
        text2: "Usa tu ubicación o ubícala en el mapa para que el domiciliario llegue exacto",
      });
      return;
    }
    mutCrear.mutate({
      etiqueta,
      direccion: direccion.trim(),
      notas: notas.trim() || undefined,
      predeterminada: true,
      ...ubicacionABody(ubicacion),
    });
  };

  const saltar = () => {
    tracker.track("direccion_inicial_saltada", undefined, "direccion-inicial");
    router.replace("/(tabs)");
  };

  // Mientras se sabe si ya tenía dirección, no se pinta el formulario: evita que
  // aparezca medio segundo y desaparezca solo.
  if (isLoading || (direcciones && direcciones.length > 0)) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={colors.green} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        automaticallyAdjustKeyboardInsets
        keyboardDismissMode="interactive"
        contentContainerStyle={{ padding: 24, paddingTop: insets.top + 32, paddingBottom: 40 }}
      >
        <View
          style={{
            width: 56, height: 56, borderRadius: 28, marginBottom: 20,
            alignItems: "center", justifyContent: "center",
            backgroundColor: "rgba(31,175,85,0.12)",
          }}
        >
          <Feather name="map-pin" size={26} color={colors.green} />
        </View>

        <Text style={{ fontSize: 26, fontFamily: fuentes.titulo, color: colors.ink, letterSpacing: -0.5 }}>
          ¿A dónde te llevamos el pedido?
        </Text>
        <Text style={{ fontSize: 15, lineHeight: 22, color: colors.muted, marginTop: 8, marginBottom: 24 }}>
          Guárdala una vez y pide en dos toques. Así el domiciliario llega exacto,
          sin llamarte.
        </Text>

        {/* Etiqueta */}
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
          {ETIQUETAS.map((e) => (
            <Pressable
              key={e}
              onPress={() => setEtiqueta(e)}
              accessibilityRole="button"
              accessibilityState={{ selected: etiqueta === e }}
              style={{
                paddingHorizontal: 16, minHeight: 40, justifyContent: "center",
                borderRadius: radii.input,
                backgroundColor: etiqueta === e ? colors.green : "#fff",
                borderWidth: 1,
                borderColor: etiqueta === e ? colors.green : colors.line,
              }}
            >
              <Text style={{ fontFamily: fuentes.destacado, fontSize: 14, color: etiqueta === e ? "#fff" : colors.muted }}>
                {e}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Dirección con autocompletado */}
        <Text style={{ fontSize: 13, fontFamily: fuentes.destacado, color: colors.muted, marginBottom: 6 }}>
          DIRECCIÓN
        </Text>
        <BuscadorDireccion
          value={direccion}
          // Escribir reactiva las sugerencias: fijar el punto no bloquea corregir
          // la direccion a mano despues.
          onChangeText={(t) => { setDireccion(t); setSilenciado(false); }}
          silenciado={silenciado}
          // Elegir una sugerencia tambien deja el punto resuelto.
          onUbicacion={(u) => { setUbicacion(u); setSilenciado(true); }}
          placeholder="Ej: Carrera 10 #16-85"
          accessibilityLabel="Tu dirección de entrega"
        />

        {/* Punto en el mapa */}
        <View style={{ marginTop: 16 }}>
          <UbicacionButton
            value={ubicacion}
            onChange={(u) => {
              setUbicacion(u);
              setSilenciado(!!u);
              // Si el punto trajo dirección y el campo está vacío, se rellena solo:
              // un toque menos y menos posibilidad de escribir algo que no cuadra.
              if (u?.geocoded_direccion && !direccion.trim()) {
                setDireccion(u.geocoded_direccion);
              }
            }}
          />
        </View>

        {/* Notas */}
        <Text style={{ fontSize: 13, fontFamily: fuentes.destacado, color: colors.muted, marginTop: 20, marginBottom: 6 }}>
          INDICACIONES (OPCIONAL)
        </Text>
        <TextInput
          value={notas}
          onChangeText={setNotas}
          placeholder="Ej: casa de rejas blancas, dejar con el vigilante"
          placeholderTextColor={colors.faint}
          accessibilityLabel="Indicaciones para el domiciliario"
          style={{
            backgroundColor: "#fff", borderRadius: radii.input,
            paddingHorizontal: 16, paddingVertical: 12,
            fontSize: 14, color: colors.ink, minHeight: 48,
          }}
        />

        <Pressable
          onPress={guardar}
          disabled={mutCrear.isPending}
          accessibilityRole="button"
          accessibilityLabel="Guardar mi dirección y continuar"
          accessibilityState={{ disabled: mutCrear.isPending }}
          style={{
            marginTop: 28, minHeight: 52, borderRadius: 26,
            backgroundColor: colors.green,
            alignItems: "center", justifyContent: "center",
            opacity: mutCrear.isPending ? 0.6 : 1,
          }}
        >
          {mutCrear.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: "#fff", fontFamily: fuentes.destacado, fontSize: 16 }}>Guardar y continuar</Text>
          )}
        </Pressable>

        <Pressable
          onPress={saltar}
          disabled={mutCrear.isPending}
          accessibilityRole="button"
          accessibilityLabel="Lo hago después, ir al catálogo"
          style={{ marginTop: 12, minHeight: 44, alignItems: "center", justifyContent: "center" }}
        >
          <Text style={{ color: colors.muted, fontFamily: fuentes.destacado, fontSize: 15 }}>Lo hago después</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
