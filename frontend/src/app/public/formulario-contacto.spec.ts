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
  type: 'contactForm',
  props: { submitLabel: 'Enviar mensaje', fields: { name: true, message: true } },
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
});
