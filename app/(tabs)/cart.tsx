// "Tu canasta" — pantalla PREVIA al checkout (Rediseño canasta/checkout,
// estilo Rappi, plan §Parte 2). Antes esta ruta ERA el checkout completo
// (dirección, medio de pago, cupón, frío, confirmar); todo eso se movió a
// app/checkout/index.tsx casi verbatim. Esta pantalla se quedó con lo que
// antes vivía detrás de un acordeón colapsado por defecto — la lista de
// productos — y gana una sección nueva: "Complementa tu pedido".
import { useCallback, useRef } from "react";
import { View, Text, FlatList, Pressable, Alert } from "react-native";
import { Redirect, useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
import { useCartStore } from "../../src/stores/cart";
import { useAuthStore } from "../../src/stores/auth";
import { useTiendaAbierta } from "../../src/hooks/useTiendaAbierta";
import { useRefrescoCarrito } from "../../src/hooks/useRefrescoCarrito";
import { getConfigApp } from "../../src/lib/api";
import { tracker } from "../../src/lib/tracker";
import { formatCOP } from "../../src/lib/format";
import { CartItem } from "../../src/components/CartItem";
import { CartIcon } from "../../src/components/icons/TabIcons";
import { BandaOperativa } from "../../src/components/BandaOperativa";
import { BandaCerrado } from "../../src/components/BandaCerrado";
import { ComplementaTuPedido } from "../../src/components/canasta/ComplementaTuPedido";
import { colors, fuentes } from "../../src/constants/theme";

function ChevronRightIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M9 18l6-6-6-6" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export default function CartScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const items = useCartStore((s) => s.items);
  // Selector inline (no metodo): los metodos del store no son reactivos a cambios de items
  const subtotal = useCartStore((s) => s.items.reduce((sum, i) => sum + i.cantidad * i.precioUnitario, 0));
  const clear = useCartStore((s) => s.clear);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isAuthLoading = useAuthStore((s) => s.isLoading);
  const tienda = useTiendaAbierta();

  // Precio/stock/cupo: vive en las DOS pantallas del checkout (ver
  // useRefrescoCarrito) para que lo que se ve acá no diverja de lo que
  // cobra el servidor.
  useRefrescoCarrito();

  const { data: configApp } = useQuery({
    queryKey: ["config-app"],
    queryFn: getConfigApp,
    staleTime: 5 * 60 * 1000,
  });
  const pedidoMinimo = configApp?.pedido_minimo ?? 30000;

  // Guard de registro, telemetría de muro. ÚNICO sitio donde vive: el
  // checkout ahora solo tiene una versión defensiva sin evento propio (deep
  // link directo a /checkout sin sesión) — el camino normal SIEMPRE pasa
  // por aquí primero, así que aquí es donde se mide de verdad.
  const muroTrackeadoRef = useRef(false);
  const continuarTrackeadoRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      continuarTrackeadoRef.current = false;
    }, [])
  );

  if (isAuthLoading) return null;
  if (!isAuthenticated && items.length > 0) {
    if (!muroTrackeadoRef.current) {
      muroTrackeadoRef.current = true;
      tracker.track('registro_muro_mostrado', { items_count: items.length, subtotal }, 'cart');
    }
    return <Redirect href={{ pathname: "/(auth)/register", params: { origen: "checkout" } }} />;
  }

  if (items.length === 0) {
    return (
      <View className="flex-1 items-center justify-center px-6" style={{ backgroundColor: colors.bg }}>
        <CartIcon color="#BCCABA" size={48} />
        <Text style={{ fontSize: 20, fontFamily: fuentes.titulo, color: "#6D7B6C", marginBottom: 6 }}>Carrito vacío</Text>
        <Text style={{ color: "#BCCABA", textAlign: "center", fontFamily: fuentes.destacado, fontSize: 14 }}>
          Agrega productos desde el catálogo para hacer tu pedido
        </Text>
      </View>
    );
  }

  const vaciarCanasta = () => {
    // Destructivo y sin deshacer: confirmar antes, mismo criterio que
    // cualquier borrado del repo.
    Alert.alert(
      "¿Vaciar tu canasta?",
      "Se eliminarán todos los productos.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Vaciar",
          style: "destructive",
          onPress: () => {
            tracker.track('canasta_vaciada', { items_count: items.length, subtotal }, 'cart');
            clear();
          },
        },
      ]
    );
  };

  const continuar = () => {
    if (!continuarTrackeadoRef.current) {
      continuarTrackeadoRef.current = true;
      tracker.track('canasta_continuar', { items_count: items.length, subtotal }, 'cart');
    }
    router.push("/checkout");
  };

  const bloqueado = !tienda.abierta || subtotal < pedidoMinimo;

  // Espacio libre bajo el botón: esta pantalla SÍ vive dentro de (tabs), así
  // que sigue pagando la tab bar flotante (bottom = insets.bottom-6, o 18
  // sin inset, más su alto de 58) — misma fórmula de siempre, para no
  // desalinearse si la barra cambia.
  const altoTabBarFlotante = (insets.bottom > 0 ? insets.bottom - 6 : 18) + 58;
  const respiroBarra = altoTabBarFlotante + 12;

  return (
    <View className="flex-1" style={{ backgroundColor: colors.bg }}>
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.productoId)}
        contentContainerStyle={{ padding: 16, paddingTop: insets.top + 8, paddingBottom: 24 }}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        renderItem={({ item }) => <CartItem item={item} />}
        ListFooterComponent={
          <View style={{ marginTop: 12, gap: 20 }}>
            <Pressable
              onPress={vaciarCanasta}
              accessibilityRole="button"
              accessibilityLabel="Vaciar canasta"
              style={{ alignSelf: "center", padding: 8 }}
            >
              <Text style={{ fontFamily: fuentes.destacado, fontSize: 14, color: colors.offer }}>Vaciar canasta</Text>
            </Pressable>

            <ComplementaTuPedido items={items} />
          </View>
        }
      />

      <View
        className="bg-white px-6 pt-4"
        style={{
          paddingBottom: respiroBarra,
          borderTopWidth: 1,
          borderTopColor: "#E8E8E5",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.06,
          shadowRadius: 12,
          elevation: 10,
        }}
      >
        <BandaCerrado tienda={tienda} compact style={{ marginBottom: 12 }} />
        <BandaOperativa tienda={tienda} compact style={{ marginBottom: 12 }} />

        <View className="flex-row items-center justify-between">
          <View>
            <Text style={{ fontFamily: fuentes.destacado, fontSize: 12, color: "#6D7B6C" }}>Subtotal</Text>
            <Text style={{ fontFamily: fuentes.titulo, fontSize: 20, color: colors.ink }}>{formatCOP(subtotal)}</Text>
            {subtotal < pedidoMinimo && (
              <Text style={{ fontSize: 11, color: colors.offer, fontFamily: fuentes.destacado, marginTop: 2 }}>
                Mínimo {formatCOP(pedidoMinimo)}
              </Text>
            )}
          </View>

          <Pressable
            onPress={continuar}
            disabled={bloqueado}
            accessibilityRole="button"
            accessibilityLabel={`Continuar con tu pedido, subtotal ${formatCOP(subtotal)}`}
            accessibilityState={{ disabled: bloqueado }}
          >
            <LinearGradient
              colors={
                !tienda.abierta ? ["#3D3D3D", "#2A2A2A"] :
                subtotal < pedidoMinimo ? ["#BCCABA", "#9EA89D"] :
                ["#1FAF55", "#006D30"]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                borderRadius: 999,
                paddingVertical: 14,
                paddingHorizontal: 28,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                shadowColor: tienda.abierta ? "#1FAF55" : "#000",
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: tienda.abierta ? 0.3 : 0.1,
                shadowRadius: 16,
                elevation: 6,
              }}
            >
              <Text style={{ color: "#fff", fontFamily: fuentes.destacado, fontSize: 16, marginRight: 6 }}>
                {!tienda.abierta ? "Tienda cerrada" : "Continuar"}
              </Text>
              {tienda.abierta && <ChevronRightIcon />}
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
