export const ORIGENES_REGISTRO = ['checkout', 'perfil_onboarding'] as const;

export type OrigenRegistro = (typeof ORIGENES_REGISTRO)[number];

export type PayloadRegistroCompletado = {
  telefono_verificado: true;
  origen: OrigenRegistro;
};

export function esOrigenRegistro(valor: unknown): valor is OrigenRegistro {
  return typeof valor === 'string'
    && (ORIGENES_REGISTRO as readonly string[]).includes(valor);
}

/**
 * Un parametro ausente o manipulado corresponde al flujo general. Solo el
 * carrito marca explicitamente `checkout`, de modo que un deep link no puede
 * atribuirse por accidente al muro de compra.
 */
export function resolverOrigenRegistro(
  valor: string | string[] | undefined,
): OrigenRegistro {
  const candidato = Array.isArray(valor) ? valor[0] : valor;
  return candidato === 'checkout' ? 'checkout' : 'perfil_onboarding';
}

export function crearPayloadRegistroCompletado(
  valor: string | string[] | undefined,
): PayloadRegistroCompletado {
  return {
    telefono_verificado: true,
    origen: resolverOrigenRegistro(valor),
  };
}
