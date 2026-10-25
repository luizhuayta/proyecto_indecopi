import { JsonMap } from '../cms/cms.models';
import { contraste, normalizarHex, sugerirContraste } from './contraste';

export const COLORES_DEFECTO: Record<string, string> = {
  color_primario: '#123a6d', color_primario_fuerte: '#0d2a50',
  color_secundario: '#5a6b80', color_acento: '#b3541e',
  color_texto: '#1b1f24', color_texto_suave: '#525c68',
  color_fondo: '#ffffff', color_superficie: '#f4f6f8', color_borde: '#d8dee5',
};

export const FONTS_DEFECTO: Record<string, string> = {
  tipografia_titulos: "'Source Serif 4', Georgia, 'Times New Roman', serif",
  tipografia_cuerpo: "'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
};

export function temaPublico(apariencia: JsonMap): Record<string, string> {
  const colores = { ...COLORES_DEFECTO };
  for (const clave of Object.keys(colores)) {
    const valor = apariencia[clave];
    if (typeof valor === 'string' && /^#(?:[a-f\d]{3}|[a-f\d]{6})$/i.test(valor)) {
      colores[clave] = normalizarHex(valor);
    }
  }
  const marca = colores['color_primario'];
  const fondo = colores['color_fondo'];
  let superficie = colores['color_superficie'];
  const legible = (color: string): string | undefined => [color, sugerirContraste(color, fondo),
    sugerirContraste(color, superficie), '#767676', '#1b1f24', '#ffffff', '#000000']
    .find((c) => contraste(c, fondo) >= 4.5 && contraste(c, superficie) >= 4.5);

  // Fondos opuestos no pueden compartir un color de texto accesible.
  if (!legible(colores['color_texto'])) {
    superficie = fondo;
    colores['color_superficie'] = fondo;
  }
  for (const clave of ['color_texto', 'color_texto_suave', 'color_primario', 'color_primario_fuerte', 'color_secundario', 'color_acento']) {
    colores[clave] = legible(colores[clave]) ?? '#767676';
  }
  const tema: Record<string, string> = {};
  for (const [clave, valor] of Object.entries(colores)) {
    tema['--' + clave.replaceAll('_', '-')] = valor;
  }
  for (const [clave, defecto] of Object.entries(FONTS_DEFECTO)) {
    const valor = apariencia[clave];
    tema[clave === 'tipografia_titulos' ? '--font-titulos' : '--font-cuerpo'] =
      typeof valor === 'string' && /^[\p{L}\p{N}\s'",.\-]+$/u.test(valor) ? valor : defecto;
  }
  tema['--color-marca'] = marca;
  tema['--color-primario-suave'] = colores['color_primario_fuerte'];
  // Las superficies suaves se teñen con el color publicado. Van aquí y no en
  // el CSS porque, dentro de una custom property, un var(--color-primario) se
  // resuelve donde se declara: en :root, con el color por defecto.
  tema['--color-lavado'] =
    `color-mix(in srgb, ${colores['color_primario']} 7%, ${colores['color_fondo']})`;
  tema['--color-linea-suave'] =
    `color-mix(in srgb, ${colores['color_primario']} 14%, ${colores['color_fondo']})`;
  tema['--color-boton-texto'] = contraste('#ffffff', colores['color_primario']) >= 4.5 ? '#ffffff' : '#000000';
  tema['--color-boton-texto-hover'] = contraste('#ffffff', colores['color_primario_fuerte']) >= 4.5 ? '#ffffff' : '#000000';
  return tema;
}
