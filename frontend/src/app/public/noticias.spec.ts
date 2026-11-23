// @vitest-environment jsdom
import '@angular/compiler';
import { getTestBed, TestBed } from '@angular/core/testing';
import {
  BrowserTestingModule,
  platformBrowserTesting,
} from '@angular/platform-browser/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Noticias } from './noticias';
import type { NoticiaPublica } from '../cms/cms.models';

getTestBed().initTestEnvironment(
  BrowserTestingModule,
  platformBrowserTesting(),
);

const n = (p: Partial<NoticiaPublica>): NoticiaPublica => ({
  id: 1,
  tipo: 'noticia',
  titulo: 'Inicio del año académico',
  slug: 'inicio',
  ruta: '/noticias/inicio',
  categoria: 'Institucional',
  resumen: 'Bienvenida',
  imagen_url: '',
  imagen_alt: '',
  destacada: false,
  publicado_en: '2026-03-01T10:00:00-05:00',
  ...p,
});

describe('Noticias (listado público)', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;

  function flushSitio(): void {
    http
      .match((r) => r.url === '/api/publico/sitio')
      .forEach((r) => r.flush({ apariencia: {}, identidad: {}, menu: [] }));
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'noticias', component: Noticias }]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create('/noticias');
    flushSitio();
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('pide la primera página y pinta las tarjetas', async () => {
    http
      .expectOne('/api/publico/noticias?limite=9&pagina=1')
      .flush({
        total: 2,
        items: [n({}), n({ id: 2, titulo: 'Segunda', tipo: 'comunicado' })],
      });
    await new Promise((r) => setTimeout(r, 0));
    harness.detectChanges();
    const el: HTMLElement = harness.routeNativeElement!;
    expect(el.querySelector('h1')?.textContent).toContain(
      'Noticias y comunicados',
    );
    expect(el.querySelectorAll('.noticia-tarjeta')).toHaveLength(2);
  });

  it('la pestaña Comunicados pide tipo=comunicado', async () => {
    http
      .expectOne('/api/publico/noticias?limite=9&pagina=1')
      .flush({ total: 1, items: [n({})] });
    await new Promise((r) => setTimeout(r, 0));
    harness.detectChanges();
    const el: HTMLElement = harness.routeNativeElement!;
    const pestanas = el.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    pestanas[2]!.click();
    await new Promise((r) => setTimeout(r, 0));
    harness.detectChanges();
    http
      .expectOne(
        (r) =>
          r.url === '/api/publico/noticias' &&
          r.params.get('tipo') === 'comunicado',
      )
      .flush({ total: 0, items: [] });
  });
});
