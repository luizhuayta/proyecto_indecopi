// @vitest-environment jsdom
import '@angular/compiler';
import { getTestBed, TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AdminMensajes } from './admin-mensajes';
import { MensajeItem } from '../cms/cms-api.service';

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

  it('lista los mensajes y muestra sus datos de contacto', () => {
    const el: HTMLElement = harness.routeNativeElement!;
    expect(el.textContent).toContain('Consulta de admisión');
    expect(el.textContent).toContain('pendiente');
    expect(el.textContent).toContain('Ana Prueba');
    expect(el.textContent).toContain('contacto');
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

  it('filtra por tipo y estado al aplicar filtros', async () => {
    const el = harness.routeNativeElement!;
    el.querySelector<HTMLSelectElement>('#filtro-tipo')!.value = 'reclamo';
    el.querySelector<HTMLSelectElement>('#filtro-tipo')!.dispatchEvent(new Event('change'));
    el.querySelector<HTMLButtonElement>('form button')!.click();
    const req = http.expectOne((r) => r.url === '/api/mensajes' && r.params.get('tipo') === 'reclamo');
    req.flush({ items: [] });
    await recargar();
    expect(harness.routeNativeElement!.textContent).toContain('No hay mensajes con estos filtros');
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
      notificado: true,
      correo: 'a@b.test',
    });
    await recargar();
    expect(harness.routeNativeElement!.textContent).toContain('Respuesta enviada');
    expect(harness.routeNativeElement!.textContent).toContain('respondido');
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
