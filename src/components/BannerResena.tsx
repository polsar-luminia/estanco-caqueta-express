/**
 * Banner de "califica tu pedido" en Inicio (bloque C).
 *
 * El push llega una sola vez y muchas veces se descarta sin leer. Este banner es
 * la segunda oportunidad, en el sitio donde la gente entra sola.
 *
 * Reglas de convivencia, porque un banner mal puesto es peor que ninguno:
 *  - Solo el pedido entregado más reciente, y solo si es de los últimos 7 días.
 *    Pedirle a alguien que califique algo de hace tres semanas es pedirle que
 *    invente un recuerdo.
 *  - Se puede descartar, y el descarte se recuerda entre sesiones. Un banner que
 *    vuelve cada vez que abres la app deja de ser un pedido y pasa a ser un ruido.
 *  - Nunca aparece si el pedido ya tiene reseña.
 */

import { useEffect, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import { getPedidos } from "../lib/api";
import { tracker } from "../lib/tracker";
import { colors } from "../constants/theme";

const CLAVE_DESCARTADOS = "resenas_banner_descartados";
const DIAS_MAX = 7;

async function leerDescartados(): Promise<number[]> {
  try {
    const raw = await AsyncStorage.getItem(CLAVE_DESCARTADOS);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((n) => typeof n === "number") : [];
  } catch {
    return [];
  }
}

async function descartar(pedidoId: number) {
  try {
    const previos = await leerDescartados();
    // Solo los últimos 20: la lista no tiene por qué crecer para siempre.
    const nuevos = [pedidoId, ...previos.filter((n) => n !== pedidoId)].slice(0, 20);
    await AsyncStorage.setItem(CLAVE_DESCARTADOS, JSON.stringify(nuevos));
  } catch {
    // Si el almacenamiento falla, el banner reaparecerá. Es molesto, no grave.
  }
}

export function BannerResena({ habilitado }: { habilitado: boolean }) {
  const router = useRouter();
  const [descartados, setDescartados] = useState<number[] | null>(null);
  const [vistoRegistrado, setVistoRegistrado] = useState(false);

  useEffect(() => {
    leerDescartados().then(setDescartados);
  }, []);

  const { data: pedidos = [] } = useQuery({
    queryKey: ["pedidos"],
    queryFn: getPedidos,
    enabled: habilitado,
    staleTime: 5 * 60 * 1000,
  });

  // Hasta saber qué descartó, no se muestra nada: parpadear un banner y quitarlo
  // es peor que esperar un instante.
  const listo = descartados !== null;

  const limite = Date.now() - DIAS_MAX * 24 * 60 * 60 * 1000;
  const pendiente = listo
    ? pedidos.find(
        (p) =>
          p.estado === "entregado" &&
          !p.tiene_resena &&
          !descartados!.includes(p.id) &&
          new Date(p.entregado_at ?? p.created_at).getTime() > limite,
      )
    : undefined;

  useEffect(() => {
    if (pendiente && !vistoRegistrado) {
      setVistoRegistrado(true);
      tracker.track("resena_banner_visto", undefined, "index");
    }
  }, [pendiente, vistoRegistrado]);

  if (!pendiente) return null;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        backgroundColor: colors.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.line,
        padding: 14,
        marginHorizontal: 16,
        marginBottom: 12,
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "rgba(228,164,0,0.12)",
        }}
      >
        <Feather name="star" size={20} color="#E4A400" />
      </View>

      <Pressable
        onPress={() =>
          router.push({
            pathname: "/(tabs)/orders/[id]",
            params: { id: String(pendiente.id), calificar: "1" },
          })
        }
        accessibilityRole="button"
        accessibilityLabel={`Calificar tu pedido número ${pendiente.numero_orden_cliente ?? pendiente.id}`}
        style={{ flex: 1, minHeight: 44, justifyContent: "center" }}
      >
        <Text style={{ fontSize: 15, fontWeight: "700", color: colors.ink }}>
          ¿Cómo te fue con tu pedido?
        </Text>
        <Text style={{ fontSize: 13, color: colors.muted, marginTop: 1 }}>
          Califícanos en 10 segundos
        </Text>
      </Pressable>

      <Pressable
        onPress={() => {
          tracker.track("resena_banner_descartado", undefined, "index");
          descartar(pendiente.id);
          setDescartados((prev) => [pendiente.id, ...(prev ?? [])]);
        }}
        accessibilityRole="button"
        accessibilityLabel="Descartar"
        hitSlop={8}
        style={{ minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" }}
      >
        <Feather name="x" size={18} color={colors.faint} />
      </Pressable>
    </View>
  );
}
