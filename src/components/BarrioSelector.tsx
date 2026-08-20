import { useState, useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useBarrios } from "../hooks/useBarrios";
import type { Barrio } from "../lib/api";
import { fuentes } from "../constants/theme";

export interface BarrioSeleccionado {
  id: number;
  nombre: string;
  comuna: string;
}

interface BarrioSelectorProps {
  value: BarrioSeleccionado | null;
  onSelect: (barrio: BarrioSeleccionado | null) => void;
  textoLibre?: string;
  onTextoLibreChange?: (t: string) => void;
}

export function BarrioSelector({ value, onSelect, textoLibre = "", onTextoLibreChange }: BarrioSelectorProps) {
  const [abierto, setAbierto] = useState(false);
  const [query, setQuery] = useState("");
  const [modoLibre, setModoLibre] = useState(false);
  const { barrios, isLoading } = useBarrios();

  const filtrados = useMemo(() => {
    if (!query.trim()) return barrios;
    const q = query.toLowerCase();
    return barrios.filter((b) => b.nombre.toLowerCase().includes(q));
  }, [barrios, query]);

  // Agrupar por comuna para mostrar headers
  const secciones = useMemo(() => {
    const mapa: Record<string, Barrio[]> = {};
    for (const b of filtrados) {
      if (!mapa[b.comuna]) mapa[b.comuna] = [];
      mapa[b.comuna].push(b);
    }
    // Convertir a lista plana con separadores de sección
    const lista: ({ tipo: "header"; comuna: string } | { tipo: "barrio"; barrio: Barrio })[] = [];
    for (const [comuna, items] of Object.entries(mapa)) {
      lista.push({ tipo: "header", comuna });
      for (const item of items) {
        lista.push({ tipo: "barrio", barrio: item });
      }
    }
    return lista;
  }, [filtrados]);

  const handleSeleccionar = (b: Barrio) => {
    onSelect({ id: b.id, nombre: b.nombre, comuna: b.comuna });
    setAbierto(false);
    setQuery("");
    setModoLibre(false);
  };

  const handleModoLibre = () => {
    setModoLibre(true);
    onSelect(null);
  };

  const triggerText = value
    ? value.nombre
    : textoLibre
    ? textoLibre
    : null;

  return (
    <>
      {/* Trigger */}
      <Pressable
        onPress={() => setAbierto(true)}
        accessibilityRole="button"
        accessibilityLabel={
          triggerText ? `Cambiar el barrio, actualmente ${triggerText}` : "Seleccionar tu barrio"
        }
        style={{
          backgroundColor: "#fff",
          borderRadius: 12,
          paddingHorizontal: 16,
          paddingVertical: 14,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <Text style={{ fontFamily: fuentes.destacado, fontSize: 14, color: triggerText ? "#1A1C1A" : "#BCCABA", flex: 1 }} numberOfLines={1}>
          {triggerText || "Selecciona tu barrio"}
        </Text>
        <Feather name="chevron-down" size={16} color="#6D7B6C" />
      </Pressable>

      {/* Si está en modo libre, mostrar TextInput debajo */}
      {!value && onTextoLibreChange && (
        <TextInput
          style={{
            backgroundColor: "#fff",
            borderRadius: 12,
            paddingHorizontal: 16,
            paddingVertical: 12,
            fontFamily: fuentes.destacado, fontSize: 14,
            color: "#1A1C1A",
            marginBottom: 12,
            display: modoLibre ? "flex" : "none",
          }}
          placeholder="Escribe tu barrio"
          placeholderTextColor="#BCCABA"
          value={textoLibre}
          onChangeText={onTextoLibreChange}
        />
      )}

      {/* Modal selector */}
      <Modal visible={abierto} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setAbierto(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0} style={{ flex: 1, backgroundColor: "#FAFAF6" }}>
          {/* Header modal */}
          <View style={{ flexDirection: "row", alignItems: "center", paddingTop: 16, paddingBottom: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: "#EFEFEB" }}>
            <Text style={{ flex: 1, fontSize: 17, fontFamily: fuentes.destacado, color: "#1A1C1A" }}>Selecciona tu barrio</Text>
            <Pressable
              onPress={() => { setAbierto(false); setQuery(""); }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Cerrar el selector de barrio"
              style={{ padding: 4 }}
            >
              <Feather name="x" size={20} color="#6D7B6C" />
            </Pressable>
          </View>

          {/* Buscador */}
          <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, gap: 8 }}>
              <Feather name="search" size={16} color="#9E9E9E" />
              <TextInput
                style={{ flex: 1, fontFamily: fuentes.destacado, fontSize: 14, color: "#1A1C1A" }}
                placeholder="Buscar barrio..."
                placeholderTextColor="#BCCABA"
                value={query}
                onChangeText={setQuery}
                autoFocus
              />
              {query.length > 0 && (
                <Pressable
                  onPress={() => setQuery("")}
                  hitSlop={14}
                  accessibilityRole="button"
                  accessibilityLabel="Borrar lo escrito en la búsqueda de barrio"
                >
                  <Feather name="x-circle" size={16} color="#9E9E9E" />
                </Pressable>
              )}
            </View>
          </View>

          {/* Lista */}
          {isLoading ? (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: "#9E9E9E" }}>Cargando barrios...</Text>
            </View>
          ) : (
            <FlatList
              data={secciones}
              keyExtractor={(item, i) => `${item.tipo}-${i}`}
              contentContainerStyle={{ paddingBottom: 40 }}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                if (item.tipo === "header") {
                  return (
                    <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6 }}>
                      <Text style={{ fontSize: 12, fontFamily: fuentes.destacado, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: 2 }}>
                        {item.comuna}
                      </Text>
                    </View>
                  );
                }
                const b = item.barrio;
                const seleccionado = value?.id === b.id;
                return (
                  <Pressable
                    onPress={() => handleSeleccionar(b)}
                    accessibilityRole="radio"
                    accessibilityLabel={`Elegir el barrio ${b.nombre}, ${b.comuna}`}
                    accessibilityState={{ checked: seleccionado }}
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      backgroundColor: seleccionado ? "rgba(31,175,85,0.06)" : "transparent",
                    }}
                  >
                    <Text style={{ fontSize: 14, color: seleccionado ? "#1FAF55" : "#1A1C1A", fontFamily: fuentes.destacado ? "700" : "400" }}>
                      {b.nombre}
                    </Text>
                    {seleccionado && <Feather name="check" size={16} color="#1FAF55" />}
                  </Pressable>
                );
              }}
              ListFooterComponent={
                onTextoLibreChange ? (
                  <Pressable
                    onPress={() => { handleModoLibre(); setAbierto(false); setQuery(""); }}
                    accessibilityRole="button"
                    accessibilityLabel="Escribir mi barrio a mano porque no está en la lista"
                    style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 14, marginTop: 8 }}
                  >
                    <Feather name="edit-2" size={14} color="#9E9E9E" />
                    <Text style={{ fontFamily: fuentes.destacado, fontSize: 14, color: "#9E9E9E" }}>Mi barrio no está en la lista...</Text>
                  </Pressable>
                ) : null
              }
            />
          )}
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}
