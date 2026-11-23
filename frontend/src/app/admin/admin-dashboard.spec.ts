// @vitest-environment jsdom
import '@angular/compiler';
import { getTestBed, TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AdminDashboard } from './admin-dashboard';
import { AuthService, AdminRole } from '../cms/auth.service';
import { MensajeItem } from '../cms/cms-api.service';

getTestBed().initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

function mensaje(id: number, tipo: string): MensajeItem {
  return {
    id,
    tipo,
    asunto: `Caso ${id}`,
    ticket: `MSG-${id}`,
    estado: 'pendiente',
    respuesta: '',
    notificado: false,
    creado_en: '2026-11-22T10:00:00+00:00',
    nombre: 'Ana Prueba',
    correo: 'a@b.test',
    telefono: '',
    mensaje: 'Detalle',
  };
}

describe('AdminDashboard — portada del panel', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;

  async function estable(): Promise<void> {
    harness.detectChanges();
    await new Promise((r) => setTimeout(r, 0));
    harness.detectChanges();
  }

  function conRol(rol: AdminRole, usuario = 'usuaria'): void {
    const auth = TestBed.inject(AuthService);
    auth.ready.set(true);
    auth.username.set(usuario);
    auth.role.set(rol);
  }

  /** Responde las peticiones del tablero con datos de prueba. */
  function responderMetricas(): void {
    http
      .expectOne((r) => r.url === '/api/mensajes' && r.params.get('estado') === 'pendiente')
      .flush({ items: [mensaje(1, 'tramite'), mensaje(2, 'tramite'), mensaje(3, 'reclamo')] });
    http.expectOne((r) => r.url === '/api/paginas').flush({
      paginas: Array.from({ length: 9 }, (_, i) => ({ slug: `p${i}`, titulo: `P${i}` })),
      menu: [],
    });
    http.expectOne((r) => r.url === '/api/noticias').flush({
      items: [
        { id: 1, estado: 'publicado' },
        { id: 2, estado: 'publicado' },
        { id: 3, estado: 'publicado' },
        { id: 4, estado: 'borrador' },
        { id: 5, estado: 'borrador' },
      ],
    });
    http.expectOne((r) => r.url === '/api/medios').flush({
      items: Array.from({ length: 12 }, (_, i) => ({ id: i })),
    });
    http.expectOne((r) => r.url === '/api/auth/usuarios').flush({
      items: Array.from({ length: 4 }, (_, i) => ({ id: i })),
    });
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'admin', component: AdminDashboard }]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('saluda con el nombre y el rol de la sesión', async () => {
    conRol('admin', 'admin');
    harness = await RouterTestingHarness.create('/admin');
    responderMetricas();
    await estable();

    const el = harness.routeNativeElement!;
    expect(el.querySelector('.admin-encabezado__titulo')!.textContent).toContain(
      'Hola, admin',
    );
    expect(el.querySelector('.admin-encabezado')!.textContent).toContain('Administrador');
    expect(el.textContent).toContain('Ver portal');
  });

  it('agrupa las solicitudes pendientes por bandeja con enlace a cada una', async () => {
    conRol('admin', 'admin');
    harness = await RouterTestingHarness.create('/admin');
    responderMetricas();
    await estable();

    const el = harness.routeNativeElement!;
    expect(el.textContent).toContain('Solicitudes sin atender');
    expect(el.textContent).toContain('3 pendientes');
    const filas = [...el.querySelectorAll<HTMLAnchorElement>('.dash-bandeja__enlace')];
    // Mesa de partes primero, luego Reclamaciones (orden fijo del panel).
    expect(filas.map((f) => f.querySelector('.dash-bandeja__nombre')!.textContent)).toEqual([
      'Mesa de partes',
      'Reclamaciones',
    ]);
    expect(filas[0].getAttribute('href')).toBe('/admin/mensajes?tipo=tramite');
    expect(filas[0].textContent).toContain('2 sin atender');
    expect(filas[1].textContent).toContain('1 sin atender');
  });

  it('muestra los conteos reales del contenido', async () => {
    conRol('admin', 'admin');
    harness = await RouterTestingHarness.create('/admin');
    responderMetricas();
    await estable();

    const tarjetas = [
      ...harness.routeNativeElement!.querySelectorAll<HTMLElement>('.dash-tarjeta'),
    ].map((t) => t.textContent!.replace(/\s+/g, ' ').trim());
    expect(tarjetas).toHaveLength(4);
    expect(tarjetas[0]).toContain('9');
    expect(tarjetas[0]).toContain('Páginas');
    expect(tarjetas[1]).toContain('3');
    expect(tarjetas[1]).toContain('Noticias publicadas');
    expect(tarjetas[1]).toContain('2 en borrador');
    expect(tarjetas[2]).toContain('12');
    expect(tarjetas[2]).toContain('Medios');
    expect(tarjetas[3]).toContain('4');
    expect(tarjetas[3]).toContain('Usuarios');
  });

  it('cuando todo está atendido lo dice, en vez de mostrar una lista vacía', async () => {
    conRol('admin', 'admin');
    harness = await RouterTestingHarness.create('/admin');
    http
      .expectOne((r) => r.url === '/api/mensajes')
      .flush({ items: [] });
    http.expectOne((r) => r.url === '/api/paginas').flush({ paginas: [], menu: [] });
    http.expectOne((r) => r.url === '/api/noticias').flush({ items: [] });
    http.expectOne((r) => r.url === '/api/medios').flush({ items: [] });
    http.expectOne((r) => r.url === '/api/auth/usuarios').flush({ items: [] });
    await estable();
    expect(harness.routeNativeElement!.textContent).toContain('Todo atendido');
  });

  it('a la secretaria solo le salen sus métricas: trámites, noticias y medios', async () => {
    conRol('secretaria', 'secretaria');
    harness = await RouterTestingHarness.create('/admin');
    http
      .expectOne((r) => r.url === '/api/mensajes')
      .flush({ items: [mensaje(1, 'contacto')] });
    http.expectOne((r) => r.url === '/api/noticias').flush({
      items: [{ id: 1, estado: 'borrador' }],
    });
    http.expectOne((r) => r.url === '/api/medios').flush({ items: [{ id: 1 }] });
    // Ni páginas ni usuarios: la API se los negaría, así que ni se piden.
    http.expectNone((r) => r.url === '/api/paginas');
    http.expectNone((r) => r.url === '/api/auth/usuarios');
    await estable();

    const el = harness.routeNativeElement!;
    expect(el.querySelector('.admin-encabezado')!.textContent).toContain('Secretaría');
    const tarjetas = [
      ...el.querySelectorAll<HTMLElement>('.dash-tarjeta'),
    ].map((t) => t.textContent);
    expect(tarjetas).toHaveLength(2);
    expect(tarjetas.join(' ')).toContain('Noticias publicadas');
    expect(tarjetas.join(' ')).toContain('Medios');
    expect(tarjetas.join(' ')).not.toContain('Usuarios');
    // Las bandejas sí son suyas: Otras solicitudes enlaza a su filtro.
    const fila = el.querySelector<HTMLAnchorElement>('.dash-bandeja__enlace')!;
    expect(fila.textContent).toContain('Otras solicitudes');
    expect(fila.getAttribute('href')).toBe('/admin/mensajes?tipo=contacto');
    // Y sus accesos rápidos no incluyen secciones prohibidas.
    const accesos = [...el.querySelectorAll<HTMLAnchorElement>('.dash-acceso')].map((a) =>
      a.getAttribute('href'),
    );
    expect(accesos).not.toContain('/admin/usuarios');
    expect(accesos).not.toContain('/admin/paginas');
    expect(accesos).toContain('/admin/noticias');
  });
});
