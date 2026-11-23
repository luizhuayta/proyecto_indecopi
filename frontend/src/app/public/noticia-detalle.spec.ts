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
import { NoticiaDetalle } from './noticia-detalle';
import type { NoticiaPublica } from '../cms/cms.models';

getTestBed().initTestEnvironment(
  BrowserTestingModule,
  platformBrowserTesting(),
);

const noticia: NoticiaPublica = {
  id: 7,
  tipo: 'noticia',
  titulo: 'Resultados del examen de admisión',
  slug: 'resultados',
  ruta: '/noticias/resultados',
  categoria: 'Admisión',
  resumen: 'Consulta la lista de ingresantes.',
  cuerpo: '<p>La lista ya está disponible.</p>',
  imagen_url: '',
  imagen_alt: '',
  destacada: false,
  publicado_en: '2026-02-10T10:00:00-05:00',
};

describe('NoticiaDetalle', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'noticias/:slug', component: NoticiaDetalle }]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  function flushSitio(): void {
    http
      .match((r) => r.url === '/api/publico/sitio')
      .forEach((r) => r.flush({ apariencia: {}, identidad: {}, menu: [] }));
  }

  it('pinta el título como h1 y el cuerpo saneado', async () => {
    const harness = await RouterTestingHarness.create('/noticias/resultados');
    http.expectOne('/api/publico/noticias/resultados').flush(noticia);
    flushSitio();
    await new Promise((r) => setTimeout(r, 0));
    harness.detectChanges();
    const el: HTMLElement = harness.routeNativeElement!;
    expect(el.querySelector('h1')?.textContent?.trim()).toBe(
      'Resultados del examen de admisión',
    );
    expect(el.querySelector('.noticia-detalle__cuerpo')?.innerHTML).toContain(
      'La lista',
    );
    expect(el.textContent).toContain('Volver a noticias');
  });

  it('con un 404 muestra la misma página no encontrada del portal', async () => {
    const harness = await RouterTestingHarness.create('/noticias/no-existe');
    http
      .expectOne('/api/publico/noticias/no-existe')
      .flush({ error: 'no' }, { status: 404, statusText: 'Not Found' });
    flushSitio();
    await new Promise((r) => setTimeout(r, 0));
    harness.detectChanges();
    const el: HTMLElement = harness.routeNativeElement!;
    expect(el.textContent).toContain('Página no encontrada');
  });
});
