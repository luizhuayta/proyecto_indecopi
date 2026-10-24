// @vitest-environment jsdom
import '@angular/compiler';
import { getTestBed, TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Buscar, ResultadoBusqueda } from './buscar';

getTestBed().initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

const resultados: ResultadoBusqueda[] = [
  {
    titulo: 'Oferta académica',
    ruta: '/estudios/oferta',
    fragmento: '…requisitos de admisión y matrícula…',
  },
  {
    titulo: 'Admisión 2026',
    ruta: '/admision',
    fragmento: '…calendario del proceso de admisión…',
  },
];

describe('Buscar', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;

  const sitio = {
    identidad: { nombre: 'Instituto de ejemplo', direccion: 'Dirección de prueba', correo: 'info@ejemplo.test' },
    apariencia: { color_primario: '#315836', pie_legal: 'Información institucional' },
    menu: [{ slug: 'oferta', titulo: 'Oferta académica', ruta: '/estudios/oferta' }],
  };

  async function recargar(): Promise<void> {
    harness.detectChanges();
    await new Promise((r) => setTimeout(r, 0));
    harness.detectChanges();
  }

  /** El marco compartido lee los datos publicados del sitio. */
  function responderSitio(): void {
    http.expectOne('/api/publico/sitio?locale=es').flush(sitio);
  }

  function responder(q: string, items: ResultadoBusqueda[]): void {
    http
      .expectOne(
        (r) =>
          r.url === '/api/publico/buscar' &&
          r.method === 'GET' &&
          r.params.get('q') === q &&
          r.params.get('locale') === 'es',
      )
      .flush({ resultados: items });
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'buscar', component: Buscar }]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('muestra los resultados con su título, fragmento y enlace', async () => {
    await harness.navigateByUrl('/buscar?q=admisión');
    responderSitio();
    responder('admisión', resultados);
    await recargar();

    const el: HTMLElement = harness.routeNativeElement!;
    expect(el.textContent).toContain('Oferta académica');
    expect(el.textContent).toContain('requisitos de admisión');
    expect(el.textContent).toContain('Admisión 2026');
    expect(el.querySelector('a[href="/estudios/oferta"]')?.textContent).toContain(
      'Oferta académica',
    );
  });

  it('usa el mismo marco que el portal: cabecera, navegación y pie', async () => {
    await harness.navigateByUrl('/buscar?q=oferta');
    responderSitio();
    responder('oferta', resultados);
    await recargar();

    const el: HTMLElement = harness.routeNativeElement!;
    expect(el.querySelector('header.cabecera')).not.toBeNull();
    expect(el.querySelector('footer.pie')).not.toBeNull();
    expect(el.querySelector('header.cabecera nav a')?.getAttribute('href')).toBe('/estudios/oferta');
    // En la página de resultados el buscador de la cabecera se oculta: ahí ya
    // hay un formulario de búsqueda.
    expect(el.querySelector('#busqueda-cabecera-campo')).toBeNull();
    expect(el.querySelector('#buscar-campo')).not.toBeNull();
  });

  it('avisa cuando no hay resultados', async () => {
    await harness.navigateByUrl('/buscar?q=inexistente');
    responderSitio();
    responder('inexistente', []);
    await recargar();

    expect(harness.routeNativeElement!.textContent).toContain(
      'No se encontraron resultados para «inexistente»',
    );
  });

  it('una consulta vacía no llama al API', async () => {
    await harness.navigateByUrl('/buscar');
    http.expectNone((r) => r.url === '/api/publico/buscar');
    responderSitio();
    await recargar();

    expect(harness.routeNativeElement!.textContent).toContain(
      'Escribe un término para buscar en el sitio',
    );
  });

  it('muestra el error y permite reintentar', async () => {
    await harness.navigateByUrl('/buscar?q=oferta');
    responderSitio();
    http
      .expectOne((r) => r.url === '/api/publico/buscar')
      .flush({}, { status: 500, statusText: 'Server Error' });
    await recargar();

    expect(harness.routeNativeElement!.textContent).toContain('La búsqueda no está disponible');

    harness.routeNativeElement!.querySelector<HTMLButtonElement>('.buscar__error button')!.click();
    responder('oferta', resultados);
    await recargar();

    expect(harness.routeNativeElement!.textContent).toContain('Oferta académica');
  });

  it('el formulario de la página busca la consulta escrita', async () => {
    await harness.navigateByUrl('/buscar');
    responderSitio();
    const campo = harness.routeNativeElement!.querySelector<HTMLInputElement>('#buscar-campo')!;
    campo.value = 'matrícula';
    campo.dispatchEvent(new Event('input'));
    harness.detectChanges();

    harness.routeNativeElement!.querySelector<HTMLFormElement>('.buscar__form')!
      .dispatchEvent(new Event('submit'));
    await new Promise((r) => setTimeout(r, 0));

    responder('matrícula', resultados);
    await recargar();

    expect(harness.routeNativeElement!.textContent).toContain('Oferta académica');
  });
});
