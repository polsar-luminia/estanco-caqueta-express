import { describe, expect, it } from 'vitest';
import {
  crearPayloadRegistroCompletado,
  esOrigenRegistro,
  resolverOrigenRegistro,
} from '../registroOrigen';

describe('origen de registro', () => {
  it('conserva checkout cuando el carrito abre el muro de registro', () => {
    expect(resolverOrigenRegistro('checkout')).toBe('checkout');
  });

  it.each([undefined, 'perfil_onboarding', 'campana', ['perfil_onboarding', 'checkout']])(
    'clasifica entradas generales como perfil_onboarding: %o',
    (valor) => expect(resolverOrigenRegistro(valor)).toBe('perfil_onboarding'),
  );

  it('construye el payload completo que emite la pantalla de registro', () => {
    expect(crearPayloadRegistroCompletado('checkout')).toEqual({
      telefono_verificado: true,
      origen: 'checkout',
    });
    expect(crearPayloadRegistroCompletado(undefined)).toEqual({
      telefono_verificado: true,
      origen: 'perfil_onboarding',
    });
  });

  it('solo reconoce los dos valores del contrato', () => {
    expect(esOrigenRegistro('checkout')).toBe(true);
    expect(esOrigenRegistro('perfil_onboarding')).toBe(true);
    expect(esOrigenRegistro('perfil')).toBe(false);
    expect(esOrigenRegistro(null)).toBe(false);
  });
});
