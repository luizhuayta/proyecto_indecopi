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

  it('el banner de listado usa la portada de página', () => {
    const html = renderBloque(makeBlock('listingHero', { title: 'Entidades', text: 'Con quién trabajamos' }));
    expect(html).toContain('<div class="page-hero"><h2>Entidades</h2><p class="page-hero__texto">Con quién trabajamos</p></div>');
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

describe('banner carrusel', () => {
  const slides = [
    { badge: 'Formación docente', title: 'Instituto de Educación Superior', image: '/m/1.webp' },
    { badge: 'Admisión', title: 'Postula 2026', image: '/m/2.webp' },
  ];

  it('marca el primer banner como activo y añade controles con dos o más banners', () => {
    const html = renderBloque(makeBlock('hero', { slides, subtitle: 'Estudia y transforma', cta: 'Carreras', ctaLink: '/programas' }));
    expect(html).toContain('<div class="hero" data-carrusel>');
    expect(html.match(/hero__slide hero__slide--activa/g)).toHaveLength(1);
    expect(html).toContain('class="hero__pausa"');
    expect(html.match(/class="hero__punto"/g)).toHaveLength(2);
    expect(html).toContain('aria-label="Mostrar banner 2 de 2"');
  });

  it('con un solo banner no hay carrusel ni controles', () => {
    const html = renderBloque(makeBlock('hero', { slides: [slides[0]] }));
    expect(html).not.toContain('data-carrusel');
    expect(html).not.toContain('hero__controles');
  });

  it('pinta el botón principal en acento y el segundo sobre vidrio', () => {
    const html = renderBloque(makeBlock('hero', {
      slides, cta: 'Carreras', ctaLink: '/programas', cta2: 'Licenciamiento', cta2Link: '/licenciamiento',
    }));
    expect(html).toContain('<a class="boton boton--acento" href="/programas">Carreras</a>');
    expect(html).toContain('<a class="boton boton--claro" href="/licenciamiento">Licenciamiento</a>');
  });

  it('el segundo botón sin enlace válido no se pinta como enlace', () => {
    const html = renderBloque(makeBlock('hero', { slides, cta2: 'Pronto', cta2Link: 'javascript:alert(1)' }));
    expect(html).not.toContain('javascript:');
  });

  it('las imágenes de banner son decorativas y el primero se carga con prioridad', () => {
    const html = renderBloque(makeBlock('hero', { slides }));
    expect(html).toContain('<img src="/m/1.webp" alt="" fetchpriority="high"');
    expect(html).toContain('<img src="/m/2.webp" alt="" loading="lazy"');
  });
});

describe('banda de cifras', () => {
  it('muestra etiqueta, título y cada cifra con su icono', () => {
    const html = renderBloque(makeBlock('stats', {
      tag: 'Periodo académico 2025-II',
      title: 'Nuestras cifras de impacto',
      items: [{ icon: 'usuarios', number: '29', label: 'Docentes' }, { icon: 'bi-x', number: '356', label: 'Estudiantes' }],
    }));
    expect(html).toContain('<div class="cifras"><p class="bloque__tag">Periodo académico 2025-II</p><h2>Nuestras cifras de impacto</h2>');
    expect(html).toContain('<span class="estadistica__icono"><svg class="icono"');
    expect(html.match(/estadistica__icono/g)).toHaveLength(1); // el icono desconocido se omite
    expect(html).toContain('<span class="dato">356</span>');
  });

  it('sin cifras no pinta la banda', () => {
    expect(renderBloque(makeBlock('stats', { title: 'Cifras', items: [] }))).not.toContain('class="cifras"');
  });
});

describe('accesos institucionales', () => {
  const props = {
    title: 'Transparencia y gestión',
    grupos: [
      { titulo: 'Postulantes', destacado: true, enlaces: [
        { icono: 'graduacion', texto: 'Admisión', descripcion: 'Proceso de admisión', url: '/admision' },
      ] },
      { titulo: 'Normativa', destacado: false, enlaces: [
        { icono: 'documento', texto: 'Transparencia', descripcion: '', url: '/transparencia' },
        { icono: '', texto: 'Sin enlace', descripcion: '', url: 'javascript:alert(1)' },
      ] },
    ],
  };

  it('pinta grupos con encabezado y tarjetas enlazadas', () => {
    const html = renderBloque(makeBlock('accesos', props));
    expect(html).toContain('<h2>Transparencia y gestión</h2>');
    expect(html).toContain('<h3 class="accesos__grupo">Postulantes</h3>');
    expect(html).toContain('<ul class="accesos__lista accesos__lista--destacada">');
    expect(html).toContain('<a class="acceso" href="/admision">');
    expect(html).toContain('<span class="acceso__texto">Proceso de admisión</span>');
  });

  it('un enlace inseguro se omite', () => {
    const html = renderBloque(makeBlock('accesos', props));
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('Sin enlace');
  });
});

describe('entidades en marquesina', () => {
  const logo = (n: number) => ({ title: `Entidad ${n}`, url: `https://e${n}.test`, image: `/m/e${n}.webp`, alt: `Logo de la entidad ${n}` });

  it('con 4 o más logos duplica la lista oculta para el bucle continuo', () => {
    const html = renderBloque(makeBlock('entidades', { title: 'Aliados', text: '', items: [1, 2, 3, 4].map(logo) }));
    expect(html).toContain('data-marquesina');
    expect(html.match(/<ul class="entidades__lista"/g)).toHaveLength(2);
    expect(html).toContain('<ul class="entidades__lista" aria-hidden="true">');
    // La copia no es navegable por teclado.
    expect(html).toContain('tabindex="-1"');
  });

  it('con pocos logos los muestra quietos y sin copia', () => {
    const html = renderBloque(makeBlock('entidades', { title: 'Aliados', items: [1, 2].map(logo) }));
    expect(html).not.toContain('data-marquesina');
    expect(html.match(/entidades__lista/g)).toHaveLength(1);
    expect(html).toContain('<a href="https://e1.test" class="entidades__logo">');
  });
});
