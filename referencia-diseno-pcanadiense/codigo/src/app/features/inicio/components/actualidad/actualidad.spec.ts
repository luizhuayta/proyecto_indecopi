import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { PortalApi } from '../../../../core/api/portal.api';
import type { NewsItem } from '../../../../core/models/news.model';
import { Actualidad } from './actualidad';

describe('Actualidad', () => {
  const noticia: NewsItem = {
    id: 'noticia-quill',
    title: 'Examen de admisión',
    category: 'noticia',
    categoryLabel: 'Actividad',
    excerpt: '<p>Con&nbsp;la&nbsp;aplicación de la <strong>entrevista.</strong></p>',
    paragraphs: ['<p>Contenido de la noticia.</p>'],
    image: '',
    imageAlt: '',
    createdAt: '2026-08-23',
    featured: true,
    publicada: true,
  };

  const comunicado: NewsItem = {
    ...noticia,
    id: 'comunicado-quill',
    title: 'Aviso institucional',
    category: 'comunicado',
    categoryLabel: 'Comunicado',
    excerpt: '<p>Información&nbsp;para familias &amp; docentes.</p>',
  };

  const crear = async () => {
    await TestBed.configureTestingModule({
      imports: [Actualidad],
      providers: [
        provideHttpClient(),
        provideRouter([]),
        { provide: PortalApi, useValue: { noticias: async () => [noticia, comunicado] } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(Actualidad);
    await fixture.whenStable();
    return fixture;
  };

  beforeEach(() => {
    vi.stubGlobal('matchMedia', (media: string) => ({
      matches: false,
      media,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => true,
    }));
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.unstubAllGlobals();
  });

  it('muestra la bajada de noticias de Quill como texto limpio en Inicio', async () => {
    const fixture = await crear();
    const raiz = fixture.nativeElement as HTMLElement;
    expect(raiz.querySelector('.feat:not(.feat--com) .feat__excerpt')?.textContent).toBe(
      'Con la aplicación de la entrevista.',
    );
  });

  it('muestra la bajada de comunicados de Quill como texto limpio en Inicio', async () => {
    const fixture = await crear();
    const raiz = fixture.nativeElement as HTMLElement;
    expect(raiz.querySelector('.feat--com .feat__excerpt')?.textContent).toBe(
      'Información para familias & docentes.',
    );
  });

  it('no modifica el HTML del CMS al mostrar los resúmenes', async () => {
    const fixture = await crear();
    expect(fixture.componentInstance.noticiaDestacada()?.excerpt).toBe(
      '<p>Con&nbsp;la&nbsp;aplicación de la <strong>entrevista.</strong></p>',
    );
    expect(fixture.componentInstance.comunicadoDestacado()?.excerpt).toBe(
      '<p>Información&nbsp;para familias &amp; docentes.</p>',
    );
  });
});
