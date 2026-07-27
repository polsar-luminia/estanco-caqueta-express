// expo-updates carga expo-modules-core, que necesita el runtime nativo de Expo y
// revienta en node. El tracker lo usa solo para leer la version del binario
// (Updates.runtimeVersion), asi que un stub con la version de prueba alcanza.
// Mismo patron que los demas mocks aliaseados en vitest.config.ts.

export const runtimeVersion: string | null = '1.2.0-test';
export const channel: string | null = null;
export const isEmbeddedLaunch = true;

export default { runtimeVersion, channel, isEmbeddedLaunch };
