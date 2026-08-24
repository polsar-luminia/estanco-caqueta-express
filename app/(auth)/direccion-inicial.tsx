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
 * El punto del mapa es obligatorio SIEMPRE: una dirección sin coordenadas es una
 * entrega que el domiciliario adivina, y el mapa funciona sin ningún permiso
 * (`ubicacion.tsx` nunca exige el GPS y cae al centro de Florencia), así que no
 * deja a nadie encerrado.
 *
 * SE PUEDE SALTAR solo mientras `direccion_obligatoria_registro` esté apagada.
 * El argumento para dejar saltar era "quien se salta encuentra el mismo muro en
 * el carrito, no perdemos nada", y los datos del 20-ago-2026 lo desmienten: de
 * 62 devices que tocaron "Lo hago después", 8 tienen dirección hoy. Y de las 78
 * cuentas sin dirección de la quincena, 75 vieron ESTA pantalla y 37 llegaron
 * igual hasta el carrito. El muro de abajo no recoge a nadie.
 */

import { useEffect, useRef, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Toast from "react-native-toast-message";
import { Feather } from "@expo/vector-icons";
import { getDirecciones, crearDireccion, getConfigApp, ubicacionABody, type UbicacionCapturada } from "../../src/lib/api";
import { UbicacionButton } from "../../src/components/UbicacionButton";
import { BuscadorDireccion } from "../../src/components/BuscadorDireccion";
import { tracker } from "../../src/lib/tracker";
import { useAuthStore } from "../../src/stores/auth";
import { colors, radii, fuentes } from "../../src/constants/theme";

export default function DireccionInicialScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const [etiqueta, setEtiqueta] = useState("");
  // Salida de "fuera de zona" del mapa (Direcciones 1.3.2): ver direcciones.tsx.
  const [permitirSinPin, setPermitirSinPin] = useState(false);
  const [direccion, setDireccion] = useState("");
  const [notas, setNotas] = useState("");
  const [ubicacion, setUbicacion] = useState<UbicacionCapturada | null>(null);
  // Con el punto ya resuelto, la lista de "esto podria ser tu direccion" no
  // aporta nada y encima tapa el mapa que lo confirma.
  const [silenciado, setSilenciado] = useState(false);
  const vistoRef = useRef(false);

  // Muro de dirección (089). Apagada = la pantalla de siempre, con su botón de
  // saltar y con el punto obligatorio.
  const { data: configApp } = useQuery({
    queryKey: ["config-app"],
    queryFn: getConfigApp,
    staleTime: 5 * 60 * 1000,
  });
  const obligatoria = configApp?.direccion_obligatoria_registro === true;
  const setCliente = useAuthStore((s) => s.setCliente);
  const cliente = useAuthStore((s) => s.cliente);

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
      // El guard del catálogo lee `cliente.tiene_direccion`. Se marca AQUI, en
      // local, y no con un getPerfil(): acabamos de crear la dirección, o sea que
      // ya sabemos la respuesta, y hacerla depender de la red significaría que un
      // refetch fallido deja a la persona encerrada dando vueltas en el muro.
      if (cliente) setCliente({ ...cliente, tiene_direccion: true });
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
    // Sin punto no se guarda, con muro o sin él — salvo `permitirSinPin`, que
    // solo se enciende cuando el mapa mismo dijo "fuera de zona" y la persona
    // eligió guardar el texto de todos modos (Direcciones 1.3.2).
    //
    // Antes esta línea decía `!obligatoria &&`: prender el muro RELAJABA el pin,
    // por miedo a dejar sin cuenta a quien niega el GPS. El miedo no se sostiene
    // —el mapa no pide permiso y son 6 devices en toda la historia los que han
    // negado el GPS—, y con `exigir_ubicacion` prendida era además contradictorio:
    // esa persona chocaba igual contra el checkout, con el carrito lleno, que es
    // exactamente lo que este muro existe para evitar.
    if ((!ubicacion || ubicacion.lat == null) && !permitirSinPin) {
      Toast.show({
        type: "error",
        text1: "Falta el punto de entrega",
        text2: "Usa tu ubicación o ubícala en el mapa para que el domiciliario llegue exacto",
      });
      return;
    }
    if (!ubicacion) {
      tracker.track("direccion_sin_pin_guardada", { origen: "onboarding" }, "direccion-inicial");
    }
    mutCrear.mutate({
      // Vacío se OMITE: el servidor aplica su default ('Casa').
      ...(etiqueta.trim() ? { etiqueta: etiqueta.trim() } : {}),
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
        <Text style={{ fontFamily: fuentes.destacado, fontSize: 15, lineHeight: 22, color: colors.muted, marginTop: 8, marginBottom: 24 }}>
          Guárdala una vez y pide en dos toques. Así el domiciliario llega exacto,
          sin llamarte.
        </Text>

        {/* Etiqueta libre (Direcciones 1.3.2): ver direcciones.tsx — mismo
            razonamiento, se cayeron los chips "Casa/Trabajo/Otro". */}
        <Text style={{ fontSize: 13, fontFamily: fuentes.destacado, color: colors.muted, marginBottom: 6 }}>
          ETIQUETA (OPCIONAL)
        </Text>
        <TextInput
          value={etiqueta}
          onChangeText={setEtiqueta}
          maxLength={24}
          placeholder="Casa"
          placeholderTextColor={colors.faint}
          accessibilityLabel="Etiqueta de la dirección"
          style={{
            backgroundColor: "#fff", borderRadius: radii.input,
            paddingHorizontal: 16, paddingVertical: 12,
            fontFamily: fuentes.destacado, fontSize: 14, color: colors.ink, minHeight: 48,
            marginBottom: 16,
          }}
        />

        {/* Dirección con autocompletado */}
        <Text style={{ fontSize: 13, fontFamily: fuentes.destacado, color: colors.muted, marginBottom: 6 }}>
          DIRECCIÓN
        </Text>
        <BuscadorDireccion
          value={direccion}
          // Escribir reactiva las sugerencias: fijar el punto no bloquea corregir
          // la direccion a mano despues.
          onChangeText={(t) => { setDireccion(t); setSilenciado(false); setPermitirSinPin(false); }}
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
            textoDireccion={direccion}
            origen="onboarding"
            onSinPin={() => setPermitirSinPin(true)}
            onChange={(u) => {
              setUbicacion(u);
              setSilenciado(!!u);
              // Alineado con perfil y checkout (Direcciones 1.3.2): un punto
              // elegido en el mapa (pin_mapa) siempre reescribe la dirección;
              // antes solo rellenaba si el campo estaba vacío. El GPS sigue sin
              // pisar lo escrito.
              if (u?.geocoded_direccion && (u.metodo_ubicacion === "pin_mapa" || !direccion.trim())) {
                setDireccion(u.geocoded_direccion);
              }
            }}
          />
        </View>

        {permitirSinPin && (!ubicacion || ubicacion.lat == null) ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12, backgroundColor: "rgba(220,38,38,0.08)", borderRadius: 8, padding: 10 }}>
            <Feather name="alert-triangle" size={14} color="#DC2626" />
            <Text style={{ flex: 1, fontSize: 12.5, lineHeight: 17, fontFamily: fuentes.destacado, color: "#DC2626" }}>
              Fuera de nuestra zona · se guardará sin punto en el mapa
            </Text>
          </View>
        ) : null}

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
            fontFamily: fuentes.destacado, fontSize: 14, color: colors.ink, minHeight: 48,
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

        {/* De los 61 que tocaron "Lo hago después", solo 7 crearon dirección
            algún día: los otros 54 nunca tuvieron ninguna. La salida no aplazaba
            el trámite, lo cancelaba. Con la bandera prendida el botón no existe. */}
        {!obligatoria && (
          <Pressable
            onPress={saltar}
            disabled={mutCrear.isPending}
            accessibilityRole="button"
            accessibilityLabel="Lo hago después, ir al catálogo"
            style={{ marginTop: 12, minHeight: 44, alignItems: "center", justifyContent: "center" }}
          >
            <Text style={{ color: colors.muted, fontFamily: fuentes.destacado, fontSize: 15 }}>Lo hago después</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}
