export const CMS_SCHEMA_VERSION = 1;

export type SchemaKind =
  | 'text'
  | 'area'
  | 'rich'
  | 'link'
  | 'image'
  | 'bool'
  | 'number'
  | 'select'
  | 'color'
  | 'embed'
  | 'list'
  | 'group'
  | 'blocks';

export interface SchemaField {
  path: string;
  type: SchemaKind;
  label: string;
  description?: string;
  required?: boolean;
  default?: unknown;
  maxLength?: number;
  options?: Array<{ value: string; label: string }>;
  item?: SchemaField[];
  children?: SchemaField[];
  min?: number;
}

const FIELD_LABELS: Record<string, string> = {
  title: 'Título',
  text: 'Texto',
  subtitle: 'Subtítulo',
  description: 'Descripción',
  desc: 'Descripción',
  body: 'Texto',
  badge: 'Etiqueta',
  tag: 'Etiqueta',
  label: 'Etiqueta',
  name: 'Nombre',
  role: 'Cargo',
  image: 'Imagen',
  img: 'Imagen',
  alt: 'Texto alternativo',
  imageAlt: 'Texto alternativo',
  heroImage: 'Imagen del banner',
  heroAlt: 'Texto del banner',
  url: 'Enlace',
  link: 'Enlace',
  cta: 'Botón',
  ctaLink: 'Enlace del botón',
  button: 'Botón',
  path: 'Enlace',
  icon: 'Icono',
  number: 'Número',
  question: 'Pregunta',
  answer: 'Respuesta',
  caption: 'Pie de foto',
  logo: 'Logo',
  email: 'Correo',
  phone: 'Teléfono',
  subject: 'Asunto',
  message: 'Mensaje',
  company: 'Institución',
  ruc: 'RUC',
  embed: 'Enlace embebido',
  user: 'Usuario',
  lastUpdated: 'Última actualización',
};

export function fieldLabel(path: string): string {
  const leaf = path.split('.').pop() ?? path;
  if (FIELD_LABELS[leaf]) {
    return FIELD_LABELS[leaf];
  }
  return humanize(leaf);
}

function humanize(segment: string): string {
  const spaced = segment
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim();
  if (!spaced) {
    return segment;
  }
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
