// Stub para imports/requires de assets de imagen en tests.
// RN+Metro convierten `require('foo.png')` en un asset numérico; aquí lo
// representamos como 1 para que cualquier <Image source={...}/> reciba algo
// truthy sin crashear el parser de vitest.
export default 1;
