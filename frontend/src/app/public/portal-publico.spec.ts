// @vitest-environment jsdom
import '@angular/compiler';
import { getTestBed, TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Title } from '@angular/platform-browser';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PortalPublico } from './portal-publico';
import { makeBlock } from '../cms/block-registry';
import { readFileSync } from 'node:fs';

getTestBed().initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

describe('PortalPublico', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;
  const sitio = {
    identidad: { nombre: 'Instituto de ejemplo', direccion: 'Dirección de prueba', correo: 'info@ejemplo.test' },
    apariencia: { color_primario: '#315836', pie_legal: 'Información institucional' },
    configuracion: {},
    menu: [{ slug: 'oferta', titulo: 'Oferta académica', ruta: '/estudios/oferta' }],
  };

  beforeEach(async () => {
    TestBed.overrideComponent(PortalPublico, { set: {
      template: readFileSync('src/app/public/portal-publico.html', 'utf8'),
      templateUrl: undefined, styleUrl: undefined, styles: [],
    } });
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([{ path: '**', component: PortalPublico }])],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
  });
  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  /** El sitio publicado llega por promesa: se espera a que se aplique. */
  async function estabilizar(): Promise<void> {
    await new Promise((r) => setTimeout(r, 0));
    harness.detectChanges();
  }

  async function responderPagina(ruta: string, titulo = 'Oferta académica'): Promise<void> {
    http.expectOne('/api/publico/sitio?locale=es').flush(sitio);
    const req = http.expectOne((r) => r.url === '/api/publico/pagina' && r.params.get('ruta') === ruta);
    req.flush({ titulo, contenido: { blocks: [makeBlock('richText', { body: '<p>Contenido publicado de prueba</p>' })] }, version: 3 });
    await estabilizar();
  }

  it('muestra identidad, menu, contenido publicado, tema y título', async () => {
    await harness.navigateByUrl('/estudios/oferta');
    await responderPagina('/estudios/oferta');
    const el: HTMLElement = harness.routeNativeElement!;
    expect(el.textContent).toContain('Instituto de ejemplo');
    expect(el.textContent).toContain('Contenido publicado de prueba');
    expect(el.querySelector('nav a')?.getAttribute('href')).toBe('/estudios/oferta');
    expect(el.querySelector<HTMLElement>('.marco')?.style.getPropertyValue('--color-primario')).toBe('#315836');
    expect(TestBed.inject(Title).getTitle()).toBe('Oferta académica | Instituto de ejemplo');
    expect(el.querySelector('.saltar-contenido')?.getAttribute('href')).toBe('#contenido-principal');
  });

  it('el marco compartido está presente: cabecera y pie', async () => {
    await harness.navigateByUrl('/estudios/oferta');
    await responderPagina('/estudios/oferta');
    const el: HTMLElement = harness.routeNativeElement!;
    expect(el.querySelector('header.cabecera')).not.toBeNull();
    expect(el.querySelector('footer.pie')).not.toBeNull();
    expect(el.querySelector('footer.pie')?.textContent).toContain('Información institucional');
  });

  it('con un héroe al inicio el h1 queda solo para lectores, sin duplicar el título visible', async () => {
    await harness.navigateByUrl('/nosotros');
    http.expectOne('/api/publico/sitio?locale=es').flush(sitio);
    http.expectOne((r) => r.url === '/api/publico/pagina').flush({
      titulo: 'Nosotros', version: 1,
      contenido: { blocks: [makeBlock('pageHero', { title: 'Nosotros', text: '31 años formando maestros' })] },
    });
    await estabilizar();
    const el: HTMLElement = harness.routeNativeElement!;
    expect(el.querySelector('h1')?.textContent).toContain('Nosotros');
    expect(el.querySelector('.titulo-pagina')?.classList).toContain('sr-only');
  });

  it('sin héroe al inicio el h1 se ve', async () => {
    await harness.navigateByUrl('/estudios/oferta');
    await responderPagina('/estudios/oferta');
    expect(harness.routeNativeElement!.querySelector('.titulo-pagina')?.classList).not.toContain('sr-only');
  });

  it('una ruta inexistente muestra 404 con salida al inicio, no redirige en silencio', async () => {
    await harness.navigateByUrl('/no-existe');
    http.expectOne('/api/publico/sitio?locale=es').flush(sitio);
    http.expectOne((r) => r.url === '/api/publico/pagina').flush({}, { status: 404, statusText: 'Not Found' });
    await estabilizar();
    expect(harness.routeNativeElement?.textContent).toContain('Página no encontrada');
    expect(harness.routeNativeElement?.querySelector('main a')?.getAttribute('href')).toBe('/');
  });

  it('distingue un fallo del servidor y permite reintentar', async () => {
    await harness.navigateByUrl('/estudios/oferta');
    http.expectOne('/api/publico/sitio?locale=es').flush(sitio);
    http.expectOne((r) => r.url === '/api/publico/pagina').flush({}, { status: 500, statusText: 'Server Error' });
    await estabilizar();
    const texto = harness.routeNativeElement?.textContent ?? '';
    expect(texto).toContain('No se pudo cargar');
    expect(texto).toContain('El servidor no está disponible');
    expect(texto).not.toContain('No hay conexión');
    harness.routeNativeElement?.querySelector<HTMLButtonElement>('main button')?.click();
    await responderPagina('/estudios/oferta');
    expect(harness.routeNativeElement?.textContent).toContain('Contenido publicado de prueba');
  });

  it('un fallo de red (status 0) muestra el mensaje de conexión', async () => {
    await harness.navigateByUrl('/estudios/oferta');
    http.expectOne('/api/publico/sitio?locale=es').flush(sitio);
    http.expectOne((r) => r.url === '/api/publico/pagina').error(new ErrorEvent('sin red'));
    await estabilizar();
    expect(harness.routeNativeElement?.textContent).toContain('No hay conexión con el servidor');
  });

  it('al navegar borra la página anterior y carga la ruta nueva', async () => {
    await harness.navigateByUrl('/uno');
    await responderPagina('/uno', 'Primera página');
    await harness.navigateByUrl('/dos');
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).not.toContain('Contenido publicado de prueba');
    await responderPagina('/dos', 'Segunda página');
    expect(TestBed.inject(Title).getTitle()).toBe('Segunda página | Instituto de ejemplo');
  });

  it('el buscador de la cabecera navega a /buscar con la consulta', async () => {
    await harness.navigateByUrl('/estudios/oferta');
    await responderPagina('/estudios/oferta');
    const campo =
      harness.routeNativeElement!.querySelector<HTMLInputElement>('#busqueda-cabecera-campo')!;
    campo.value = 'oferta';
    campo.dispatchEvent(new Event('input'));
    harness.detectChanges();
    harness.routeNativeElement!.querySelector<HTMLFormElement>('.busqueda-cabecera')!
      .dispatchEvent(new Event('submit'));
    await new Promise((r) => setTimeout(r, 0));

    expect(TestBed.inject(Router).url).toBe('/buscar?q=oferta');
    http.expectOne('/api/publico/sitio?locale=es').flush(sitio);
    http
      .expectOne((r) => r.url === '/api/publico/pagina')
      .flush({}, { status: 404, statusText: 'Not Found' });
    await estabilizar();
    expect(harness.routeNativeElement?.textContent).toContain('Página no encontrada');
  });

  it('el bloque de mapa conserva su iframe en el portal', async () => {
    await harness.navigateByUrl('/mapa');
    http.expectOne('/api/publico/sitio?locale=es').flush(sitio);
    http.expectOne((r) => r.url === '/api/publico/pagina').flush({
      titulo: 'Cómo llegar',
      contenido: {
        blocks: [
          makeBlock('map', {
            title: 'Sede',
            embed: 'https://mapa.example.test/embed',
            address: 'Av. Principal 1234',
          }),
        ],
      },
      version: 1,
    });
    await estabilizar();
    const iframe = harness.routeNativeElement?.querySelector('iframe');
    expect(iframe?.getAttribute('src')).toBe('https://mapa.example.test/embed');
  });
});
