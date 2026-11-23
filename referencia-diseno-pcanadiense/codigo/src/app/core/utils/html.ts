const TAG_RE = /<[^>]+>/g;
const WS_RE = /\s+/g;

/** Entidades con nombre que genera el editor (Quill). `amp` se decodifica al
 * final para no convertir dos veces un `&amp;nbsp;` literal. */
const NAMED_ENTITIES: Record<string, string> = {
  nbsp: ' ',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};
const NAMED_RE = /&(nbsp|lt|gt|quot|apos);/g;
const DEC_RE = /&#(\d+);/g;
const HEX_RE = /&#x([0-9a-fA-F]+);/g;
const AMP_RE = /&amp;/g;

function codePoint(code: number): string {
  if (!Number.isInteger(code) || code < 0 || code > 0x10ffff) {
    return '';
  }
  try {
    return String.fromCodePoint(code);
  } catch {
    return '';
  }
}

export function decodeEntities(value: string): string {
  return value
    .replace(DEC_RE, (_, dec: string) => codePoint(Number(dec)))
    .replace(HEX_RE, (_, hex: string) => codePoint(parseInt(hex, 16)))
    .replace(NAMED_RE, (match, name: string) => NAMED_ENTITIES[name] ?? match)
    .replace(AMP_RE, '&');
}

export function stripHtml(value: string): string {
  return decodeEntities(value.replace(TAG_RE, ' ')).replace(WS_RE, ' ').trim();
}

export function esHtml(value: string): boolean {
  return /<[a-z][\s\S]*>/i.test(value);
}

export function htmlVacio(value: string): boolean {
  return !stripHtml(value);
}

export function excerpt(value: string, maxLength = 180): string {
  const plain = stripHtml(value);
  if (plain.length <= maxLength) {
    return plain;
  }
  return `${plain.slice(0, maxLength).trimEnd()}…`;
}

export function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Une párrafos legacy o un bloque HTML de Quill para [innerHTML]. */
export function cuerpoHtml(paragraphs: string[]): string {
  if (!paragraphs.length) {
    return '';
  }
  if (paragraphs.some(esHtml)) {
    return paragraphs.join('').replace(/&nbsp;|&#0*160;|&#x0*a0;|\u00a0/gi, ' ');
  }
  return paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join('');
}
