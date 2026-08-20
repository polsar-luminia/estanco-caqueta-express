import { useState, useRef } from "react";
import { View, Text, Pressable, Modal, ScrollView, TextInput, KeyboardAvoidingView, Platform } from "react-native";
import { fuentes } from "../constants/theme";

export type DateValue = { day?: number; month?: number; year?: number };

type Field = "day" | "month" | "year";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function range(from: number, to: number): number[] {
  const arr: number[] = [];
  for (let i = from; i <= to; i++) arr.push(i);
  return arr;
}

export function toISODate(v: DateValue): string | null {
  if (!v.day || !v.month || !v.year) return null;
  const mm = String(v.month).padStart(2, "0");
  const dd = String(v.day).padStart(2, "0");
  const iso = `${v.year}-${mm}-${dd}`;
  const d = new Date(iso + "T00:00:00Z");
  if (isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso) return null;
  return iso;
}

export function calcularEdad(v: DateValue): number | null {
  const iso = toISODate(v);
  if (!iso) return null;

  // Calcular "hoy" en America/Bogota para evitar off-by-one en cumpleaños
  // cerca de medianoche (UTC-5: 11:30 PM Bogota = 04:30 AM UTC del día siguiente).
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const hoyY = Number(partes.find((p) => p.type === "year")!.value);
  const hoyM = Number(partes.find((p) => p.type === "month")!.value);
  const hoyD = Number(partes.find((p) => p.type === "day")!.value);

  const [naY, naM, naD] = iso.split("-").map(Number);
  let edad = hoyY - naY;
  if (hoyM < naM || (hoyM === naM && hoyD < naD)) edad--;
  return edad;
}

function getOptions(field: Field, value: DateValue): { label: string; value: number }[] {
  const currentYear = new Date().getFullYear();
  if (field === "day") {
    const maxDay = value.month
      ? new Date(value.year || 2000, value.month, 0).getDate()
      : 31;
    return range(1, maxDay).map((d) => ({ label: String(d), value: d }));
  }
  if (field === "month") return MESES.map((m, i) => ({ label: m, value: i + 1 }));
  return range(1920, currentYear - 18).reverse()
    .map((y) => ({ label: String(y), value: y }));
}

function pillLabel(field: Field, value: DateValue): string {
  if (field === "day") return value.day ? String(value.day) : "Día";
  if (field === "month") return value.month ? MESES[value.month - 1] : "Mes";
  return value.year ? String(value.year) : "Año";
}

interface Props {
  value: DateValue;
  onChange: (v: DateValue) => void;
}

export function DateSelector({ value, onChange }: Props) {
  const [openField, setOpenField] = useState<Field | null>(null);
  const [yearText, setYearText] = useState(value.year ? String(value.year) : "");
  const yearInputRef = useRef<TextInput>(null);

  const handleSelect = (field: Field, selected: number) => {
    const newValue: DateValue = { ...value, [field]: selected };
    if ((field === 'month' || field === 'year') && newValue.day) {
      const maxDay = new Date(newValue.year || 2000, newValue.month || 1, 0).getDate();
      if (newValue.day > maxDay) newValue.day = undefined;
    }
    onChange(newValue);
    setOpenField(null);
  };

  const handleYearChange = (text: string) => {
    const digits = text.replace(/\D/g, "").slice(0, 4);
    setYearText(digits);
    if (digits.length === 4) {
      const yr = parseInt(digits, 10);
      const currentYear = new Date().getFullYear();
      if (yr >= 1920 && yr <= currentYear - 18) {
        const newValue: DateValue = { ...value, year: yr };
        if (newValue.day && newValue.month) {
          const maxDay = new Date(yr, newValue.month, 0).getDate();
          if (newValue.day > maxDay) newValue.day = undefined;
        }
        onChange(newValue);
      }
    } else {
      onChange({ ...value, year: undefined });
    }
  };

  const handleYearOpen = () => {
    setYearText(value.year ? String(value.year) : "");
    setOpenField("year");
    setTimeout(() => yearInputRef.current?.focus(), 100);
  };

  const fields: Field[] = ["day", "month", "year"];
  const flexMap: Record<Field, number> = { day: 1, month: 1.8, year: 1.3 };

  return (
    <View>
      <Text style={{ fontSize: 12, fontFamily: fuentes.destacado, color: "#6D7B6C", textTransform: "uppercase", letterSpacing: 1, marginLeft: 16, marginBottom: 4 }}>
        Fecha de Nacimiento
      </Text>

      <View style={{ flexDirection: "row", gap: 8 }}>
        {fields.map((field) => {
          const selected = value[field] !== undefined;
          if (field === "year") {
            return (
              <Pressable
                key="year"
                onPress={handleYearOpen}
                accessibilityRole="button"
                accessibilityLabel={
                  value.year
                    ? `Cambiar el año de nacimiento, actualmente ${value.year}`
                    : "Escribir el año de nacimiento"
                }
                style={{
                  flex: flexMap.year,
                  backgroundColor: "#F4F4F0",
                  borderRadius: 999,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Text style={{ fontSize: 15, color: selected ? "#1A1C1A" : "#BCCABA", flex: 1 }}>
                  {value.year ? String(value.year) : "Año"}
                </Text>
                <Text style={{ fontSize: 12, color: "#6D7B6C", marginLeft: 4 }}>✏️</Text>
              </Pressable>
            );
          }
          return (
            <Pressable
              key={field}
              onPress={() => setOpenField(field)}
              accessibilityRole="button"
              accessibilityLabel={
                selected
                  ? `Cambiar el ${field === "day" ? "día" : "mes"} de nacimiento, actualmente ${pillLabel(field, value)}`
                  : `Elegir el ${field === "day" ? "día" : "mes"} de nacimiento`
              }
              style={{
                flex: flexMap[field],
                backgroundColor: "#F4F4F0",
                borderRadius: 999,
                paddingHorizontal: 16,
                paddingVertical: 14,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Text style={{ fontSize: 15, color: selected ? "#1A1C1A" : "#BCCABA", flex: 1 }}>
                {pillLabel(field, value)}
              </Text>
              <Text style={{ fontSize: 12, color: "#6D7B6C", marginLeft: 4 }}>▾</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Modal para día y mes */}
      <Modal
        visible={openField === "day" || openField === "month"}
        transparent
        animationType="slide"
        onRequestClose={() => setOpenField(null)}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cerrar el selector sin elegir"
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)" }}
          onPress={() => setOpenField(null)}
        />
        <View
          style={{
            backgroundColor: "#fff",
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingTop: 12,
            paddingBottom: Platform.OS === "ios" ? 34 : 16,
            maxHeight: 340,
          }}
        >
          <View style={{ alignItems: "center", marginBottom: 8 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: "#E0E0E0" }} />
          </View>
          <ScrollView keyboardShouldPersistTaps="handled">
            {openField &&
              getOptions(openField, value).map((opt) => {
                const isSelected = openField === "day" ? value.day === opt.value : value.month === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => handleSelect(openField, opt.value)}
                    accessibilityRole="radio"
                    accessibilityLabel={
                      openField === "day"
                        ? `Elegir el día ${opt.label}`
                        : `Elegir el mes de ${opt.label}`
                    }
                    accessibilityState={{ checked: isSelected }}
                    style={{
                      paddingVertical: 14,
                      paddingHorizontal: 24,
                      backgroundColor: isSelected ? "#F0FBF4" : "transparent",
                    }}
                  >
                    <Text style={{ fontSize: 16, color: isSelected ? "#1FAF55" : "#1A1C1A", fontFamily: fuentes.destacado ? "700" : "400" }}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
          </ScrollView>
        </View>
      </Modal>

      {/* Modal para año — input directo */}
      <Modal
        visible={openField === "year"}
        transparent
        animationType="slide"
        onRequestClose={() => setOpenField(null)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cerrar el selector de año"
            style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)" }}
            onPress={() => setOpenField(null)}
          />
          <View
            style={{
              backgroundColor: "#fff",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingTop: 12,
              paddingBottom: Platform.OS === "ios" ? 34 : 16,
              paddingHorizontal: 24,
            }}
          >
            <View style={{ alignItems: "center", marginBottom: 16 }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: "#E0E0E0" }} />
            </View>
            <Text style={{ fontSize: 13, fontFamily: fuentes.destacado, color: "#6D7B6C", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>
              Año de nacimiento
            </Text>
            <TextInput
              ref={yearInputRef}
              value={yearText}
              onChangeText={handleYearChange}
              keyboardType="number-pad"
              maxLength={4}
              placeholder="Ej. 1995"
              placeholderTextColor="#BCCABA"
              autoFocus
              style={{
                backgroundColor: "#F4F4F0",
                borderRadius: 16,
                paddingHorizontal: 20,
                paddingVertical: 16,
                fontSize: 28,
                fontFamily: fuentes.titulo,
                color: "#1A1C1A",
                letterSpacing: 8,
                textAlign: "center",
              }}
            />
            <Text style={{ fontSize: 12, color: "#BCCABA", textAlign: "center", marginTop: 8 }}>
              Entre 1920 y {new Date().getFullYear() - 18}
            </Text>
            <Pressable
              onPress={() => setOpenField(null)}
              accessibilityRole="button"
              accessibilityLabel="Confirmar el año de nacimiento"
              style={{
                marginTop: 16,
                backgroundColor: value.year ? "#1FAF55" : "#E0E0E0",
                borderRadius: 999,
                paddingVertical: 14,
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#fff", fontFamily: fuentes.destacado, fontSize: 15 }}>
                Confirmar
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
