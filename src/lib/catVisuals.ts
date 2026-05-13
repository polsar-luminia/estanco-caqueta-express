// Gradientes y emojis por categoría de producto.
// Usados para placeholders de imagen en cards (especialmente sección Relámpago).
// Fuente: README design handoff + proto-components.jsx

export const CAT_GRADIENTS: Record<string, [string, string]> = {
  'Whisky':       ['#1A0D00', '#6B3800'],
  'Tequila':      ['#1A1200', '#6B5200'],
  'Licores':      ['#1A0D00', '#5C2800'],
  'Vinos':        ['#2D001A', '#8B0045'],
  'Aguardiente':  ['#001228', '#00367C'],
  'Cervezas':     ['#1A0D00', '#7C4A00'],
  'Gaseosas':     ['#001A3D', '#0035A0'],
  'Energéticas':  ['#1A1200', '#5C4200'],
  'Snacks':       ['#001A00', '#005C00'],
  'Cigarrillos':  ['#1A1A1A', '#3C3C3C'],
  'default':      ['#1A1A1A', '#444444'],
};

export const CAT_EMOJI: Record<string, string> = {
  'Whisky':       '🥃',
  'Tequila':      '🍹',
  'Licores':      '🥃',
  'Vinos':        '🍷',
  'Aguardiente':  '🫙',
  'Cervezas':     '🍺',
  'Gaseosas':     '🥤',
  'Energéticas':  '⚡',
  'Snacks':       '🍿',
  'Cigarrillos':  '🚬',
  'default':      '📦',
};

export function getCatVisuals(categoria?: string | null) {
  const key = categoria && CAT_GRADIENTS[categoria] ? categoria : 'default';
  return {
    gradient: CAT_GRADIENTS[key] as [string, string],
    emoji: CAT_EMOJI[key] ?? '📦',
  };
}
