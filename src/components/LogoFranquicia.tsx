// Logo de la franquicia de una tarjeta guardada ("Mis tarjetas", checkout).
//
// No usamos el logotipo oficial de Visa/Mastercard: son marcas registradas y
// este repo no tiene una licencia de marca ni el asset oficial (los demás
// íconos de la app son SVG propios en src/components/icons/, nunca logos de
// terceros). En vez de eso: una insignia estilizada que identifica la red
// sin reproducir el logotipo protegido -- mismo criterio que un montón de
// apps de billetera usan para "chip + red" cuando no tienen convenio de
// marca. Para cualquier brand que no reconozcamos (Wompi manda lo que el
// emisor reporte; "AMEX", "DINERS", vacío, etc.) cae a un ícono genérico de
// tarjeta (Feather credit-card), igual que ICONO_MEDIO_GENERICO en
// constants/config.ts -- un brand nuevo no debe romper la pantalla.

import { View, Text } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors } from "../constants/theme";

const TAMANO_DEFECTO = 44;

function normalizarBrand(brand: string): "VISA" | "MASTERCARD" | null {
  const b = brand.trim().toUpperCase();
  if (b.includes("VISA")) return "VISA";
  if (b.includes("MASTER")) return "MASTERCARD";
  return null;
}

export function LogoFranquicia({
  brand,
  size = TAMANO_DEFECTO,
}: {
  brand: string;
  size?: number;
}) {
  const marca = normalizarBrand(brand ?? "");

  if (marca === "VISA") {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: 12,
          backgroundColor: "#1A1F71",
          alignItems: "center",
          justifyContent: "center",
        }}
        accessibilityLabel="Visa"
      >
        <Text
          style={{
            color: "#fff",
            fontSize: size * 0.27,
            fontStyle: "italic",
            fontWeight: "700",
            letterSpacing: 0.5,
          }}
        >
          VISA
        </Text>
      </View>
    );
  }

  if (marca === "MASTERCARD") {
    // Dos círculos superpuestos: describe la red (dos emisores unidos) sin
    // reproducir el logotipo oficial de Mastercard (colores/proporciones
    // exactas registrados como marca).
    const circulo = size * 0.52;
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: 12,
          backgroundColor: "#F1F4F0",
          alignItems: "center",
          justifyContent: "center",
        }}
        accessibilityLabel="Mastercard"
      >
        <View style={{ flexDirection: "row" }}>
          <View
            style={{
              width: circulo,
              height: circulo,
              borderRadius: circulo / 2,
              backgroundColor: "#EB6F3E",
              marginRight: -circulo * 0.35,
            }}
          />
          <View
            style={{
              width: circulo,
              height: circulo,
              borderRadius: circulo / 2,
              backgroundColor: "#E4A400",
              opacity: 0.85,
            }}
          />
        </View>
      </View>
    );
  }

  // Genérico: mismo molde que ICONO_MEDIO_GENERICO.
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 12,
        backgroundColor: "rgba(150,150,150,0.08)",
        alignItems: "center",
        justifyContent: "center",
      }}
      accessibilityLabel={brand || "Tarjeta"}
    >
      <Feather name="credit-card" size={size * 0.45} color={colors.muted} />
    </View>
  );
}
