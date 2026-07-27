// Bloqueo de versión (bloque G).
//
// Este es el único mecanismo de la app capaz de dejar a alguien sin poder pedir,
// así que lo que más se prueba aquí NO es que bloquee: es que NO bloquee en todos
// los casos ambiguos. Un falso positivo deja a un cliente con la app inutilizada
// y sin forma de reportarlo, porque no puede pasar de esa pantalla.

import { describe, it, expect } from 'vitest';
import { debeBloquear, parseVersion } from '../bloqueoVersion';

describe('debeBloquear — dormido por defecto', () => {
  it("con el mínimo en 1.0.0 no bloquea a nadie", () => {
    // Es el valor que devuelve el servidor mientras nadie lo suba. Toda versión
    // que exista en la calle lo cumple.
    for (const v of ['1.0.0', '1.0.2', '1.1.3', '1.1.5', '1.2.0', '2.0.0']) {
      expect(debeBloquear(v, '1.0.0'), `version ${v}`).toBe(false);
    }
  });
});

describe('debeBloquear — ante la duda, NO bloquea', () => {
  it('sin poder leer la versión instalada, no bloquea', () => {
    // Expo Go, un build raro, o runtimeVersion vacío.
    for (const v of [null, undefined, '', 'latest', 42, {}, '1.2']) {
      expect(debeBloquear(v, '1.2.0'), `instalada ${JSON.stringify(v)}`).toBe(false);
    }
  });

  it('sin poder leer el mínimo, no bloquea', () => {
    // Servidor caído, campo vacío, o un valor que alguien tecleó mal.
    for (const m of [null, undefined, '', 'ultima', 3, {}, '1.2']) {
      expect(debeBloquear('1.1.5', m), `minima ${JSON.stringify(m)}`).toBe(false);
    }
  });

  it('la versión igual al mínimo cumple: no bloquea', () => {
    expect(debeBloquear('1.2.0', '1.2.0')).toBe(false);
  });

  it('una versión mayor que el mínimo nunca bloquea', () => {
    expect(debeBloquear('1.2.1', '1.2.0')).toBe(false);
    expect(debeBloquear('1.3.0', '1.2.0')).toBe(false);
    expect(debeBloquear('2.0.0', '1.2.0')).toBe(false);
  });
});

describe('debeBloquear — cuando sí corresponde', () => {
  it('bloquea una versión estrictamente menor', () => {
    expect(debeBloquear('1.1.5', '1.2.0')).toBe(true);
    expect(debeBloquear('1.0.2', '1.2.0')).toBe(true);
    // 0.9.9 sí es menor que el default 1.0.0 y quedaría bloqueada. No existe
    // ninguna versión 0.x en las tiendas (la primera publicada fue 1.0.x), así que
    // en la práctica el default sigue sin bloquear a nadie — pero la regla es la
    // regla y aquí queda dicho.
    expect(debeBloquear('0.9.9', '1.0.0')).toBe(true);
  });

  it('compara número por número, no como texto', () => {
    // '1.9.0' vs '1.10.0': como cadena, '9' > '1' y daría el resultado contrario.
    expect(debeBloquear('1.9.0', '1.10.0')).toBe(true);
    expect(debeBloquear('1.10.0', '1.9.0')).toBe(false);
  });

  it('ignora sufijos de build sin atragantarse', () => {
    expect(debeBloquear('1.1.5-rc1', '1.2.0')).toBe(true);
    expect(debeBloquear('1.2.0+65', '1.2.0')).toBe(false);
  });
});

describe('parseVersion', () => {
  it('devuelve los tres números', () => {
    expect(parseVersion('1.2.3')).toEqual([1, 2, 3]);
    expect(parseVersion('10.20.30')).toEqual([10, 20, 30]);
  });
  it('null cuando no hay tres números', () => {
    expect(parseVersion('1.2')).toBeNull();
    expect(parseVersion(null)).toBeNull();
  });
});
