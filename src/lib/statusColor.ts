/**
 * MONIT.CAMPO
 * Contraste automático de texto para as cores oficiais de status.
 *
 * As cores continuam vindo de STOP_REASON_COLORS (fonte única do sistema).
 * Aqui apenas decidimos a cor da FONTE conforme a luminosidade do fundo:
 *   fundo claro  -> texto preto
 *   fundo escuro -> texto branco
 */

type Rgb = { r: number; g: number; b: number };

function hexToRgb(hex: string): Rgb | null {
  let h = hex.replace('#', '').trim();
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  if (h.length !== 6 || /[^0-9a-fA-F]/.test(h)) return null;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function hslToRgb(h: number, s: number, l: number): Rgb {
  const sat = s / 100;
  const lig = l / 100;
  const c = (1 - Math.abs(2 * lig - 1)) * sat;
  const hp = ((h % 360) + 360) % 360 / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0, g = 0, b = 0;
  if (hp >= 0 && hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = lig - c / 2;
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

/** Converte qualquer cor usada no sistema (#hex, hsl(), rgb()) em RGB. */
export function parseColor(color: string): Rgb | null {
  const value = (color || '').trim();
  if (!value) return null;
  if (value.startsWith('#')) return hexToRgb(value);

  const hsl = value.match(/^hsla?\(\s*([-\d.]+)(?:deg)?[,\s]+([\d.]+)%[,\s]+([\d.]+)%/i);
  if (hsl) return hslToRgb(parseFloat(hsl[1]), parseFloat(hsl[2]), parseFloat(hsl[3]));

  const rgb = value.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
  if (rgb) return { r: +rgb[1], g: +rgb[2], b: +rgb[3] };

  return null;
}

/** Luminância relativa (0 = preto, 1 = branco). */
export function relativeLuminance(color: string): number {
  const rgb = parseColor(color);
  if (!rgb) return 0;
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

/**
 * Cor de fonte com contraste garantido sobre a cor de fundo informada.
 * Não altera o fundo — apenas a fonte.
 */
export function contrastTextColor(background: string): string {
  return relativeLuminance(background) > 0.45 ? '#000000' : '#ffffff';
}

/** Borda discreta apenas para fundos muito claros, para a célula não "desaparecer". */
export function subtleBorderForBackground(background: string): string | undefined {
  return relativeLuminance(background) > 0.8 ? '#c9ced6' : undefined;
}
