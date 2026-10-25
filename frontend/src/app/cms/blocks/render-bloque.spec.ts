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

  it('la banda de admision muestra el encabezado, la fecha y la accion', () => {
    const block = makeBlock('admision', {
      label: 'Proceso de admisión 2026',
      fecha: 'Cierre de postulación: 15 de diciembre',
      text: 'Presenta tu postulación en línea.',
      button: 'Postular ahora',
      link: '/admision',
    });
    const html = renderBloque(block);
    expect(html).toContain('class="banda"');
    expect(html).toContain('Proceso de admisión 2026');
    expect(html).toContain('<h2>Cierre de postulación: 15 de diciembre</h2>');
    expect(html).toContain('href="/admision"');
    expect(html).toContain('Postular ahora');
  });

  it('la portada con foto se parte en dos columnas', () => {
    const block = makeBlock('pageHero', {
      title: 'Formación profesional',
      text: 'Programas técnicos y de formación.',
      cta: 'Ver oferta',
      ctaLink: '/oferta',
      image: '/api/medios/310',
      imageAlt: 'Fachada del edificio principal',
    });
    const html = renderBloque(block);
    expect(html).toContain('class="page-hero__columna"');
    expect(html).toContain('class="page-hero__imagen"');
    expect(html).toContain('src="/api/medios/310"');
    expect(html).toContain('alt="Fachada del edificio principal"');
  });

  it('la portada sin foto se queda en una sola columna', () => {
    const block = makeBlock('pageHero', { title: 'Formación profesional' });
    const html = renderBloque(block);
    expect(html).not.toContain('page-hero__imagen');
    expect(html).not.toContain('page-hero__columna');
  });

  it('la etiqueta de un bloque de programas no es un encabezado', () => {
    const block = makeBlock('serviceCards', {
      subtitle: 'Programas',
      title: 'Qué puedes estudiar aquí',
      cards: [{ title: 'Programas técnicos', text: 'Computación y administración.' }],
    });
    const html = renderBloque(block);
    // Como h3 antes del h2 invertiría la jerarquía de la página.
    expect(html).not.toContain('<h3>Programas</h3>');
    expect(html).toContain('<h2>Qué puedes estudiar aquí</h2>');
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
