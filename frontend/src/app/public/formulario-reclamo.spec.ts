// @vitest-environment jsdom
import '@angular/compiler';
import { getTestBed, TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FormsModule } from '@angular/forms';
import { FormularioReclamo } from './formulario-reclamo';

getTestBed().initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

describe('FormularioReclamo', () => {
  let fixture: ComponentFixture<FormularioReclamo>;
  let http: HttpTestingController;
  let el: HTMLElement;

  async function estable(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function llenarValido(): Promise<void> {
    const correo = el.querySelector<HTMLInputElement>('#reclamo-correo')!;
    correo.value = 'ana@b.test';
    correo.dispatchEvent(new Event('input'));
    const detalle = el.querySelector<HTMLTextAreaElement>('#reclamo-detalle')!;
    detalle.value = 'El servicio no se prestó como se acordó.';
    detalle.dispatchEvent(new Event('input'));
    const checkbox = el.querySelector<HTMLInputElement>('input[name="consentimiento"]')!;
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change'));
    await estable();
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [FormularioReclamo, FormsModule],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(FormularioReclamo);
    fixture.componentInstance.csrf = 'token-de-prueba';
    el = fixture.nativeElement;
    await estable();
  });

  afterEach(() => {
    http.verify();
    fixture.destroy();
    TestBed.resetTestingModule();
  });

  it('valida por campo al enviar vacío: marca, enfoca el primero y no envía', async () => {
    el.querySelector<HTMLButtonElement>('button[type=submit]')!.click();
    await estable();

    expect(el.querySelector('#reclamo-correo')!.getAttribute('aria-invalid')).toBe('true');
    expect(el.querySelector('#reclamo-detalle')!.getAttribute('aria-invalid')).toBe('true');
    expect(el.querySelector('input[name="consentimiento"]')!.getAttribute('aria-invalid')).toBe('true');
    expect(el.textContent).toContain('Escribe tu correo');
    expect(el.textContent).toContain('Escribe el detalle');
    expect(el.textContent).toContain('Marca la autorización');
    expect(document.activeElement?.id).toBe('reclamo-correo');
  });

  it('solo falta el consentimiento: el único error es el de la autorización', async () => {
    const correo = el.querySelector<HTMLInputElement>('#reclamo-correo')!;
    correo.value = 'ana@b.test';
    correo.dispatchEvent(new Event('input'));
    const detalle = el.querySelector<HTMLTextAreaElement>('#reclamo-detalle')!;
    detalle.value = 'Detalle suficiente.';
    detalle.dispatchEvent(new Event('input'));
    await estable();

    el.querySelector<HTMLButtonElement>('button[type=submit]')!.click();
    await estable();

    expect(el.querySelector('#reclamo-correo')!.getAttribute('aria-invalid')).toBeNull();
    expect(el.querySelector('#reclamo-detalle')!.getAttribute('aria-invalid')).toBeNull();
    expect(el.querySelector('input[name="consentimiento"]')!.getAttribute('aria-invalid')).toBe('true');
    expect(el.textContent).toContain('Marca la autorización');
  });

  it('registra el reclamo y muestra el ticket', async () => {
    await llenarValido();
    el.querySelector<HTMLButtonElement>('button[type=submit]')!.click();
    const req = http.expectOne((r) => r.url === '/api/mensajes');
    expect(req.request.body.tipo).toBe('reclamo');
    expect(req.request.body.consentimiento).toBe(true);
    req.flush({ ticket: 'MSG-PRUEBA' });
    await estable();

    expect(el.textContent).toContain('MSG-PRUEBA');
    expect(el.textContent).toContain('Registramos tu reclamo');
  });
});
