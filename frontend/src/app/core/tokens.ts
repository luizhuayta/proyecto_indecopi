import { Identidad } from '../cms/cms-api.service';
import { JsonMap } from '../cms/cms.models';

/** Tokens que la institución puede usar dentro del contenido. */
export const TOKENS_INSTITUCION = [
  'nombre',
  'ruc',
  'direccion',
  'telefono',
  'correo',
  'ciudad',
] as const;

const PATRON_TOKEN = /\{\{institucion\.([a-z]+)\}\}/g;
/** Copia sin la bandera global: `test` sobre un regex global advance lastIndex. */
const PATRON_TOKEN_BUSQUEDA = /\{\{institucion\.[a-z]+\}\}/;

/**
 * Sustituye los tokens de la institución en un texto.
 *
 * En el sitio público el backend ya resuelve los tokens; aquí se hace lo
 * mismo para la vista previa del editor, que recibe el contenido en crudo.
 * Si la institución todavía no tiene ese dato, el token se deja tal cual.
 */
export function resolverTokens(texto: string, identidad: Identidad | null): string {
  if (!identidad) {
    return texto;
  }
  return texto.replace(PATRON_TOKEN, (match, token: string) => {
    if (!TOKENS_INSTITUCION.includes(token as (typeof TOKENS_INSTITUCION)[number])) {
      return match;
    }
    const valor = identidad[token as keyof Identidad];
    return typeof valor === 'string' && valor !== '' ? valor : match;
  });
}

/**
 * Indica si un valor contiene algún token de la institución.
 * Se usa para no pedir la identidad cuando no hace falta.
 */
export function contieneTokens(valor: unknown): boolean {
  if (typeof valor === 'string') {
    return PATRON_TOKEN_BUSQUEDA.test(valor);
  }
  if (Array.isArray(valor)) {
    return valor.some((v) => contieneTokens(v));
  }
  if (valor && typeof valor === 'object') {
    return Object.values(valor as JsonMap).some((v) => contieneTokens(v));
  }
  return false;
}

/**
 * Devuelve el bloque con sus tokens resueltos. No modifica el original:
 * el inspector debe seguir mostrando el texto tal como se escribió, con el
 * token intacto, para que editarlo no destruya la sustitución.
 */
export function resolverTokensEnBloque<T>(bloque: T, identidad: Identidad | null): T {
  if (!identidad) {
    return bloque;
  }
  const resolver = (valor: unknown): unknown => {
    if (typeof valor === 'string') {
      return resolverTokens(valor, identidad);
    }
    if (Array.isArray(valor)) {
      return valor.map(resolver);
    }
    if (valor && typeof valor === 'object') {
      const salida: JsonMap = {};
      for (const [clave, hijo] of Object.entries(valor as JsonMap)) {
        salida[clave] = resolver(hijo);
      }
      return salida;
    }
    return valor;
  };
  return resolver(bloque) as T;
}
