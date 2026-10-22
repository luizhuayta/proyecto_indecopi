import { getByPath } from '../cms.models';
import { BLOCK_CATALOG } from '../block-registry';
import type { CmsBlock, BlockTypeDef } from '../block-types';
import type { SchemaField } from '../cms-schema';
import type { JsonMap, ImageMeta } from '../cms.models';

/**
 * Render dirigido por el esquema.
 *
 * Cada tipo de bloque declara su `schema` en el catálogo (`block-catalog.generated.ts`).
 * En vez de un `switch` por cada uno de los 20 tipos, este módulo recorre el esquema
 * y renderiza cada campo según su `type`. Un bloque con los mismos campos se renderiza
 * igual aunque cambie su tipo. Los pocos tipos con carácter visual propio (banner,
 * cifras, galería, mapa, equipo, …) usan una plantilla específica; el resto pasa por
 * el render genérico.
 *
 * Toda la salida es una cadena de HTML. El texto del usuario se escapa aquí, de modo
 * que el único HTML que se inyecta "en crudo" es el campo `rich` (ya saneado en el
 * servidor) y las URLs de `embed` (validadas contra https).
 */

export interface RenderOptions {
  /** Dimensiones conocidas por URL de imagen (para width/height). */
  imageMeta?: Record<string, ImageMeta>;
}

/** Tipos de bloque con plantilla propia (carácter visual específico). */
const TIPOS_CON_PLANTILLA = new Set([
  'hero',
  'pageHero',
  'cta',
  'stats',
  'gallery',
  'map',
  'team',
  'reasons',
  'serviceCards',
  'contactCards',
]);

// ---------------------------------------------------------------------------
// Utilidades de escape
// ---------------------------------------------------------------------------

function escapeHtml(texto: string): string {
  return texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(texto: string): string {
  return escapeHtml(texto).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** `true` si hay texto real (no vacío ni solo espacios). */
function hayTexto(valor: unknown): valor is string {
  return typeof valor === 'string' && valor.trim().length > 0;
}

/** Lista de objetos de un campo. */
function listaDe(valor: unknown): JsonMap[] {
  return Array.isArray(valor)
    ? valor.filter((item): item is JsonMap => !!item && typeof item === 'object')
    : [];
}

function hermano(parentPath: string, leaf: string): string {
  return parentPath ? `${parentPath}.${leaf}` : leaf;
}

/** Texto de una clave de un objeto JSON (acceso por corchetes). */
function texto(obj: JsonMap | undefined, clave: string): string {
  const v = obj?.[clave];
  return typeof v === 'string' ? v : '';
}

/**
 * Un href solo es válido cuando se puede navegar: no vacío, no un ancla, no
 * javascript: y no un token sin resolver ({{…}}). En cualquier otro caso el
 * enlace se degrada a texto plano.
 */
function hrefValido(href: unknown): href is string {
  if (!hayTexto(href)) {
    return false;
  }
  const h = href.trim();
  if (h === '#') {
    return false;
  }
  if (/^javascript:/i.test(h)) {
    return false;
  }
  if (h.includes('{{')) {
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Encabezados: nivel según el nombre del campo
// ---------------------------------------------------------------------------

function nivelEncabezado(path: string): 0 | 2 | 3 {
  const leaf = path.split('.').pop() ?? '';
  if (leaf === 'title' || leaf === 'titulo') {
    return 2;
  }
  if (leaf === 'subtitle' || leaf === 'label') {
    return 3;
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Imágenes (con resolución de texto alternativo)
// ---------------------------------------------------------------------------

/** Claves de texto alternativo preferidas según el tipo de campo de imagen. */
const CLAVES_ALT: Record<string, string[]> = {
  heroImage: ['heroAlt'],
  img: ['alt'],
  image: ['alt', 'imageAlt'],
  logo: ['company'],
};

/**
 * Resuelve el texto alternativo de una imagen a partir del propio bloque:
 * primero las claves de alt dedicadas y, si no las hay, un texto hermano
 * (título, institución, nombre…). Si no hay nada, devuelve '' (la imagen se
 * omite: una imagen sin alt no se renderiza).
 */
function altDeImagen(props: JsonMap, imagePath: string): string {
  const partes = imagePath.split('.');
  const leaf = partes[partes.length - 1] ?? 'image';
  const parent = partes.slice(0, -1).join('.');
  const contenedor = parent ? (getByPath(props, parent) as JsonMap | undefined) : props;

  if (contenedor) {
    for (const clave of CLAVES_ALT[leaf] ?? ['alt', 'imageAlt', 'heroAlt']) {
      if (Object.prototype.hasOwnProperty.call(contenedor, clave)) {
        return texto(contenedor, clave);
      }
    }
    for (const clave of ['title', 'company', 'name', 'text']) {
      if (Object.prototype.hasOwnProperty.call(contenedor, clave)) {
        const v = texto(contenedor, clave);
        if (v) {
          return v;
        }
      }
    }
  }
  return '';
}

function renderImagen(props: JsonMap, imagePath: string, opts: RenderOptions): string {
  const src = getByPath(props, imagePath);
  if (!hayTexto(src)) {
    return '';
  }
  const alt = altDeImagen(props, imagePath);
  if (!alt) {
    return '';
  }
  const url = src.trim();
  const meta = opts.imageMeta?.[url];
  const widthAttr = meta?.width ? ` width="${meta.width}"` : '';
  const heightAttr = meta?.height ? ` height="${meta.height}"` : '';
  return `<img src="${escapeAttr(url)}" alt="${escapeAttr(alt)}" loading="lazy"${widthAttr}${heightAttr}>`;
}

// ---------------------------------------------------------------------------
// Campos simples
// ---------------------------------------------------------------------------

function renderTexto(field: SchemaField, texto: string): string {
  if (!texto.trim()) {
    return '';
  }
  const nivel = nivelEncabezado(field.path);
  const html = escapeHtml(texto);
  if (nivel === 2) {
    return `<h2>${html}</h2>`;
  }
  if (nivel === 3) {
    return `<h3>${html}</h3>`;
  }
  const leaf = field.path.split('.').pop() ?? '';
  const clase = leaf === 'tag' || leaf === 'badge' ? ' class="bloque__tag"' : '';
  return `<p${clase}>${html}</p>`;
}

function renderArea(texto: string): string {
  if (!texto.trim()) {
    return '';
  }
  return `<p>${escapeHtml(texto).replace(/\n/g, '<br>')}</p>`;
}

function renderRich(texto: string): string {
  if (!texto.trim()) {
    return '';
  }
  return `<div class="contenido-rico">${texto}</div>`;
}

function renderNumero(texto: string): string {
  if (!texto.trim()) {
    return '';
  }
  return `<span class="dato">${escapeHtml(texto)}</span>`;
}

function renderEmbed(url: string, title: string): string {
  const u = url.trim();
  if (!/^https:\/\//i.test(u)) {
    return '';
  }
  const titulo = title.trim() || 'Contenido embebido';
  return (
    `<div class="embebido"><iframe src="${escapeAttr(u)}" title="${escapeAttr(titulo)}" ` +
    `loading="lazy" sandbox="allow-scripts allow-same-origin allow-presentation" ` +
    `referrerpolicy="no-referrer-when-downgrade"></iframe></div>`
  );
}

// ---------------------------------------------------------------------------
// Enlaces (campo link + su texto hermano)
// ---------------------------------------------------------------------------

/** Pares (campo de texto, campo de enlace) que se renderizan como un único <a>. */
const PARES_ENLACE: Array<[string, string]> = [
  ['cta', 'ctaLink'],
  ['button', 'link'],
  ['link', 'path'],
  ['title', 'url'],
];

/** Un campo de texto se consume cuando su enlace hermano está en el mismo esquema. */
function textoConsumidoPorEnlace(textPath: string, schema: SchemaField[]): boolean {
  const leaf = textPath.split('.').pop() ?? '';
  const enlaces = new Set(schema.filter((f) => f.type === 'link').map((f) => f.path));
  for (const [texto, enlace] of PARES_ENLACE) {
    if (leaf === texto && enlaces.has(enlace)) {
      return true;
    }
  }
  return false;
}

/** Texto visible de un enlace: el campo hermano que lo acompaña. */
function textoDeEnlace(linkPath: string, props: JsonMap): string {
  const parent = linkPath.split('.').slice(0, -1).join('.');
  const leaf = linkPath.split('.').pop() ?? '';
  const candidatos =
    leaf === 'ctaLink'
      ? ['cta', 'button']
      : leaf === 'link'
        ? ['button', 'text', 'title']
        : leaf === 'url'
          ? ['title', 'name']
          : leaf === 'path'
            ? ['link', 'title']
            : ['title', 'text', 'name', 'cta', 'button'];
  for (const clave of candidatos) {
    const v = getByPath(props, hermano(parent, clave));
    if (hayTexto(v)) {
      return v.trim();
    }
  }
  return leaf;
}

function renderEnlace(field: SchemaField, href: unknown, props: JsonMap): string {
  const texto = textoDeEnlace(field.path, props);
  const boton = (field.path.split('.').pop() ?? '') === 'ctaLink';
  if (!hrefValido(href)) {
    return escapeHtml(texto);
  }
  const clase = boton ? 'boton' : 'enlace';
  return `<a class="${clase}" href="${escapeAttr((href as string).trim())}">${escapeHtml(texto)}</a>`;
}

// ---------------------------------------------------------------------------
// Listas y grupos
// ---------------------------------------------------------------------------

function esRejilla(field: SchemaField): boolean {
  return (field.item ?? []).some((f) => f.type === 'image' || f.type === 'embed');
}

function renderLista(field: SchemaField, valor: unknown, opts: RenderOptions): string {
  const items = listaDe(valor);
  if (items.length === 0) {
    return '';
  }
  const itemSchema = field.item ?? [];
  if (esRejilla(field)) {
    const tarjetas = items
      .map((item) => `<article class="tarjeta">${renderCampos(itemSchema, item, opts)}</article>`)
      .join('');
    return `<div class="rejilla">${tarjetas}</div>`;
  }
  const filas = items
    .map((item) => `<li>${renderCampos(itemSchema, item, opts)}</li>`)
    .join('');
  return `<ul class="lista">${filas}</ul>`;
}

function renderGrupo(field: SchemaField, valor: unknown, opts: RenderOptions): string {
  const hijo = valor && typeof valor === 'object' ? (valor as JsonMap) : {};
  const inner = renderCampos(field.children ?? [], hijo, opts);
  if (!inner.trim()) {
    return '';
  }
  return `<div class="grupo">${inner}</div>`;
}

// ---------------------------------------------------------------------------
// Render genérico dirigido por el esquema
// ---------------------------------------------------------------------------

function renderCampo(field: SchemaField, props: JsonMap, opts: RenderOptions): string {
  const valor = getByPath(props, field.path);
  switch (field.type) {
    case 'text':
      return renderTexto(field, typeof valor === 'string' ? valor : '');
    case 'area':
      return renderArea(typeof valor === 'string' ? valor : '');
    case 'rich':
      return renderRich(typeof valor === 'string' ? valor : '');
    case 'image':
      return renderImagen(props, field.path, opts);
    case 'link':
      return renderEnlace(field, valor, props);
    case 'embed':
      return renderEmbed(typeof valor === 'string' ? valor : '', field.label);
    case 'number':
      return renderNumero(typeof valor === 'string' ? valor : String(valor ?? ''));
    case 'list':
      return renderLista(field, valor, opts);
    case 'group':
      return renderGrupo(field, valor, opts);
    case 'bool':
    case 'select':
    case 'color':
    case 'blocks':
    default:
      return '';
  }
}

function renderCampos(schema: SchemaField[], props: JsonMap, opts: RenderOptions): string {
  return schema
    .map((field) => {
      if (field.type === 'text' && textoConsumidoPorEnlace(field.path, schema)) {
        return '';
      }
      return renderCampo(field, props, opts);
    })
    .join('');
}

function renderGenerico(def: BlockTypeDef, props: JsonMap, opts: RenderOptions): string {
  return renderCampos(def.schema, props, opts);
}

// ---------------------------------------------------------------------------
// Plantillas específicas (bloques con carácter propio)
// ---------------------------------------------------------------------------

type RenderEspecial = (props: JsonMap, opts: RenderOptions) => string;

function etiqueta(valor: unknown): string {
  return hayTexto(valor) ? `<p class="bloque__tag">${escapeHtml(valor.trim())}</p>` : '';
}

function titulo(valor: unknown, nivel: 1 | 2 | 3 = 2): string {
  if (!hayTexto(valor)) {
    return '';
  }
  return `<h${nivel}>${escapeHtml(valor.trim())}</h${nivel}>`;
}

function parrafo(valor: unknown): string {
  return hayTexto(valor) ? `<p>${escapeHtml(valor.trim())}</p>` : '';
}

/** Botón de llamada a la acción: usa cta/button + ctaLink/link. */
function renderBotonCta(props: JsonMap): string {
  const etiquetaBoton = texto(props, 'cta') || texto(props, 'button');
  const href = props['ctaLink'] ?? props['link'];
  if (!etiquetaBoton) {
    return '';
  }
  if (!hrefValido(href)) {
    return `<p>${escapeHtml(etiquetaBoton)}</p>`;
  }
  return `<a class="boton" href="${escapeAttr((href as string).trim())}">${escapeHtml(etiquetaBoton)}</a>`;
}

function renderEnlaceMini(props: JsonMap, linkPath: string, label: string): string {
  const href = getByPath(props, linkPath);
  if (!hrefValido(href)) {
    return '';
  }
  return `<a class="enlace" href="${escapeAttr((href as string).trim())}">${escapeHtml(label)}</a>`;
}

const heroEspecial: RenderEspecial = (props, opts) => {
  const slides = listaDe(props['slides'])
    .map((s) => {
      const img = renderImagen(s, 'image', opts);
      const badge = etiqueta(s['badge']);
      const t = titulo(s['title']);
      return `<div class="hero__slide">${img}${badge}${t}</div>`;
    })
    .join('');
  const subtitle = hayTexto(props['subtitle'])
    ? `<p class="hero__subtitulo">${escapeHtml((props['subtitle'] as string).trim())}</p>`
    : '';
  return `<div class="hero">${slides}${subtitle}${renderBotonCta(props)}</div>`;
};

const pageHeroEspecial: RenderEspecial = (props, opts) => {
  const badge = etiqueta(props['badge']);
  // El título de la página ya es el h1 del documento: el bloque usa h2.
  const t = titulo(props['title'], 2);
  const textoHtml = hayTexto(props['text'])
    ? `<p class="page-hero__texto">${escapeHtml((props['text'] as string).trim())}</p>`
    : '';
  const img = renderImagen(props, 'image', opts);
  return `<div class="page-hero">${badge}${t}${textoHtml}${renderBotonCta(props)}${img}</div>`;
};

const ctaEspecial: RenderEspecial = (props) => {
  const t = titulo(props['title']);
  const textoHtml = parrafo(props['text']);
  return `<div class="cta">${t}${textoHtml}${renderBotonCta(props)}</div>`;
};

const statsEspecial: RenderEspecial = (props) => {
  const items = listaDe(props['items'])
    .map((i) => {
      const numero = hayTexto(i['number'])
        ? `<span class="dato">${escapeHtml((i['number'] as string).trim())}</span>`
        : '';
      const label = parrafo(i['label']);
      return `<div class="estadistica">${numero}${label}</div>`;
    })
    .join('');
  if (!items) {
    return '';
  }
  return `<div class="rejilla rejilla--stats">${items}</div>`;
};

const galleryEspecial: RenderEspecial = (props, opts) => {
  const t = titulo(props['title']);
  const fotos = listaDe(props['items'])
    .map((i) => {
      const img = renderImagen(i, 'image', opts);
      const caption = hayTexto(i['caption'])
        ? `<figcaption>${escapeHtml((i['caption'] as string).trim())}</figcaption>`
        : '';
      return `<figure>${img}${caption}</figure>`;
    })
    .join('');
  return `<div class="galeria">${t}<div class="rejilla rejilla--galeria">${fotos}</div></div>`;
};

const mapEspecial: RenderEspecial = (props) => {
  const t = titulo(props['title']);
  const textoHtml = parrafo(props['text']);
  const embed = renderEmbed(texto(props, 'embed'), texto(props, 'title'));
  return `<div class="mapa">${t}${textoHtml}${embed}</div>`;
};

const teamEspecial: RenderEspecial = (props, opts) => {
  const tag = etiqueta(props['tag']);
  const t = titulo(props['title']);
  const textoHtml = parrafo(props['text']);
  const personas = listaDe(props['items'])
    .map((i) => {
      const img = renderImagen(i, 'image', opts);
      const nombre = titulo(i['name'], 3);
      const cargo = hayTexto(i['role'])
        ? `<p class="cargo">${escapeHtml((i['role'] as string).trim())}</p>`
        : '';
      const enlaces = `${renderEnlaceMini(i, 'linkedin', 'LinkedIn')}${renderEnlaceMini(i, 'github', 'GitHub')}`;
      return `<article class="tarjeta persona">${img}${nombre}${cargo}${enlaces}</article>`;
    })
    .join('');
  return `<div class="equipo">${tag}${t}${textoHtml}<div class="rejilla">${personas}</div></div>`;
};

const reasonsEspecial: RenderEspecial = (props, opts) => {
  const subtitle = titulo(props['subtitle'], 3);
  const t = titulo(props['title']);
  const motivos = listaDe(props['items'])
    .map((i) => {
      const img = renderImagen(i, 'img', opts);
      const ti = titulo(i['title'], 3);
      const textoHtml = parrafo(i['text']);
      return `<article class="tarjeta">${img}${ti}${textoHtml}</article>`;
    })
    .join('');
  return `<div class="motivos">${subtitle}${t}<div class="rejilla">${motivos}</div></div>`;
};

const serviceCardsEspecial: RenderEspecial = (props, opts) => {
  const subtitle = titulo(props['subtitle'], 3);
  const t = titulo(props['title']);
  const tarjetas = listaDe(props['cards'])
    .map((i) => {
      const img = renderImagen(i, 'img', opts);
      const ti = titulo(i['title'], 3);
      const textoHtml = parrafo(i['text']);
      const linkText = texto(i, 'link') || 'Ver más';
      const inner = `${img}${ti}${textoHtml}`;
      const href = getByPath(i, 'path');
      if (hrefValido(href)) {
        return (
          `<a class="tarjeta tarjeta--enlace" href="${escapeAttr((href as string).trim())}">` +
          `${inner}<span class="enlace">${escapeHtml(linkText)}</span></a>`
        );
      }
      return `<article class="tarjeta">${inner}<p>${escapeHtml(linkText)}</p></article>`;
    })
    .join('');
  return `<div class="servicios">${subtitle}${t}<div class="rejilla">${tarjetas}</div></div>`;
};

const contactCardsEspecial: RenderEspecial = (props) => {
  const tarjetas = listaDe(props['items'])
    .map((i) => {
      const t = titulo(i['title'], 3);
      const textoHtml = parrafo(i['text']);
      return `<article class="tarjeta contacto">${t}${textoHtml}</article>`;
    })
    .join('');
  return `<div class="rejilla">${tarjetas}</div>`;
};

const PLANTILLAS_ESPECIFICAS: Record<string, RenderEspecial> = {
  hero: heroEspecial,
  pageHero: pageHeroEspecial,
  cta: ctaEspecial,
  stats: statsEspecial,
  gallery: galleryEspecial,
  map: mapEspecial,
  team: teamEspecial,
  reasons: reasonsEspecial,
  serviceCards: serviceCardsEspecial,
  contactCards: contactCardsEspecial,
};

// ---------------------------------------------------------------------------
// Punto de entrada
// ---------------------------------------------------------------------------

const ANCHOS = new Set(['full', 'ancho', 'contenido']);

/**
 * Renderiza un bloque completo: lo envuelve en una `<section class="bloque …">`
 * con la clase de layout y el fondo/espaciado declarados, y delega el interior
 * en la plantilla específica (si existe) o en el render genérico por esquema.
 * Nunca lanza: un tipo desconocido produce una sección vacía.
 */
export function renderBloque(block: CmsBlock, options: RenderOptions = {}): string {
  const def = BLOCK_CATALOG[block.type] ?? null;
  const props = block.props ?? {};
  const width = ANCHOS.has(block.layout?.width) ? block.layout.width : 'full';

  const estilos: string[] = [];
  if (block.layout?.background) {
    estilos.push(`background:${block.layout.background}`);
  }
  if (block.layout?.padding) {
    estilos.push(`padding:${block.layout.padding}`);
  }
  const styleAttr = estilos.length ? ` style="${escapeAttr(estilos.join(';'))}"` : '';

  const interior = def
    ? TIPOS_CON_PLANTILLA.has(block.type)
      ? PLANTILLAS_ESPECIFICAS[block.type](props, options)
      : renderGenerico(def, props, options)
    : '';

  return (
    `<section class="bloque bloque--${escapeAttr(block.type)} bloque--${escapeAttr(width)}"${styleAttr}>` +
    `<div class="bloque__contenido">${interior}</div></section>`
  );
}
