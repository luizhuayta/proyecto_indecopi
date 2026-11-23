// @vitest-environment jsdom
import '@angular/compiler';
import { getTestBed, TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CmsApiService } from './cms-api.service';
import { API_BASE, LOCALE } from './cms.models';

getTestBed().initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

describe('CmsApiService', () => {
  let service: CmsApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), CmsApiService],
    });
    service = TestBed.inject(CmsApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('guarda la pagina enviando la version', async () => {
    const promesa = service.guardarPagina('inicio', { blocks: [] }, 3);
    const req = http.expectOne(
      (r) => r.url === `${API_BASE}/paginas/inicio` && r.method === 'PUT'
    );
    expect(req.request.body).toEqual({ contenido: { blocks: [] }, version: 3 });
    expect(req.request.params.get('locale')).toBe(LOCALE);
    req.flush({ contenido: { blocks: [] }, version: 4, actualizado_en: null });
    const res = await promesa;
    expect(res.version).toBe(4);
  });

  it('la publicacion envia la version', async () => {
    const promesa = service.publicarPagina('inicio', 5);
    const req = http.expectOne(
      (r) => r.url === `${API_BASE}/paginas/inicio/publicar` && r.method === 'POST'
    );
    expect(req.request.body).toEqual({ version: 5 });
    req.flush({ contenido: { blocks: [] }, version: 6 });
    const res = await promesa;
    expect(res.version).toBe(6);
  });

  it('convierte un documento vacío del API en un objeto editable', async () => {
    const promesa = service.getApariencia();
    const req = http.expectOne(`${API_BASE}/configuracion/apariencia`);
    req.flush({ contenido: [], version: 2, actualizado_en: null });
    const res = await promesa;
    expect(res.contenido).toEqual({});
  });

  it('el conflicto 409 se propaga', async () => {
    const promesa = service.guardarPagina('inicio', { blocks: [] }, 1);
    const req = http.expectOne(
      (r) => r.url === `${API_BASE}/paginas/inicio` && r.method === 'PUT'
    );
    req.flush(
      { message: 'Conflicto de versión', version: 9 },
      { status: 409, statusText: 'Conflict' }
    );
    await expect(promesa).rejects.toMatchObject({
      status: 409,
      error: { message: 'Conflicto de versión', version: 9 },
    });
  });
});
