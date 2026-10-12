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

// Numeros que trabajan contra staging, Y HASTA CUANDO. Solo cuentas del equipo.
//
// LO QUE ESTA LISTA LE HACE A UN NUMERO: `aplicarModoPorTelefono()` corre en
// login/registro/recuperacion ANTES de autenticar, o sea que la pantalla de
// ingreso es un interruptor de entorno accionable desde el campo de telefono.
// Mientras un numero este vigente aqui, su dueño NO puede comprar de verdad —la
// app entera lo manda a staging— y el sintoma es que sus pedidos simplemente no
// existen para el negocio. Ya paso: el 23-ago-2026 se puso el numero del dueño
// "solo mientras se prueba la 1.3.2", la 1.3.2 se publico, y el numero seguia
// aqui el 31-ago cuando lo encontro la auditoria del ingreso. Antes de eso
// (21-ago) el mismo numero le habia borrado tres veces su cuenta de staging
// creyendo que era basura.
//
// POR ESO LA LISTA VENCE SOLA. La leccion de aquel incidente no fue "hay que
// acordarse de quitarlo": fue que nadie se acuerda. `listaVigente()` devuelve
// vacio pasada esta fecha, y `hidratarModoPruebas()` aprovecha el mismo camino
// que ya existia para apagarle el modo pegajoso al dispositivo en el siguiente
// arranque. Vencer devuelve el telefono a PRODUCCION, que es el estado seguro:
// lo peor que pasa al vencerse es tener que extender la fecha; lo peor que pasa
// sin vencimiento es un mes de compras que el negocio nunca vio.
//
// Extender = subir esta fecha en un commit, no "recordarlo". Terminar antes =
// vaciar la lista. Las dos cosas viajan por OTA, que es JS puro.
//
// Alternativa sin ninguno de estos riesgos, cuando no hace falta que sea EL
// telefono real: el perfil `staging` de eas.json compila un binario aparte que
// apunta a pruebas y no depende de revertir una constante.
export const TELEFONOS_PRUEBA_HASTA = "2026-10-07";

// 07-sep-2026: 3054239970 (cuenta del equipo, id 2 en produccion) para recorrer
// el flujo completo contra staging desde la app normal de la tienda. Esa cuenta
// NO existe en la base de staging: hay que registrarla alla la primera vez.
export const TELEFONOS_PRUEBA: string[] = ["3054239970"];

// Fin del dia, hora de Colombia (UTC-5). El reloj es el del telefono, y esta
// bien que asi sea: adelantarlo solo apaga el modo pruebas, que es el lado
// seguro del error.
function vencida(hoy: Date): boolean {
  return hoy.getTime() > new Date(`${TELEFONOS_PRUEBA_HASTA}T23:59:59-05:00`).getTime();
}

/** La lista que de verdad manda hoy. Vacia una vez vencida. */
export function listaVigente(hoy: Date = new Date()): string[] {
  return vencida(hoy) ? [] : TELEFONOS_PRUEBA;
}

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
        // Sin lista vigente el modo no puede estar activo legitimamente, asi
        // que apagarlo aqui es correcto por construccion, no un parche. Es
        // tambien lo que le da dientes al vencimiento: el dia despues de
        // TELEFONOS_PRUEBA_HASTA, el siguiente arranque devuelve el telefono a
        // produccion sin que nadie toque nada ni tenga que cerrar sesion.
        const sinNumerosDePrueba = listaVigente().length === 0;
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
  return listaVigente().includes(telefono.trim());
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
