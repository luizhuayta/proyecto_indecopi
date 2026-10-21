/**
 * Cálculo de contraste de color según WCAG 2.x.
 *
 * Funciones puras y comprobables: toman y devuelven cadenas hex (con o sin
 * `#`). La relación de contraste se define como (L1 + 0.05) / (L2 + 0.05),
 * donde L1 es la luminancia relativa mayor y L2 la menor. Sirve para avisar
 * en el panel cuando el color elegido por la institución no llega a 4.5:1
 * (texto normal) sin pintar nunca el texto de la interfaz sobre el primario.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface Hsl {
  h: number;
  s: number;
  l: number;
}

/** Convierte un hex (`#abc`, `#aabbcc` o `aabbcc`) a RGB. Inválido -> negro. */
export function hexARgb(hex: string): Rgb {
  let h = hex.trim().replace(/^#/, '');
  if (h.length === 3) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  }
  if (!/^[0-9a-fA-F]{6}$/.test(h)) {
    return { r: 0, g: 0, b: 0 };
  }
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/** Convierte RGB a hex de 6 dígitos (`#rrggbb`). */
export function rgbAHex({ r, g, b }: Rgb): string {
  const canal = (v: number): string =>
    Math.round(Math.min(255, Math.max(0, v)))
      .toString(16)
      .padStart(2, '0');
  return `#${canal(r)}${canal(g)}${canal(b)}`;
}

/** Normaliza cualquier hex a su forma `#rrggbb` (útil para el `<input type="color">`). */
export function normalizarHex(hex: string): string {
  return rgbAHex(hexARgb(hex));
}

/** Canal linealizado para el cálculo de luminancia. */
function canalLineal(c: number): number {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

/** Luminancia relativa WCAG (0..1). */
export function luminancia(hex: string): number {
  const { r, g, b } = hexARgb(hex);
  return 0.2126 * canalLineal(r) + 0.7152 * canalLineal(g) + 0.0722 * canalLineal(b);
}

/** Relación de contraste entre dos colores (>= 1). Simétrica. */
export function contraste(a: string, b: string): number {
  const la = luminancia(a);
  const lb = luminancia(b);
  const claro = Math.max(la, lb);
  const oscuro = Math.min(la, lb);
  return (claro + 0.05) / (oscuro + 0.05);
}

/** True cuando el contraste entre `a` y `b` alcanza el umbral (por defecto 4.5). */
export function cumpleContraste(a: string, b: string, umbral = 4.5): boolean {
  return contraste(a, b) >= umbral;
}

/** Invierte un color (255 - cada canal). Útil para pruebas de simetría. */
export function invertirColor(hex: string): string {
  const { r, g, b } = hexARgb(hex);
  return rgbAHex({ r: 255 - r, g: 255 - g, b: 255 - b });
}

/**
 * Devuelve un color lo más parecido posible a `candidato` (mismo tono y
 * saturación) que cumple `umbral` de contraste contra `referencia`. Si el
 * candidato ya cumple, se devuelve normalizado. Si no hay ninguno (caso
 * extremo en que ni negro ni blanco cumplen), devuelve el candidato.
 */
export function sugerirContraste(candidato: string, referencia: string, umbral = 4.5): string {
  const hex = normalizarHex(candidato);
  if (cumpleContraste(hex, referencia, umbral)) {
    return hex;
  }
  const { h, s, l } = rgbAHsl(hexARgb(hex));
  const oscuro = buscarLuminosidad(h, s, l, false, referencia, umbral);
  const claro = buscarLuminosidad(h, s, l, true, referencia, umbral);
  if (!oscuro) {
    return claro ?? hex;
  }
  if (!claro) {
    return oscuro;
  }
  const distOscuro = Math.abs(luminancia(oscuro) - luminancia(hex));
  const distClaro = Math.abs(luminancia(claro) - luminancia(hex));
  return distOscuro <= distClaro ? oscuro : claro;
}

/**
 * Busca (bisección sobre la luminosidad HSL) el color con el mismo tono y
 * saturación que cumpla el umbral. `aclarar` controla si se sube o baja la
 * luminosidad; devuelve el punto que menos se aleja del original, o null.
 */
function buscarLuminosidad(
  h: number,
  s: number,
  lActual: number,
  aclarar: boolean,
  referencia: string,
  umbral: number,
): string | null {
  let lo = aclarar ? lActual : 0;
  let hi = aclarar ? 1 : lActual;
  let mejor: string | null = null;
  for (let i = 0; i < 32; i++) {
    const mid = (lo + hi) / 2;
    const hex = rgbAHex(hslARgb({ h, s, l: mid }));
    if (cumpleContraste(hex, referencia, umbral)) {
      mejor = hex;
      if (aclarar) {
        hi = mid;
      } else {
        lo = mid;
      }
    } else if (aclarar) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return mejor;
}

/** RGB -> HSL (h en [0,1), s y l en [0,1]). */
export function rgbAHsl({ r, g, b }: Rgb): Hsl {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) {
    return { h: 0, s: 0, l };
  }
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) {
    h = (gn - bn) / d + (gn < bn ? 6 : 0);
  } else if (max === gn) {
    h = (bn - rn) / d + 2;
  } else {
    h = (rn - gn) / d + 4;
  }
  return { h: h / 6, s, l };
}

/** HSL -> RGB. */
export function hslARgb({ h, s, l }: Hsl): Rgb {
  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const h2 = ((h % 1) + 1) % 1;
  return {
    r: Math.round(tono(p, q, h2 + 1 / 3) * 255),
    g: Math.round(tono(p, q, h2) * 255),
    b: Math.round(tono(p, q, h2 - 1 / 3) * 255),
  };
}

function tono(p: number, q: number, t: number): number {
  const tt = ((t % 1) + 1) % 1;
  if (tt < 1 / 6) {
    return p + (q - p) * 6 * tt;
  }
  if (tt < 1 / 2) {
    return q;
  }
  if (tt < 2 / 3) {
    return p + (q - p) * (2 / 3 - tt) * 6;
  }
  return p;
}
