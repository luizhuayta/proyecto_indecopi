// @vitest-environment jsdom
import '@angular/compiler';
import { getTestBed, TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AdminMensajes } from './admin-mensajes';
import { MensajeItem } from '../cms/cms-api.service';
import { AuthService } from '../cms/auth.service';
import { PendientesPanel } from './pendientes-panel';

getTestBed().initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

const mensaje: MensajeItem = {
  id: 42,
  tipo: 'contacto',
  asunto: 'Consulta de admisión',
  ticket: 'MSG-TEST',
  estado: 'pendiente',
  respuesta: '',
  notificado: false,
  creado_en: '2026-10-22T10:00:00+00:00',
  nombre: 'Ana Prueba',
  correo: 'a@b.test',
  telefono: '01 2345678',
  mensaje: 'Quisiera información sobre los requisitos.',
};

describe('AdminMensajes', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;

  async function recargar(): Promise<void> {
    harness.detectChanges();
    await new Promise((r) => setTimeout(r, 0));
    harness.detectChanges();
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'admin/mensajes', component: AdminMensajes }]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create('/admin/mensajes');
    http.expectOne((r) => r.url === '/api/mensajes').flush({ items: [mensaje] });
    await recargar();
  });
  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('lista los mensajes con etiquetas legibles de tipo y estado', () => {
    const el: HTMLElement = harness.routeNativeElement!;
    expect(el.textContent).toContain('Consulta de admisión');
    expect(el.textContent).toContain('Ana Prueba');
    const celdas = el.querySelectorAll('table tbody tr:first-child td');
    expect(celdas[3].textContent!.trim()).toBe('Contacto');
    expect(celdas[4].textContent!.trim()).toBe('Pendiente');
  });

  it('filtra por trámite y muestra tipo en etiqueta y documento en el detalle', async () => {
    const tramite: MensajeItem = {
      ...mensaje,
      id: 77,
      tipo: 'tramite',
      asunto: 'Constancia de estudios',
      documento: '12345678',
    };
    const el = harness.routeNativeElement!;
    const select = el.querySelector<HTMLSelectElement>('#filtro-tipo')!;
    expect([...select.options].some((o) => o.value === 'tramite')).toBe(true);

    select.value = 'tramite';
    select.dispatchEvent(new Event('change'));
    const req = http.expectOne(
      (r) => r.url === '/api/mensajes' && r.params.get('tipo') === 'tramite'
    );
    req.flush({ items: [tramite] });
    await recargar();

    const etiqueta = el.querySelector('table tbody tr:first-child td .admin-etiqueta');
    expect(etiqueta?.textContent!.trim()).toBe('Trámite');

    el.querySelector<HTMLButtonElement>('table button')!.click();
    await recargar();
    const detalle = harness.routeNativeElement!.textContent!;
    expect(detalle).toContain('Documento');
    expect(detalle).toContain('12345678');
    expect(detalle).toContain('Trámite');
  });

  it('muestra el ticket y el mensaje al abrir el detalle', async () => {
    const el = harness.routeNativeElement!;
    el.querySelector<HTMLButtonElement>('table button')!.click();
    await recargar();
    const detalle = harness.routeNativeElement!.textContent!;
    expect(detalle).toContain('MSG-TEST');
    expect(detalle).toContain('Quisiera información sobre los requisitos.');
    expect(detalle).toContain('a@b.test');
    expect(detalle).toContain('01 2345678');
  });

  it('aplica los filtros al cambiar el select, sin botón intermedio', async () => {
    const el = harness.routeNativeElement!;
    el.querySelector<HTMLSelectElement>('#filtro-tipo')!.value = 'reclamo';
    el.querySelector<HTMLSelectElement>('#filtro-tipo')!.dispatchEvent(new Event('change'));
    const req = http.expectOne((r) => r.url === '/api/mensajes' && r.params.get('tipo') === 'reclamo');
    req.flush({ items: [] });
    await recargar();
    expect(harness.routeNativeElement!.textContent).toContain('No hay mensajes con estos filtros');
  });

  it('archiva un mensaje desde la fila y actualiza su estado', async () => {
    const el = harness.routeNativeElement!;
    const boton = [...el.querySelectorAll<HTMLButtonElement>('table button')].find(
      (b) => b.textContent!.trim() === 'Archivar'
    )!;
    boton.click();
    const req = http.expectOne((r) => r.url === '/api/mensajes/42/archivar');
    expect(req.request.method).toBe('POST');
    req.flush({ id: 42, estado: 'archivado' });
    await recargar();
    const texto = harness.routeNativeElement!.textContent!;
    expect(texto).toContain('Archivado');
    expect(
      [...harness.routeNativeElement!.querySelectorAll<HTMLButtonElement>('table button')].find(
        (b) => b.textContent!.trim() === 'Archivar'
      )
    ).toBeUndefined();
  });

  it('responde un mensaje y lo marca como respondido', async () => {
    const el = harness.routeNativeElement!;
    el.querySelector<HTMLButtonElement>('table button')!.click();
    await recargar();
    const textarea = harness.routeNativeElement!.querySelector<HTMLTextAreaElement>('#respuesta-texto')!;
    textarea.value = 'Te enviamos la información solicitada.';
    textarea.dispatchEvent(new Event('input'));
    harness.detectChanges();
    harness.routeNativeElement!.querySelector<HTMLButtonElement>('.admin-form-respuesta button')!.click();
    const req = http.expectOne((r) => r.url === '/api/mensajes/42/responder');
    expect(req.request.body.respuesta).toContain('Te enviamos la información solicitada.');
    req.flush({
      id: 42,
      estado: 'respondido',
      respuesta: req.request.body.respuesta,
      notificado: false,
      correo: 'a@b.test',
    });
    await recargar();
    expect(harness.routeNativeElement!.textContent).toContain('Respuesta guardada');
    expect(harness.routeNativeElement!.textContent).toContain('Respondido');
    expect(harness.routeNativeElement!.textContent).not.toContain('Aviso enviado');
  });

  it('pide avisar por correo al responder y confirma el aviso enviado', async () => {
    const el = harness.routeNativeElement!;
    el.querySelector<HTMLButtonElement>('table button')!.click();
    await recargar();
    const check = harness.routeNativeElement!.querySelector<HTMLInputElement>('#avisar-correo')!;
    check.checked = true;
    check.dispatchEvent(new Event('change'));
    const textarea = harness.routeNativeElement!.querySelector<HTMLTextAreaElement>('#respuesta-texto')!;
    textarea.value = 'Te enviamos la información solicitada.';
    textarea.dispatchEvent(new Event('input'));
    harness.detectChanges();
    harness.routeNativeElement!.querySelector<HTMLButtonElement>('.admin-form-respuesta button')!.click();
    const req = http.expectOne((r) => r.url === '/api/mensajes/42/responder');
    expect(req.request.body.notificar).toBe(true);
    req.flush({
      id: 42,
      estado: 'respondido',
      respuesta: req.request.body.respuesta,
      notificado: true,
      correo: 'a@b.test',
    });
    await recargar();
    const texto = harness.routeNativeElement!.textContent!;
    expect(texto).toContain('Respuesta guardada');
    expect(texto).toContain('Aviso enviado');
  });

  it('tras responder refresca el conteo compartido de pendientes', async () => {
    // Con sesión de administrador, la recarga de pendientes sí sale a la API.
    TestBed.inject(AuthService).role.set('admin');
    const el = harness.routeNativeElement!;
    el.querySelector<HTMLButtonElement>('table button')!.click();
    await recargar();
    const textarea = harness.routeNativeElement!.querySelector<HTMLTextAreaElement>(
      '#respuesta-texto',
    )!;
    textarea.value = 'Ya quedó atendido.';
    textarea.dispatchEvent(new Event('input'));
    harness.detectChanges();
    harness.routeNativeElement!.querySelector<HTMLButtonElement>(
      '.admin-form-respuesta button',
    )!.click();
    http
      .expectOne((r) => r.url === '/api/mensajes/42/responder')
      .flush({ id: 42, estado: 'respondido', respuesta: 'Ya quedó atendido.', notificado: false });
    // El refresco de pendientes sale en la continuación del responder.
    await recargar();

    const pend = http.expectOne(
      (r) => r.url === '/api/mensajes' && r.params.get('estado') === 'pendiente',
    );
    pend.flush({ items: [{ ...mensaje, tipo: 'tramite' }] });
    await recargar();
    expect(TestBed.inject(PendientesPanel).deTipo('tramite')).toBe(1);
    expect(TestBed.inject(PendientesPanel).total()).toBe(1);
  });

  it('tras archivar refresca el conteo compartido de pendientes', async () => {
    TestBed.inject(AuthService).role.set('admin');
    const el = harness.routeNativeElement!;
    const boton = [...el.querySelectorAll<HTMLButtonElement>('table button')].find(
      (b) => b.textContent!.trim() === 'Archivar',
    )!;
    boton.click();
    http
      .expectOne((r) => r.url === '/api/mensajes/42/archivar')
      .flush({ id: 42, estado: 'archivado' });
    await recargar();

    const pend = http.expectOne(
      (r) => r.url === '/api/mensajes' && r.params.get('estado') === 'pendiente',
    );
    pend.flush({ items: [] });
    await recargar();
    expect(TestBed.inject(PendientesPanel).total()).toBe(0);
  });

  it('muestra un error cuando no se puede guardar la respuesta', async () => {
    const el = harness.routeNativeElement!;
    el.querySelector<HTMLButtonElement>('table button')!.click();
    await recargar();
    const textarea = harness.routeNativeElement!.querySelector<HTMLTextAreaElement>('#respuesta-texto')!;
    textarea.value = 'Respuesta de prueba';
    textarea.dispatchEvent(new Event('input'));
    harness.detectChanges();
    harness.routeNativeElement!.querySelector<HTMLButtonElement>('.admin-form-respuesta button')!.click();
    http
      .expectOne((r) => r.url === '/api/mensajes/42/responder')
      .flush({}, { status: 500, statusText: 'Server Error' });
    await recargar();
    expect(harness.routeNativeElement!.textContent).toContain('No se pudo guardar la respuesta');
  });

  it('no envía una respuesta vacía', async () => {
    const el = harness.routeNativeElement!;
    el.querySelector<HTMLButtonElement>('table button')!.click();
    await recargar();
    harness.routeNativeElement!.querySelector<HTMLButtonElement>('.admin-form-respuesta button')!.click();
    await recargar();
    expect(harness.routeNativeElement!.textContent).toContain('Escribe una respuesta antes de enviarla');
  });
});

describe('AdminMensajes — bandeja temática por ?tipo=', () => {
  let http: HttpTestingController;

  async function recargar(harness: RouterTestingHarness): Promise<void> {
    harness.detectChanges();
    await new Promise((r) => setTimeout(r, 0));
    harness.detectChanges();
  }

  async function montar(url: string): Promise<RouterTestingHarness> {
    const harness = await RouterTestingHarness.create(url);
    return harness;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'admin/mensajes', component: AdminMensajes }]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('?tipo=tramite preselecciona el filtro y titula «Mesa de partes»', async () => {
    const harness = await montar('/admin/mensajes?tipo=tramite');
    const req = http.expectOne((r) => r.url === '/api/mensajes');
    expect(req.request.params.get('tipo')).toBe('tramite');
    req.flush({ items: [{ ...mensaje, tipo: 'tramite', asunto: 'Constancia' }] });
    await recargar(harness);

    const el = harness.routeNativeElement!;
    expect(el.querySelector('.admin-encabezado__titulo')!.textContent).toBe(
      'Mesa de partes',
    );
    expect(el.querySelector<HTMLSelectElement>('#filtro-tipo')!.value).toBe('tramite');
  });

  it('?tipo=reclamo titula «Reclamaciones» y ?tipo=accesibilidad «Reportes de accesibilidad»', async () => {
    let harness = await montar('/admin/mensajes?tipo=reclamo');
    http.expectOne((r) => r.url === '/api/mensajes').flush({ items: [] });
    await recargar(harness);
    expect(
      harness.routeNativeElement!.querySelector('.admin-encabezado__titulo')!.textContent,
    ).toBe('Reclamaciones');

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'admin/mensajes', component: AdminMensajes }]),
      ],
    });
    http = TestBed.inject(HttpTestingController);

    harness = await montar('/admin/mensajes?tipo=accesibilidad');
    const req = http.expectOne((r) => r.url === '/api/mensajes');
    expect(req.request.params.get('tipo')).toBe('accesibilidad');
    req.flush({ items: [] });
    await recargar(harness);
    expect(
      harness.routeNativeElement!.querySelector('.admin-encabezado__titulo')!.textContent,
    ).toBe('Reportes de accesibilidad');
  });

  it('cambiar el filtro a mano actualiza el título y la URL', async () => {
    const harness = await montar('/admin/mensajes?tipo=tramite');
    http.expectOne((r) => r.url === '/api/mensajes').flush({ items: [] });
    await recargar(harness);

    const el = harness.routeNativeElement!;
    const select = el.querySelector<HTMLSelectElement>('#filtro-tipo')!;
    select.value = 'contacto';
    select.dispatchEvent(new Event('change'));
    const req = http.expectOne(
      (r) => r.url === '/api/mensajes' && r.params.get('tipo') === 'contacto',
    );
    req.flush({ items: [] });
    await recargar(harness);

    expect(el.querySelector('.admin-encabezado__titulo')!.textContent).toBe(
      'Otras solicitudes',
    );
    expect(TestBed.inject(Router).url).toContain('tipo=contacto');
  });
});
