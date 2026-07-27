// expo-constants arrastra expo-modules-core, que necesita el runtime nativo y
// revienta en node. Solo se lee expoConfig.version (respaldo de la version del
// binario en Expo Go y desarrollo), asi que alcanza con un stub.

export const expoConfig = { version: '1.2.0-test' };

export default { expoConfig };
