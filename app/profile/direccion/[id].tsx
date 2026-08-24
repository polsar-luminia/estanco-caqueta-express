/**
 * Editar una dirección guardada (Direcciones 1.3.2, Hueco 2).
 *
 * Es PANTALLA, no <Modal>: el Toast raíz vive fuera de un Modal nativo y queda
 * detrás de él — ver el comentario en cart.tsx:762 sobre el mismo bug ya
 * pagado en este repo ("el aviso salía detrás... se veía como que el pedido
 * se colgó"). Esta pantalla tiene dos toasts de error, así que el Modal era
 * inviable. Como pantalla del Stack, además el mapa se abre sin el problema
 * de modal-sobre-modal que sí tiene HojaDireccion en modo "nueva".
 *
 * Qué edita: etiqueta, dirección (texto), notas y el punto en el mapa. NO
 * edita `predeterminada` — eso se queda en el botón de la tarjeta de
 * direcciones.tsx, que usa la ruta dedicada PUT /direcciones/:id/predeterminada
 * (sin transacción; meterlo aquí, en el PUT general que desmarca TODAS las del
 * cliente antes del UPDATE, sería un retroceso de un toque a tres).
 */

import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, ScrollView, TextInput } from "react-native";
import { Stack, useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import Toast from "react-native-toast-message";
import { BackButton } from "../../../src/components/BackButton";
import {
  getDirecciones,
  editarDireccion,
  ubicacionABody,
  type CrearDireccionInput,
  type UbicacionCapturada,
} from "../../../src/lib/api";
import { useConfirmarUbicacion } from "../../../src/hooks/useConfirmarUbicacion";
import { tracker } from "../../../src/lib/tracker";
import { colors, shadows, fuentes } from "../../../src/constants/theme";

const ORIGEN = "edicion";

interface CambiosTelemetria {
  [key: string]: boolean;
  cambio_etiqueta: boolean;
  cambio_direccion: boolean;
  cambio_notas: boolean;
  cambio_pin: boolean;
}

export default function EditarDireccionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const direccionId = Number(id);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const confirmarUbicacion = useConfirmarUbicacion();

  const { data: direcciones, isLoading } = useQuery({
    queryKey: ["direcciones"],
    queryFn: getDirecciones,
  });
  const original = direcciones?.find((d) => d.id === direccionId) ?? null;

  const [etiqueta, setEtiqueta] = useState("");
  const [direccion, setDireccion] = useState("");
  const [notas, setNotas] = useState("");
  const [ubicacion, setUbicacion] = useState<UbicacionCapturada | null>(null);
  const [pinTocado, setPinTocado] = useState(false);
  // Sembrar UNA vez por dirección, no en cada refetch: un `useEffect` atado a
  // la identidad del objeto (que cambia con cada invalidación — RefreshControl,
  // predeterminada, etc.) borraría lo que la persona está escribiendo a media
  // edición.
  const sembradoRef = useRef<number | null>(null);
  useEffect(() => {
    if (!original || sembradoRef.current === original.id) return;
    sembradoRef.current = original.id;
    setEtiqueta(original.etiqueta === "Casa" ? "" : original.etiqueta);
    setDireccion(original.direccion);
    setNotas(original.notas ?? "");
    setUbicacion(
      original.lat != null && original.lng != null
        ? {
            lat: original.lat,
            lng: original.lng,
            precision_m: original.precision_m ?? null,
            metodo_ubicacion: original.metodo_ubicacion === "pin_mapa" ? "pin_mapa" : "gps",
            geocoded_direccion: original.geocoded_direccion ?? null,
          }
        : null,
    );
    setPinTocado(false);
  }, [original]);

  const cambiosTelemetriaRef = useRef<CambiosTelemetria | null>(null);
  const mutGuardar = useMutation({
    mutationFn: (cambios: Partial<CrearDireccionInput>) => editarDireccion(direccionId, cambios),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["direcciones"] });
      if (cambiosTelemetriaRef.current) {
        tracker.track("direccion_editada", cambiosTelemetriaRef.current, ORIGEN);
      }
      Toast.show({ type: "success", text1: "Dirección actualizada" });
      router.back();
    },
    onError: (err: Error) => Toast.show({ type: "error", text1: "No se pudo guardar", text2: err.message }),
  });

  const handleGuardar = () => {
    if (!original) return;
    const direccionFinal = direccion.trim();
    if (!direccionFinal) {
      // Error INLINE, no toast: en un <Modal> el toast quedaría detrás (ver el
      // comentario del encabezado); en esta pantalla no hay ese riesgo, pero se
      // deja consistente con el resto de la pantalla, que ya usa avisos en línea.
      Toast.show({ type: "error", text1: "La dirección no puede quedar vacía" });
      return;
    }
    // Vacío = "Casa" explícito (a diferencia de crear, que OMITE el campo): el
    // PUT usa COALESCE, así que omitirlo dejaría la etiqueta vieja después de
    // que la persona la borró a propósito.
    const etiquetaFinal = etiqueta.trim() || "Casa";
    const notasFinal = notas.trim();

    const cambioEtiqueta = etiquetaFinal !== original.etiqueta;
    const cambioDireccion = direccionFinal !== original.direccion;
    const cambioNotas = notasFinal !== (original.notas ?? "");
    const cambioPin = pinTocado && !!ubicacion;

    const cambios: Partial<CrearDireccionInput> = {};
    if (cambioEtiqueta) cambios.etiqueta = etiquetaFinal;
    if (cambioDireccion) cambios.direccion = direccionFinal;
    // '' SÍ sobreescribe (a diferencia de omitir, que el COALESCE ignora): es
    // la única forma de borrar unas notas existentes.
    if (cambioNotas) cambios.notas = notasFinal;
    if (cambioPin) Object.assign(cambios, ubicacionABody(ubicacion));

    if (Object.keys(cambios).length === 0) {
      router.back();
      return;
    }
    cambiosTelemetriaRef.current = {
      cambio_etiqueta: cambioEtiqueta,
      cambio_direccion: cambioDireccion,
      cambio_notas: cambioNotas,
      cambio_pin: cambioPin,
    };
    mutGuardar.mutate(cambios);
  };

  // Abre el mapa centrado en el pin actual (o cerca del texto si no hay). La
  // salida "guardar sin el punto" (fuera de zona) no aplica aquí — la
  // dirección YA existe y ya se podía usar sin pin; no hay nada que mutar.
  const editarPunto = () => {
    confirmarUbicacion(direccion, ubicacion, (u, ctx) => {
      if (u == null || ctx.motivo === "fuera_zona") return;
      setUbicacion(u);
      setPinTocado(true);
    }, ORIGEN);
  };

  // Aviso de desfase (Direcciones 1.3.2): editar el texto de una dirección que
  // YA tiene pin es la primera forma de desaparear los dos — alguien se muda y
  // renombra "Casa" en vez de crear otra, y el domiciliario navega por el pin
  // pero lee el texto viejo. No se invalida el pin (uno viejo es mejor que
  // ninguno); solo se avisa y se ofrece revisarlo.
  const textoCambio = !!original && direccion.trim() !== original.direccion;
  const tienePinSinTocar = !pinTocado && ubicacion?.lat != null;
  const mostrarAvisoDesfase = textoCambio && tienePinSinTocar;

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={{ color: "#9E9E9E", fontFamily: fuentes.destacado }}>Cargando...</Text>
      </View>
    );
  }

  if (!original) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={{ flexDirection: "row", alignItems: "center", paddingTop: insets.top + 12, paddingBottom: 14, paddingHorizontal: 16 }}>
          <BackButton />
        </View>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
          <Feather name="alert-circle" size={40} color="#D1D5DB" />
          <Text style={{ fontSize: 15, fontFamily: fuentes.destacado, color: "#6D7B6C", marginTop: 12, textAlign: "center" }}>
            Esta dirección ya no existe
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={{ flexDirection: "row", alignItems: "center", paddingTop: insets.top + 12, paddingBottom: 14, paddingHorizontal: 16, backgroundColor: colors.bg }}>
        <BackButton style={{ paddingRight: 16 }} />
        <Text style={{ flex: 1, fontSize: 17, fontFamily: fuentes.destacado, color: "#1A1C1A", textAlign: "center", marginRight: 60 }}>
          Editar dirección
        </Text>
      </View>

      <ScrollView
        automaticallyAdjustKeyboardInsets
        keyboardDismissMode="interactive"
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      >
        <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 16, ...shadows.card }}>
          <Text style={{ fontSize: 12, fontFamily: fuentes.destacado, color: "#6D7B6C", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Etiqueta</Text>
          <TextInput
            style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 13, paddingHorizontal: 14, paddingVertical: 13, fontFamily: fuentes.destacado, fontSize: 14, color: colors.ink, marginBottom: 4 }}
            placeholder="Casa"
            placeholderTextColor="#BCCABA"
            value={etiqueta}
            onChangeText={setEtiqueta}
            maxLength={24}
            accessibilityLabel="Etiqueta de la dirección"
          />
          <Text style={{ fontSize: 11.5, fontFamily: fuentes.destacado, color: "#9AA69A", marginBottom: 16 }}>Si lo dejas vacío, la llamamos Casa.</Text>

          <Text style={{ fontSize: 12, fontFamily: fuentes.destacado, color: "#6D7B6C", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Dirección *</Text>
          <TextInput
            style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 13, paddingHorizontal: 14, paddingVertical: 13, fontFamily: fuentes.destacado, fontSize: 14, color: colors.ink, marginBottom: 4 }}
            placeholder="Ej: Carrera 15 # 12-34"
            placeholderTextColor="#BCCABA"
            value={direccion}
            onChangeText={setDireccion}
            maxLength={200}
            accessibilityLabel="Dirección"
          />

          {mostrarAvisoDesfase ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4, marginBottom: 4, backgroundColor: "rgba(220,38,38,0.08)", borderRadius: 8, padding: 10 }}>
              <Feather name="alert-triangle" size={14} color="#DC2626" />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12.5, lineHeight: 17, fontFamily: fuentes.destacado, color: "#DC2626" }}>
                  Cambiaste el texto — el punto en el mapa sigue siendo el de antes.
                </Text>
                <Pressable onPress={editarPunto} accessibilityRole="button" accessibilityLabel="Revisar el punto en el mapa" style={{ marginTop: 4 }}>
                  <Text style={{ fontSize: 12.5, fontFamily: fuentes.destacado, color: "#DC2626", textDecorationLine: "underline" }}>Revisar el punto</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          <View style={{ marginTop: 12, marginBottom: 16 }}>
            <Text style={{ fontSize: 12, fontFamily: fuentes.destacado, color: "#6D7B6C", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Punto en el mapa</Text>
            <Pressable
              onPress={editarPunto}
              accessibilityRole="button"
              accessibilityLabel={ubicacion?.lat != null ? "Ajustar el punto en el mapa" : "Ubicar el punto en el mapa"}
              style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, backgroundColor: colors.lowfill }}
            >
              <Feather name="map-pin" size={16} color={ubicacion?.lat != null ? "#1FAF55" : "#9E9E9E"} />
              <Text style={{ flex: 1, fontSize: 13.5, fontFamily: fuentes.destacado, color: ubicacion?.lat != null ? colors.ink : "#6D7B6C" }}>
                {ubicacion?.lat != null ? "Con punto en el mapa" : "Sin punto en el mapa"}
              </Text>
              <Text style={{ fontSize: 12.5, fontFamily: fuentes.destacado, color: "#1FAF55" }}>
                {ubicacion?.lat != null ? "Ajustar" : "Ubicar"}
              </Text>
            </Pressable>
          </View>

          <Text style={{ fontSize: 12, fontFamily: fuentes.destacado, color: "#6D7B6C", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Notas (opcional)</Text>
          <TextInput
            style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 13, paddingHorizontal: 14, paddingVertical: 13, fontFamily: fuentes.destacado, fontSize: 14, color: colors.ink }}
            placeholder="Ej: portería, dejar con vigilante"
            placeholderTextColor="#BCCABA"
            value={notas}
            onChangeText={setNotas}
            multiline
            maxLength={300}
          />
        </View>

        <Pressable
          onPress={handleGuardar}
          disabled={mutGuardar.isPending}
          accessibilityRole="button"
          accessibilityLabel="Guardar los cambios"
          accessibilityState={{ disabled: mutGuardar.isPending }}
          style={{ marginTop: 16, paddingVertical: 14, minHeight: 48, justifyContent: "center", borderRadius: 12, backgroundColor: "#1FAF55", alignItems: "center" }}
        >
          <Text style={{ fontSize: 15, fontFamily: fuentes.destacado, color: "#fff" }}>{mutGuardar.isPending ? "Guardando..." : "Guardar cambios"}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
