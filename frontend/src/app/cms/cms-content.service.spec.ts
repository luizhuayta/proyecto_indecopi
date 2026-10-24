// @vitest-environment jsdom
import '@angular/compiler';
import { getTestBed, TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CmsContentService } from './cms-content.service';
import { CmsApiService } from './cms-api.service';
import { CmsHistoryService } from './cms-history.service';
import { API_BASE } from './cms.models';

getTestBed().initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

describe('CmsContentService', () => {
  let service: CmsContentService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        CmsApiService,
        CmsHistoryService,
        CmsContentService,
      ],
    });
    service = TestBed.inject(CmsContentService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  function sembrarPaginaInicio(): void {
    service.useSlug('inicio');
    service.pages.set({ inicio: { titulo: 'Original' } });
    service.versions.set({ inicio: 1 });
    service.dirty.set(false);
    service.conflict.set('');
  }

  it('el estado local no cambia si el servidor rechaza el guardado', async () => {
    sembrarPaginaInicio();
    service.set('titulo', 'Nuevo título');
    expect(service.dirty()).toBe(true);
    const contenidoAntes = service.pages()['inicio'];

    const promesa = service.save();
    const req = http.expectOne(
      (r) => r.url === `${API_BASE}/paginas/inicio` && r.method === 'PUT'
    );
    req.flush({ message: 'Error interno' }, { status: 500, statusText: 'Server Error' });

    await expect(promesa).rejects.toMatchObject({ status: 500 });
    expect(service.dirty()).toBe(true);
    expect(service.pages()['inicio']).toEqual(contenidoAntes);
    expect(service.versions()['inicio']).toBe(1);
  });

  it('el conflicto deja el contenido intacto', async () => {
    sembrarPaginaInicio();
    service.set('titulo', 'Nuevo título');
    const contenidoAntes = service.pages()['inicio'];

    const promesa = service.save();
    const req = http.expectOne(
      (r) => r.url === `${API_BASE}/paginas/inicio` && r.method === 'PUT'
    );
    req.flush(
      { message: 'Conflicto de versión', version: 9 },
      { status: 409, statusText: 'Conflict' }
    );

    await expect(promesa).rejects.toMatchObject({ status: 409 });
    expect(service.pages()['inicio']).toEqual(contenidoAntes);
    expect(service.conflict()).toContain('Conflicto');
    expect(service.dirty()).toBe(true);
  });

  it('el contenido se aplica cuando el servidor confirma', async () => {
    sembrarPaginaInicio();
    service.set('titulo', 'Nuevo título');
    expect(service.dirty()).toBe(true);

    const promesa = service.save();
    const req = http.expectOne(
      (r) => r.url === `${API_BASE}/paginas/inicio` && r.method === 'PUT'
    );
    expect(req.request.body).toEqual({ contenido: { titulo: 'Nuevo título' }, version: 1 });
    req.flush({ contenido: { titulo: 'Nuevo título' }, version: 2, actualizado_en: null });

    await promesa;
    expect(service.dirty()).toBe(false);
    expect(service.pages()['inicio']['titulo']).toBe('Nuevo título');
    expect(service.versions()['inicio']).toBe(2);
  });
});
