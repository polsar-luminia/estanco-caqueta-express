/**
 * Campo de dirección con autocompletado de Google Places.
 *
 * Es el tercer camino para fijar el punto de entrega, junto al botón de ubicación
 * actual y al mapa. El cliente escribe, toca una sugerencia, y el pin queda puesto
 * sin arrastrar nada.
 *
 * Las sugerencias las sirve nuestro backend, no Google directamente (la llave es
 * facturable y no puede viajar en el binario — ver src/lib/places.ts). Si el
 * servidor no tiene llave, devuelve lista vacía y esto se comporta como el campo
 * de texto de siempre: sin sugerencias, sin errores, sin diferencia visible.
 */

import { useEffect, useRef, useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import {
  buscarDirecciones,
  resolverDireccion,
  type SugerenciaDireccion,
} from "../lib/places";
import { nuevoUuidV4 } from "../lib/uuid";
import { colors, radii, fuentes } from "../constants/theme";
import type { UbicacionCapturada } from "../lib/api";
import { useZonaEntrega } from "../hooks/useZonaEntrega";
import { tracker } from "../lib/tracker";

const DEBOUNCE_MS = 350;

export interface BuscadorDireccionProps {
  value: string;
  onChangeText: (t: string) => void;
  /** Se llama al elegir una sugerencia, ya con las coordenadas resueltas. */
  onUbicacion: (u: UbicacionCapturada) => void;
  placeholder?: string;
  accessibilityLabel?: string;
  /**
   * Silencia las sugerencias sin desmontar el campo.
   *
   * Lo usa quien ya tiene el punto resuelto —por GPS o por el mapa—. Ahi la lista
   * de "esto podria ser tu direccion" no aporta nada: el punto exacto ya esta, y
   * encima tapa el mapa que lo confirma.
   *
   * Hace falta porque fijar la ubicacion RELLENA este campo, y ese cambio dispara
   * la busqueda igual que si el cliente hubiera escrito. El componente no puede
   * distinguir por si solo quien escribio.
   *
   * Vuelve a false apenas el cliente teclea, asi que no bloquea corregir la
   * direccion a mano despues de poner el pin.
   */
  silenciado?: boolean;
}

export function BuscadorDireccion({
  value,
  onChangeText,
  onUbicacion,
  placeholder = "Escribe tu dirección",
  accessibilityLabel = "Dirección",
  silenciado = false,
}: BuscadorDireccionProps) {
  const [sugerencias, setSugerencias] = useState<SugerenciaDireccion[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [resolviendo, setResolviendo] = useState(false);
  // Dirección elegida fuera de la zona de reparto: se rechaza y se explica aquí
  // mismo, debajo del campo. Se limpia apenas el cliente vuelve a escribir.
  const [errorCampo, setErrorCampo] = useState<string | null>(null);
  const { fueraDeZona } = useZonaEntrega();
  // Una sola sesión desde que empieza a escribir hasta que elige: Google cobra
  // por sesión, no por tecla. Sin esto, cada letra sería una búsqueda facturable.
  const sesionRef = useRef<string>(nuevoUuidV4());
  // Al aplicar una sugerencia cambia el texto, y ese cambio no debe disparar otra
  // búsqueda: si no, la lista reaparece justo después de elegir.
  const ignorarProximaRef = useRef(false);

  useEffect(() => {
    // La app ya no sabe —ni necesita saber— si el backend tiene llave de Places
    // configurada: si no la tiene, devuelve lista vacía y aquí simplemente no se
    // muestra nada. Un dato menos que mantener sincronizado entre los dos lados.
    if (ignorarProximaRef.current) {
      ignorarProximaRef.current = false;
      return;
    }
    // Punto ya resuelto: ni se busca ni se deja lista colgando de antes.
    if (silenciado) {
      setSugerencias([]);
      return;
    }
    if (value.trim().length < 3) {
      setSugerencias([]);
      return;
    }

    const control = new AbortController();
    const t = setTimeout(async () => {
      setBuscando(true);
      const r = await buscarDirecciones(value, sesionRef.current, control.signal);
      setSugerencias(r);
      setBuscando(false);
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(t);
      control.abort();
    };
  }, [value, silenciado]);

  const elegir = async (s: SugerenciaDireccion) => {
    setResolviendo(true);
    setSugerencias([]);
    const r = await resolverDireccion(s.id, sesionRef.current);
    // La sesión se cierra al pedir el detalle; la siguiente búsqueda abre otra.
    sesionRef.current = nuevoUuidV4();
    setResolviendo(false);

    // Antes esto era `if (!r) return`: silencio absoluto. La sugerencia NO trae
    // coordenadas —hay que pedirlas en un segundo viaje— y `resolverDireccion`
    // devuelve null ante cualquier fallo, asi que tocar la sugerencia no hacia
    // nada: ni pin, ni aviso, ni error. La persona toca, no pasa nada, y termina
    // dandole al boton verde de abajo. Es la explicacion mas probable de las 80
    // direcciones guardadas sin punto, y no dejaba ni un rastro para medirlo.
    if (!r) {
      setErrorCampo("No pudimos ubicar esa dirección. Escríbela y ubica el punto en el mapa.");
      return;
    }

    // El proxy de Places restringe las sugerencias a un círculo de 15 km, pero la
    // zona de reparto es más chica: en ese anillo Google resuelve direcciones a
    // las que no se llega. Se rechaza aquí, antes de poner el pin — sin esto el
    // rechazo se lo daría el servidor al final del checkout, que es peor momento.
    if (fueraDeZona(r.lat, r.lng)) {
      tracker.track("fuera_de_zona", { lat: r.lat, lng: r.lng }, "buscador_direccion");
      setErrorCampo("Esa dirección está fuera de nuestra zona de entrega. Por ahora no llegamos hasta allá.");
      return;
    }
    setErrorCampo(null);

    ignorarProximaRef.current = true;
    onChangeText(r.direccion || s.principal);
    onUbicacion({
      lat: r.lat,
      lng: r.lng,
      precision_m: null,
      // No es GPS ni un pin arrastrado: es un punto de Google. Se registra como
      // pin_mapa porque, igual que el pin, es una posición elegida y no medida.
      metodo_ubicacion: "pin_mapa",
      geocoded_direccion: r.direccion || null,
    });
  };

  return (
    <View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          backgroundColor: "#fff",
          borderRadius: radii.input,
          paddingHorizontal: 16,
          minHeight: 48,
        }}
      >
        <Feather name="search" size={16} color={colors.faint} />
        <TextInput
          style={{ flex: 1, fontFamily: fuentes.destacado, fontSize: 14, color: colors.ink, paddingVertical: 12 }}
          placeholder={placeholder}
          placeholderTextColor={colors.faint}
          value={value}
          onChangeText={(t) => {
            setErrorCampo(null);
            onChangeText(t);
          }}
          accessibilityLabel={accessibilityLabel}
        />
        {(buscando || resolviendo) && <ActivityIndicator size="small" color={colors.green} />}
        {value.length > 0 && !buscando && !resolviendo && (
          <Pressable
            onPress={() => { onChangeText(""); setSugerencias([]); setErrorCampo(null); }}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Borrar la dirección escrita"
          >
            <Feather name="x" size={16} color={colors.faint} />
          </Pressable>
        )}
      </View>

      {errorCampo && (
        <Text
          accessibilityRole="alert"
          style={{ fontFamily: fuentes.destacado, fontSize: 12, color: colors.danger, marginTop: 6, paddingHorizontal: 4 }}
        >
          {errorCampo}
        </Text>
      )}

      {!silenciado && sugerencias.length > 0 && (
        <View
          style={{
            backgroundColor: "#fff",
            borderRadius: radii.input,
            marginTop: 6,
            overflow: "hidden",
            borderWidth: 1,
            borderColor: colors.line,
          }}
        >
          {sugerencias.map((s, i) => (
            <Pressable
              key={s.id}
              onPress={() => elegir(s)}
              accessibilityRole="button"
              accessibilityLabel={`Usar la dirección ${s.principal}, ${s.secundaria}`}
              // OJO: objeto plano, NO `({ pressed }) => ({...})`.
              //
              // La forma de funcion se agrego el 20-ago-2026 para pintar el fondo
              // al presionar, y rompio la fila entera: el `flexDirection: "row"`
              // dejaba de aplicarse y el pin quedaba ENCIMA de la direccion con la
              // flecha DEBAJO, en columna. Costo dos vueltas de diagnostico porque
              // el sintoma parecia de flexbox y no de como se pasa el estilo.
              //
              // Lo que lo delato: esta era la unica de las 112 filas horizontales
              // de la app escrita con la forma de funcion. Las otras 111 usan
              // objeto plano y todas funcionan. Si algun dia hace falta feedback
              // de presionado aqui, probarlo en el simulador ANTES de darlo por
              // bueno — no confiar en que la forma de funcion se comporte igual.
              style={{
                minHeight: 52,
                flexDirection: "row",
                alignItems: "flex-start",
                gap: 10,
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderTopWidth: i === 0 ? 0 : 0.5,
                borderTopColor: colors.line,
              }}
            >
              {/* Segunda vuelta sobre esto (20-ago-2026): la primera version
                  agregaba un subtitulo de texto porque el icono solo no
                  explicaba nada. El dueño la rechazo — un mensaje explicando
                  como usar la interfaz es la interfaz fallando, no una ayuda.
                  Se reemplaza por diseño: el pin alineado con la PRIMERA linea
                  (no centrado contra las dos, que lo dejaba flotando entre
                  ambas y por eso "no se entendia"), y un icono de accion a la
                  derecha en vez de nada — "send" en vez de chevron, porque esto
                  ENVIA/APLICA la direccion, no navega a otra pantalla. */}
              <Feather name="map-pin" size={16} color={colors.green} style={{ marginTop: 1 }} />
              <View style={{ flex: 1 }}>
                <Text
                  numberOfLines={1}
                  style={{ fontSize: 14, fontFamily: fuentes.destacado, color: colors.ink }}
                >
                  {s.principal}
                </Text>
                {!!s.secundaria && (
                  <Text
                    numberOfLines={1}
                    style={{ fontFamily: fuentes.destacado, fontSize: 12, color: colors.muted, marginTop: 1 }}
                  >
                    {s.secundaria}
                  </Text>
                )}
              </View>
              <Feather name="send" size={16} color={colors.green} style={{ marginTop: 1 }} />
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}
