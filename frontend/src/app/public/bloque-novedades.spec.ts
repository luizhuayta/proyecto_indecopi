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
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BloqueNovedades } from './bloque-novedades';
import type { NoticiaPublica } from '../cms/cms.models';

getTestBed().initTestEnvironment(
  BrowserTestingModule,
  platformBrowserTesting(),
);

const n = (p: Partial<NoticiaPublica>): NoticiaPublica => ({
  id: 1,
  tipo: 'noticia',
  titulo: 'T',
  slug: 't',
  ruta: '/noticias/t',
  categoria: '',
  resumen: '',
  imagen_url: '',
  imagen_alt: '',
  destacada: false,
  publicado_en: '2025-07-28T10:00:00-05:00',
  ...p,
});

describe('BloqueNovedades', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  async function montar(props: Record<string, unknown>) {
    const f = TestBed.createComponent(BloqueNovedades);
    f.componentRef.setInput('bloque', props);
    f.detectChanges();
    return f;
  }

  it('pide las cantidades configuradas y destaca la noticia marcada', async () => {
    const f = await montar({
      title: 'Noticias',
      allLabel: 'Ver todas',
      cantidadNoticias: 3,
      cantidadComunicados: 2,
    });
    http.expectOne('/api/publico/noticias?tipo=noticia&limite=3').flush({
      total: 3,
      items: [
        n({ id: 1, titulo: 'Primera', slug: 'a', ruta: '/noticias/a' }),
        n({
          id: 2,
          titulo: 'Destacada',
          slug: 'b',
          ruta: '/noticias/b',
          destacada: true,
          imagen_url: '/m/b.webp',
          imagen_alt: 'Foto B',
        }),
        n({ id: 3, titulo: 'Tercera', slug: 'c', ruta: '/noticias/c' }),
      ],
    });
    http
      .expectOne('/api/publico/noticias?tipo=comunicado&limite=2')
      .flush({
        total: 1,
        items: [n({ id: 9, tipo: 'comunicado', titulo: 'Aviso' })],
      });
    await f.whenStable();
    // Las promesas de firstValueFrom se resuelven como microtareas: un ciclo
    // más de la cola las vacía antes de repintar.
    await new Promise((r) => setTimeout(r, 0));
    f.detectChanges();
    const el: HTMLElement = f.nativeElement;
    expect(
      el.querySelector('.noticia--destacada h3')?.textContent?.trim(),
    ).toBe('Destacada');
    expect(el.querySelectorAll('.noticias__lista .noticia')).toHaveLength(2);
    expect(el.querySelector('.comunicado__titulo')?.textContent?.trim()).toBe(
      'Aviso',
    );
    expect(
      el
        .querySelector<HTMLAnchorElement>('.novedades__todas')
        ?.getAttribute('href'),
    ).toBe('/noticias');
  });

  it('con 0 comunicados no los pide ni pinta su panel', async () => {
    const f = await montar({ cantidadNoticias: 1, cantidadComunicados: 0 });
    http
      .expectOne('/api/publico/noticias?tipo=noticia&limite=1')
      .flush({ total: 0, items: [] });
    http.expectNone(
      (r) =>
        r.params.get('tipo') === 'comunicado' ||
        r.urlWithParams.includes('comunicado'),
    );
    await f.whenStable();
    await new Promise((r) => setTimeout(r, 0));
    f.detectChanges();
    expect(
      f.nativeElement.querySelector('.novedades__panel--comunicados'),
    ).toBeNull();
    expect(f.nativeElement.textContent).toContain(
      'Pronto publicaremos novedades.',
    );
  });

  it('acota cantidades fuera de rango', async () => {
    await montar({ cantidadNoticias: 99, cantidadComunicados: -3 });
    http
      .expectOne('/api/publico/noticias?tipo=noticia&limite=6')
      .flush({ total: 0, items: [] });
  });
});
