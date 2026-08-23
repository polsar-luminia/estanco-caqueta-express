// Modo pruebas: la app entera apunta al STAGING cuando se inicia sesion (o se
// registra) con un numero de la lista de prueba.
//
// POR QUE EXISTE: probar en produccion era la deuda tecnica declarada el
// 16-ago-2026. Con esto, el dueño abre la app NORMAL de la tienda en su celular,
// teclea su numero, y todo el trafico (API + telemetria) se va al backend de
// staging — catalogo real, base independiente, banderas de prueba prendidas.
// Un cliente de verdad ni se entera de que este modo existe.
//
// REGLAS:
// - El interruptor es el NUMERO tecleado en login/registro: uno de prueba
//   activa el modo; cualquier otro lo apaga. Nada de gestos ocultos que se
//   activan por accidente.
// - El modo es PEGAJOSO (sobrevive reinicios via AsyncStorage): "mi cuenta
//   siempre apunta a pruebas". El token guardado siempre es coherente con el
//   backend activo porque el cambio ocurre ANTES de autenticar.
// - SIEMPRE visible: mientras esta activo, la app muestra la franja naranja
//   "MODO PRUEBAS" (BannerModoPruebas en _layout). Un modo silencioso termina
//   en "por que no me llegan los pedidos" con la tienda abierta de verdad.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "../constants/config";

// El vhost viejo (api.estancocaqueta.com:8443) sigue sirviendo el mismo staging:
// el build 80 de TestFlight lo lleva grabado. Los builds desde este commit usan
// el dominio dedicado.
export const STAGING_URL = "https://pruebas.estancocaqueta.com/api/v1";

// Numeros que SIEMPRE trabajan contra staging. Solo cuentas del equipo.
//
// Vacia entre el 21 y el 23-ago-2026 (ver historial): tenia este mismo numero
// y el dueño terminaba en staging sin querer al abrir la app de la tienda con
// SU numero — cuenta nueva en la base de pruebas, catalogo de pruebas, franja
// naranja permanente, y su cuenta de staging se borro tres veces creyendo que
// era basura.
//
// Reactivada a proposito el 23-ago-2026 para probar la 1.3.2 (medio de pago +
// soporte configurable) desde un TestFlight de PRODUCCION antes de decidir si
// sale por OTA o binario nuevo: el build de la tienda es el mismo para todos,
// y este numero es el unico interruptor que lo manda a staging sin tocar el
// binario de nadie mas. Sigue siendo temporal — quitarlo de aqui en cuanto
// termine la prueba, por la misma razon que se vacio la vez pasada: mientras
// este numero siga aqui, NO sirve para comprar de verdad en la tienda.
export const TELEFONOS_PRUEBA: string[] = ["3183224021"];

const STORAGE_KEY = "backend_pruebas_activo";

// Cache sincrono: apiFetch y el tracker no pueden esperar un await de
// AsyncStorage en cada request. Se hidrata una vez al importar el modulo.
let activo = false;
let hidratado: Promise<void> | null = null;
const listeners = new Set<() => void>();

function notificar() {
  listeners.forEach((l) => l());
}

/** Se resuelve cuando el estado persistido ya se leyo (arranque de la app). */
export function hidratarModoPruebas(): Promise<void> {
  if (!hidratado) {
    hidratado = AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => {
        // El modo es PEGAJOSO, y `aplicarModoPorTelefono` solo corre al iniciar
        // sesion. Sin esta limpieza, quien ya lo tenia activo se quedaba en
        // staging para siempre despues de vaciar TELEFONOS_PRUEBA — la app se
        // "arreglaba" solo si cerraba sesion y volvia a entrar, que es
        // exactamente lo que nadie adivina que hay que hacer.
        //
        // Con la lista vacia el modo no puede estar activo legitimamente, asi
        // que apagarlo aqui es correcto por construccion, no un parche.
        const sinNumerosDePrueba = TELEFONOS_PRUEBA.length === 0;
        activo = v === "1" && !sinNumerosDePrueba;
        if (v === "1" && sinNumerosDePrueba) {
          AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
        }
        notificar();
      })
      .catch(() => {});
  }
  return hidratado;
}
hidratarModoPruebas();

export function esTelefonoPrueba(telefono: string): boolean {
  return TELEFONOS_PRUEBA.includes(telefono.trim());
}

export function modoPruebasActivo(): boolean {
  return activo;
}

/** Base de API vigente. La leen apiFetch y el tracker en CADA request. */
export function baseUrlActual(): string {
  return activo ? STAGING_URL : API_URL;
}

/**
 * Decide el backend segun el numero tecleado. Llamar ANTES de autenticar:
 * asi el token que se guarde es del backend correcto y no hay estados mixtos.
 */
export async function aplicarModoPorTelefono(telefono: string): Promise<void> {
  const debeEstarActivo = esTelefonoPrueba(telefono);
  if (debeEstarActivo === activo) return;
  activo = debeEstarActivo;
  notificar();
  try {
    if (activo) await AsyncStorage.setItem(STORAGE_KEY, "1");
    else await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // Si el storage falla, el modo vive solo esta sesion. Peor seria bloquear el login.
  }
}

/** Para useSyncExternalStore del banner. */
export function suscribirModoPruebas(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
