// @vitest-environment jsdom
import '@angular/compiler';
import { getTestBed, TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SitioPublicoService } from './sitio-publico.service';

getTestBed().initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

describe('SitioPublicoService — enlaces del marco', () => {
  let http: HttpTestingController;
  let sitio: SitioPublicoService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    sitio = TestBed.inject(SitioPublicoService);
  });
  afterEach(() => TestBed.resetTestingModule());

  async function publicar(apariencia: Record<string, unknown>): Promise<void> {
    const carga = sitio.cargar();
    http.expectOne('/api/publico/sitio?locale=es').flush({ apariencia });
    await carga;
  }

  it('expone accesos seguros con icono de la lista blanca', async () => {
    await publicar({ accesos: [
      { nombre: 'Aula virtual', url: 'https://aula.test', icono: 'plataforma' },
      { nombre: 'Malicioso', url: 'javascript:alert(1)' },
      { nombre: 'Sin icono válido', url: '/biblioteca', icono: 'bi-book' },
    ] });
    expect(sitio.accesos()).toEqual([
      { nombre: 'Aula virtual', url: 'https://aula.test', icono: 'plataforma' },
      { nombre: 'Sin icono válido', url: '/biblioteca', icono: '' },
    ]);
  });

  it('limita la cabecera a dos botones y normaliza el estilo', async () => {
    await publicar({ botones_cabecera: [
      { texto: 'Admisión', url: '/admision', estilo: 'principal' },
      { texto: 'Transparencia', url: '/transparencia', estilo: 'contorno' },
      { texto: 'Sobra', url: '/x' },
    ] });
    expect(sitio.botonesCabecera()).toEqual([
      { texto: 'Admisión', url: '/admision', estilo: 'principal' },
      { texto: 'Transparencia', url: '/transparencia', estilo: 'contorno' },
    ]);
  });

  it('arma el enlace de WhatsApp solo con un número válido', async () => {
    await publicar({ whatsapp: '51938146082' });
    expect(sitio.whatsapp()).toBe('https://wa.me/51938146082');
    await publicar({ whatsapp: 'abc' });
    expect(sitio.whatsapp()).toBe('');
  });
});
