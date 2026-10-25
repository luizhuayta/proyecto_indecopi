export type JsonMap = Record<string, unknown>;

/**
 * Indica si una ruta de campo es inválida.
 *
 * Una ruta con «[object Object]» viene de una plantilla mal enlazada: si
 * deja pasar, escribe una clave basura en el borrador y el autoguardado la
 * persiste. Se corta en seco para que un fallo de presentación no pueda
 * corromper el contenido de la institución.
 */
export function rutaInvalida(path: string): boolean {
  return path.includes('[object Object]');
}

export function getByPath(obj: unknown, path: string): unknown {
  if (!path) {
    return obj;
  }
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc == null) {
      return undefined;
    }
    if (Array.isArray(acc)) {
      return acc[Number(key)];
    }
    if (typeof acc === 'object') {
      return (acc as JsonMap)[key];
    }
    return undefined;
  }, obj);
}

export function setByPath<T>(obj: T, path: string, value: unknown): T {
  const keys = path.split('.');
  const clone = structuredClone(obj ?? {}) as JsonMap | unknown[];
  let cursor: JsonMap | unknown[] = clone;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    const nextKey = keys[i + 1];
    const asIndex = Array.isArray(cursor);
    const current = asIndex ? (cursor as unknown[])[Number(key)] : (cursor as JsonMap)[key];
    if (current == null) {
      const next = /^\d+$/.test(nextKey) ? [] : {};
      if (asIndex) {
        (cursor as unknown[])[Number(key)] = next;
      } else {
        (cursor as JsonMap)[key] = next;
      }
    }
    cursor = (asIndex ? (cursor as unknown[])[Number(key)] : (cursor as JsonMap)[key]) as
      | JsonMap
      | unknown[];
  }
  const last = keys[keys.length - 1];
  if (Array.isArray(cursor)) {
    cursor[Number(last)] = value;
  } else {
    cursor[last] = value;
  }
  return clone as T;
}

export function changedPaths(before: unknown, after: unknown, prefix = ''): string[] {
  if (before === after) {
    return [];
  }
  if (typeof before !== 'object' || typeof after !== 'object' || !before || !after) {
    return [prefix || '(documento)'];
  }
  const keys = new Set([...Object.keys(before as JsonMap), ...Object.keys(after as JsonMap)]);
  const out: string[] = [];
  for (const key of keys) {
    const path = prefix ? `${prefix}.${key}` : key;
    const left = (before as JsonMap)[key];
    const right = (after as JsonMap)[key];
    if (JSON.stringify(left) !== JSON.stringify(right)) {
      if (left && right && typeof left === 'object' && typeof right === 'object') {
        out.push(...changedPaths(left, right, path));
      } else {
        out.push(path);
      }
    }
  }
  return out;
}

const MARCADORES = new Set([
  'Nombre de la institución',
  'RUC',
  'Dirección',
  'Teléfono',
  'Correo',
  'Ciudad',
]);

export function buscarMarcadores(contenido: unknown): string[] {
  const out: string[] = [];
  const walk = (value: unknown, path: string): void => {
    if (value == null) {
      return;
    }
    if (typeof value === 'string') {
      const texto = value.trim();
      if (MARCADORES.has(texto) || (texto.startsWith('{{') && texto.endsWith('}}'))) {
        out.push(path);
      }
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item, index) => walk(item, path ? `${path}.${index}` : String(index)));
      return;
    }
    if (typeof value === 'object') {
      for (const [key, child] of Object.entries(value as JsonMap)) {
        walk(child, path ? `${path}.${key}` : key);
      }
    }
  };
  walk(contenido, '');
  return out;
}

// ---- Tipos del contrato HTTP (v1, solo español) ----

const apiOverride =
  typeof globalThis !== 'undefined'
    ? (globalThis as Record<string, unknown>)['__API_URL__']
    : undefined;

/**
 * Base del API. Por defecto '/api'; se puede sobreescribir en runtime
 * asignando globalThis.__API_URL__ (útil para producción, p. ej. '/api.php').
 */
export const API_BASE: string =
  typeof apiOverride === 'string' && apiOverride ? apiOverride : '/api';

/** Locale fijo de la v1: solo se entrega contenido en español. */
export const LOCALE = 'es';

export interface CmsPageSummary {
  slug: string;
  titulo: string;
  actualizado_en?: string | null;
  version?: number;
  ruta?: string | null;
  mostrar_en_menu?: boolean;
  orden_menu?: number;
  protegida?: boolean;
}

export interface CmsMenuItem {
  slug: string;
  titulo: string;
  ruta: string;
  orden_menu?: number;
}

export interface CmsDocResponse {
  contenido: JsonMap;
  version: number;
  actualizado_en?: string | null;
  schemaVersion?: number;
  slug?: string;
  titulo?: string;
  /** Descripción para la etiqueta meta description, derivada del contenido. */
  descripcion?: string;
  ruta?: string;
  mostrar_en_menu?: boolean;
  orden_menu?: number;
  tiene_borrador?: boolean;
}

export interface CmsRevision {
  id: number;
  autor: string;
  creado_en: string;
  instantanea: JsonMap;
}

export interface CmsMediaItem {
  id: number;
  nombre_original: string;
  url: string;
  mime: string;
  tamano: number;
  ancho?: number | null;
  alto?: number | null;
  variantes?: Array<{ ancho: number; url: string }>;
}

/** Dimensiones de una imagen, clave interna del editor. */
export interface ImageMeta {
  width: number;
  height: number;
}
