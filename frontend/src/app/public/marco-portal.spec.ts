// @vitest-environment jsdom
import '@angular/compiler';
import { Component } from '@angular/core';
import { getTestBed, TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MarcoPortal } from './marco-portal';
import { SitioPublicoService } from '../core/sitio-publico.service';

getTestBed().initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

@Component({ standalone: true, imports: [MarcoPortal], template: `<app-marco-portal><main>Contenido</main></app-marco-portal>` })
class Anfitrion {}

describe('MarcoPortal — diseño institucional', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => TestBed.resetTestingModule());

  async function montar(apariencia: Record<string, unknown>): Promise<HTMLElement> {
    const sitio = TestBed.inject(SitioPublicoService);
    const carga = sitio.cargar();
    http.expectOne('/api/publico/sitio?locale=es').flush({ apariencia, identidad: { nombre: 'Instituto de prueba' } });
    await carga;
    const fixture = TestBed.createComponent(Anfitrion);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('muestra la franja de accesos solo cuando hay accesos', async () => {
    const el = await montar({ accesos: [{ nombre: 'Aula virtual', url: 'https://aula.test', icono: 'plataforma' }] });
    const enlace = el.querySelector<HTMLAnchorElement>('nav.franja a.franja__enlace');
    expect(enlace?.textContent?.trim()).toBe('Aula virtual');
    expect(enlace?.getAttribute('href')).toBe('https://aula.test');
    expect(el.querySelector('nav.franja')?.getAttribute('aria-label')).toBe('Accesos rápidos');
  });

  it('sin accesos no pinta una franja vacía', async () => {
    const el = await montar({});
    expect(el.querySelector('.franja')).toBeNull();
  });

  it('pinta los botones de cabecera con su estilo', async () => {
    const el = await montar({ botones_cabecera: [
      { texto: 'Admisión', url: '/admision', estilo: 'principal' },
      { texto: 'Transparencia', url: '/transparencia', estilo: 'contorno' },
    ] });
    const botones = el.querySelectorAll('.cabecera__botones a');
    expect(botones).toHaveLength(2);
    expect(botones[0].classList).toContain('boton-cabecera--principal');
    expect(botones[1].classList).toContain('boton-cabecera--contorno');
  });

  it('muestra el botón flotante de WhatsApp con nombre accesible', async () => {
    const el = await montar({ whatsapp: '51938146082' });
    const wa = el.querySelector<HTMLAnchorElement>('a.whatsapp-flotante');
    expect(wa?.href).toBe('https://wa.me/51938146082');
    expect(wa?.getAttribute('aria-label')).toBe('Escribir por WhatsApp a Instituto de prueba');
    expect(wa?.getAttribute('rel')).toBe('noopener noreferrer');
  });
});
