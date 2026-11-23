// @vitest-environment jsdom
import '@angular/compiler';
import { getTestBed, TestBed, ComponentFixture } from '@angular/core/testing';
import {
  BrowserTestingModule,
  platformBrowserTesting,
} from '@angular/platform-browser/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  provideHttpClientTesting,
  HttpTestingController,
} from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AdminNoticias } from './admin-noticias';
import { NoticiaAdmin } from '../cms/cms-api.service';
import { AuthService } from '../cms/auth.service';

getTestBed().initTestEnvironment(
  BrowserTestingModule,
  platformBrowserTesting(),
);

const noticia = (p: Partial<NoticiaAdmin> = {}): NoticiaAdmin => ({
  id: 1,
  tipo: 'noticia',
  titulo: 'Día de la peruanidad',
  slug: 'dia',
  ruta: '/noticias/dia',
  categoria: 'Institucional',
  resumen: 'Actos cívicos',
  cuerpo: '<p>Texto</p>',
  imagen_url: '/m/1.webp',
  imagen_alt: 'Patio',
  destacada: false,
  estado: 'publicado',
  publicado_en: '2025-07-28T10:00:00-05:00',
  autor: 'admin',
  actualizado_en: null,
  ...p,
});

describe('AdminNoticias', () => {
  let http: HttpTestingController;

  /** La vista previa pide el tema publicado al abrir el formulario. */
  function flushSitio(): void {
    http
      .match((r) => r.url === '/api/publico/sitio')
      .forEach((r) => r.flush({ apariencia: {}, identidad: {}, menu: [] }));
  }

  async function montar(rol: 'admin' | 'editor'): Promise<{
    el: HTMLElement;
    http: HttpTestingController;
    fixture: ComponentFixture<AdminNoticias>;
  }> {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(AuthService).role.set(rol);
    const fixture = TestBed.createComponent(AdminNoticias);
    fixture.detectChanges();
    return { el: fixture.nativeElement, http, fixture };
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    http?.verify();
    TestBed.resetTestingModule();
  });

  it('lista noticias con portada, tipo, estado y buscador', async () => {
    const { el, fixture } = await montar('admin');
    http.expectOne('/api/noticias').flush({
      items: [
        noticia(),
        noticia({
          id: 2,
          titulo: 'Comunicado X',
          tipo: 'comunicado',
          estado: 'borrador',
        }),
      ],
    });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(el.querySelector('tbody img')?.getAttribute('alt')).toBe('');
    expect(el.textContent).toContain('Borrador');

    const buscar = el.querySelector<HTMLInputElement>('#buscar-noticias')!;
    buscar.value = 'comunicado';
    buscar.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(el.querySelectorAll('tbody tr')).toHaveLength(1);
  });

  it('crea una noticia desde el formulario', async () => {
    const { el, fixture } = await montar('admin');
    http.expectOne('/api/noticias').flush({ items: [] });
    await fixture.whenStable();
    fixture.detectChanges();

    el.querySelector<HTMLButtonElement>('.admin-noticias__nueva')!.click();
    fixture.detectChanges();
    flushSitio();
    // Los controles ngModel del formulario se registran en el siguiente ciclo.
    await new Promise((r) => setTimeout(r, 0));
    fixture.detectChanges();

    const titulo = el.querySelector<HTMLInputElement>('#noticia-titulo')!;
    titulo.value = 'Inicio de clases';
    titulo.dispatchEvent(new Event('input'));

    el.querySelector<HTMLFormElement>(
      'form.admin-noticias__form',
    )!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    const req = http.expectOne(
      (r) => r.method === 'POST' && r.url === '/api/noticias',
    );
    expect(req.request.body.titulo).toBe('Inicio de clases');
    expect(req.request.body.estado).toBe('borrador');
    req.flush(
      noticia({ id: 9, titulo: 'Inicio de clases', estado: 'borrador' }),
    );
  });

  it('?nueva=1 abre el formulario de alta y limpia la URL', async () => {
    // La acción contextual de la cabecera llega como parámetro de la URL.
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'admin/noticias', component: AdminNoticias },
        ]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(AuthService).role.set('admin');

    const harness = await RouterTestingHarness.create('/admin/noticias?nueva=1');
    http.expectOne('/api/noticias').flush({ items: [] });
    flushSitio();
    await new Promise((r) => setTimeout(r, 0));
    harness.detectChanges();

    const el: HTMLElement = harness.routeNativeElement!;
    expect(el.querySelector('#noticia-titulo')).toBeTruthy();
    expect(el.textContent).toContain('Nueva noticia');
    expect(TestBed.inject(Router).url).toBe('/admin/noticias');
  });

  it('el editor no ve la opción de publicar ni el botón eliminar', async () => {
    const { el, fixture } = await montar('editor');
    http
      .expectOne('/api/noticias')
      .flush({ items: [noticia({ estado: 'borrador' })] });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.querySelector('.admin-noticias__eliminar')).toBeNull();

    el.querySelector<HTMLButtonElement>('.admin-noticias__editar')!.click();
    fixture.detectChanges();
    flushSitio();
    expect(
      el.querySelector('#noticia-estado option[value="publicado"]'),
    ).toBeNull();
  });
});
