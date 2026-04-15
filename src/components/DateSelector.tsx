import { useState } from "react";
import { View, Text, Pressable, Modal, ScrollView, Platform } from "react-native";

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
  const d = new Date(iso + "T00:00:00Z");
  const hoy = new Date();
  let edad = hoy.getUTCFullYear() - d.getUTCFullYear();
  const m = hoy.getUTCMonth() - d.getUTCMonth();
  if (m < 0 || (m === 0 && hoy.getUTCDate() < d.getUTCDate())) edad--;
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
  return range(currentYear - 18, 1920)
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

  const handleSelect = (field: Field, selected: number) => {
    const newValue: DateValue = { ...value, [field]: selected };
    // Si cambia mes o año, verificar que el día siga siendo válido
    if ((field === 'month' || field === 'year') && newValue.day) {
      const maxDay = new Date(newValue.year || 2000, newValue.month || 1, 0).getDate();
      if (newValue.day > maxDay) newValue.day = undefined;
    }
    onChange(newValue);
    setOpenField(null);
  };

  const fields: Field[] = ["day", "month", "year"];
  const flexMap: Record<Field, number> = { day: 1, month: 1.8, year: 1.3 };

  return (
    <View>
      <Text style={{ fontSize: 10, fontWeight: "700", color: "#6D7B6C", textTransform: "uppercase", letterSpacing: 1, marginLeft: 16, marginBottom: 4 }}>
        Fecha de Nacimiento
      </Text>

      <View style={{ flexDirection: "row", gap: 8 }}>
        {fields.map((field) => {
          const selected = value[field] !== undefined;
          return (
            <Pressable
              key={field}
              onPress={() => setOpenField(field)}
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
              <Text style={{ fontSize: 10, color: "#6D7B6C", marginLeft: 4 }}>▾</Text>
            </Pressable>
          );
        })}
      </View>

      <Modal
        visible={openField !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setOpenField(null)}
      >
        {/* Backdrop */}
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)" }}
          onPress={() => setOpenField(null)}
        />
        {/* Sheet */}
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
          {/* Handle */}
          <View style={{ alignItems: "center", marginBottom: 8 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: "#E0E0E0" }} />
          </View>
          <ScrollView keyboardShouldPersistTaps="handled">
            {openField &&
              getOptions(openField, value).map((opt) => {
                const isSelected =
                  openField === "day"
                    ? value.day === opt.value
                    : openField === "month"
                    ? value.month === opt.value
                    : value.year === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => handleSelect(openField, opt.value)}
                    style={{
                      paddingVertical: 14,
                      paddingHorizontal: 24,
                      backgroundColor: isSelected ? "#F0FBF4" : "transparent",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 16,
                        color: isSelected ? "#1FAF55" : "#1A1C1A",
                        fontWeight: isSelected ? "700" : "400",
                      }}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
