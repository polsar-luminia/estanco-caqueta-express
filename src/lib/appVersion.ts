/**
 * Versión del binario que corre en el teléfono.
 *
 * Sale de `Updates.runtimeVersion`, que viaja DENTRO del binario y no se puede
 * cambiar por OTA. Eso es lo que la hace confiable para dos cosas distintas:
 *
 *  - Telemetría (A.1): responder cuánta gente hay en cada versión, que es el dato
 *    que decide cuándo se puede prender `version_minima` sin dejar a nadie
 *    encerrado sin app.
 *  - Compatibilidad: el servidor le manda a cada binario solo lo que sabe
 *    interpretar. Mientras 1.1.5 siga vivo en las tiendas, no puede recibir una
 *    tarifa de envío por zona que su carrito no sabe consultar ni mostrar.
 *
 * `Constants.expoConfig.version` es el respaldo para Expo Go y desarrollo, donde
 * runtimeVersion viene vacío.
 *
 * Vive en su propio archivo para que lo usen tanto `api.ts` (header en cada
 * petición) como `tracker.ts` (header del batch de eventos) sin que uno tenga que
 * importar al otro.
 */

import * as Updates from 'expo-updates';
import Constants from 'expo-constants';

export const APP_VERSION: string =
  Updates.runtimeVersion || Constants.expoConfig?.version || '';
