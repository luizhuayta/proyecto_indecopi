// @vitest-environment jsdom
import '@angular/compiler';
import { getTestBed, TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FormsModule } from '@angular/forms';
import { FormularioContacto } from './formulario-contacto';

getTestBed().initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

const BLOQUE = {
  submitLabel: 'Enviar mensaje',
  fields: { name: true, message: true },
};

describe('FormularioContacto', () => {
  let fixture: ComponentFixture<FormularioContacto>;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [FormularioContacto, FormsModule],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(FormularioContacto);
    fixture.componentInstance.bloque = BLOQUE;
    fixture.componentInstance.csrf = 'token-de-prueba';
  });

  afterEach(() => {
    http.verify();
    fixture.destroy();
    TestBed.resetTestingModule();
  });

  it('el botón de envío muestra el texto del bloque, no la interpolación', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const boton = fixture.nativeElement.querySelector('button[type=submit]');
    expect(boton).toBeTruthy();
    expect(boton.textContent.trim()).toBe('Enviar mensaje');
  });

  it('respeta los campos que el editor oculta', async () => {
    fixture.componentInstance.bloque = {
      submitLabel: 'Enviar mensaje',
      fields: {
        name: false,
        email: true,
        phone: false,
        subject: false,
        message: true,
      },
    };
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('#contacto-nombre')).toBeNull();
    expect(el.querySelector('#contacto-telefono')).toBeNull();
    expect(el.querySelector('#contacto-asunto')).toBeNull();
    expect(el.querySelector('#contacto-correo')).toBeTruthy();
    expect(el.querySelector('#contacto-mensaje')).toBeTruthy();
  });

  it('valida por campo al enviar: marca, enfoca el primero y no envía', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    el.querySelector<HTMLButtonElement>('button[type=submit]')!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.querySelector('#contacto-correo')!.getAttribute('aria-invalid')).toBe('true');
    expect(el.querySelector('#contacto-mensaje')!.getAttribute('aria-invalid')).toBe('true');
    expect(el.textContent).toContain('Escribe tu correo');
    expect(el.textContent).toContain('Escribe tu mensaje');
    expect(document.activeElement?.id).toBe('contacto-correo');
  });

  it('muestra documento y consentimiento cuando el bloque los activa', async () => {
    fixture.componentInstance.bloque = {
      submitLabel: 'Enviar',
      fields: { name: true, email: true, message: true, documento: true, consentimiento: true },
      consentText: 'Autorizo el tratamiento de mis datos personales.',
    };
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

    expect(el.querySelector('#contacto-documento')).toBeTruthy();
    expect(el.querySelector('#contacto-consentimiento')).toBeTruthy();
    expect(el.textContent).toContain('Autorizo el tratamiento de mis datos personales.');
  });

  it('oculta documento y consentimiento cuando el bloque no los activa', async () => {
    fixture.componentInstance.bloque = {
      submitLabel: 'Enviar',
      fields: { name: true, email: true, message: true },
    };
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

    expect(el.querySelector('#contacto-documento')).toBeNull();
    expect(el.querySelector('#contacto-consentimiento')).toBeNull();
  });

  it('exige el consentimiento cuando la casilla está visible', async () => {
    fixture.componentInstance.bloque = {
      submitLabel: 'Enviar',
      fields: { name: true, email: true, message: true, consentimiento: true },
    };
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

    const correo = el.querySelector<HTMLInputElement>('#contacto-correo')!;
    correo.value = 'ana@b.test';
    correo.dispatchEvent(new Event('input'));
    const mensaje = el.querySelector<HTMLTextAreaElement>('#contacto-mensaje')!;
    mensaje.value = 'Hola';
    mensaje.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    el.querySelector<HTMLButtonElement>('button[type=submit]')!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    http.expectNone((r) => r.url === '/api/mensajes');
    expect(el.querySelector('#contacto-consentimiento')!.getAttribute('aria-invalid')).toBe('true');
    expect(el.textContent).toContain('autorización');
  });

  it('envía tipo, documento y consentimiento cuando el formulario es de trámite', async () => {
    fixture.componentInstance.bloque = {
      tipo: 'tramite',
      submitLabel: 'Enviar',
      fields: { name: true, email: true, message: true, documento: true, consentimiento: true },
    };
    fixture.componentInstance.nombre = 'Ana';
    fixture.componentInstance.documento = '12345678';
    fixture.componentInstance.correo = 'ana@b.test';
    fixture.componentInstance.mensaje = 'Solicito constancia.';
    fixture.componentInstance.consentimiento = true;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

    el.querySelector<HTMLButtonElement>('button[type=submit]')!.click();
    const req = http.expectOne((r) => r.url === '/api/mensajes');
    expect(req.request.body.tipo).toBe('tramite');
    expect(req.request.body.documento).toBe('12345678');
    expect(req.request.body.consentimiento).toBe(true);
    req.flush({ ticket: 'MSG-1' });
    await fixture.whenStable();
  });

  it('sin tipo en el bloque envía «contacto»', async () => {
    fixture.componentInstance.nombre = 'Ana';
    fixture.componentInstance.correo = 'ana@b.test';
    fixture.componentInstance.mensaje = 'Hola';
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

    el.querySelector<HTMLButtonElement>('button[type=submit]')!.click();
    const req = http.expectOne((r) => r.url === '/api/mensajes');
    expect(req.request.body.tipo).toBe('contacto');
    req.flush({ ticket: 'MSG-2' });
    await fixture.whenStable();
  });

  it('el rechazo del servidor con campo se muestra junto al campo', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    const correo = el.querySelector<HTMLInputElement>('#contacto-correo')!;
    correo.value = 'ana@b.test';
    correo.dispatchEvent(new Event('input'));
    const mensaje = el.querySelector<HTMLTextAreaElement>('#contacto-mensaje')!;
    mensaje.value = 'Hola';
    mensaje.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    fixture.detectChanges();

    el.querySelector<HTMLButtonElement>('button[type=submit]')!.click();
    const req = http.expectOne((r) => r.url === '/api/mensajes');
    req.flush(
      { error: 'El correo no es válido.', message: 'El correo no es válido.', campo: 'correo' },
      { status: 400, statusText: 'Bad Request' }
    );
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.querySelector('#contacto-correo')!.getAttribute('aria-invalid')).toBe('true');
    expect(el.textContent).toContain('El correo no es válido.');
    expect(document.activeElement?.id).toBe('contacto-correo');
  });
});
