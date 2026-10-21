import { describe, expect, it } from 'vitest';
import { renderBloque } from './render-bloque';
import { makeBlock } from '../block-registry';
import type { CmsBlock } from '../block-types';

describe('renderBloque', () => {
  it('un bloque de texto se renderiza con su contenido', () => {
    const block = makeBlock('about', {
      title: 'Nuestra historia',
      text: 'Texto de la entidad',
    });
    const html = renderBloque(block);
    expect(html).toContain('<h2>Nuestra historia</h2>');
    expect(html).toContain('Texto de la entidad');
  });

  it('un bloque de imagen sin alt se omite', () => {
    const block = makeBlock('about', {
      image: 'https://ejemplo.test/foto.jpg',
      imageAlt: '',
    });
    const html = renderBloque(block);
    expect(html).not.toContain('<img');
  });

  it('un enlace con href invalido renderiza solo el texto', () => {
    const block = makeBlock('about', { cta: 'Leer más', ctaLink: '#' });
    const html = renderBloque(block);
    expect(html).toContain('Leer más');
    expect(html).not.toContain('<a href');
  });

  it('los tokens de institucion se muestran sin resolver', () => {
    const block = makeBlock('about', { title: '{{institucion.nombre}}' });
    const html = renderBloque(block);
    expect(html).toContain('{{institucion.nombre}}');
  });

  it('un bloque de tipo desconocido no rompe el render', () => {
    const block: CmsBlock = {
      id: 'x',
      type: 'inventado',
      hidden: false,
      layout: { width: 'full', padding: '', background: '' },
      props: {},
    };
    expect(() => renderBloque(block)).not.toThrow();
    expect(renderBloque(block)).toContain('bloque--inventado');
  });
});
