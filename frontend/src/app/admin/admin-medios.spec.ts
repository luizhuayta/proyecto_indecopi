// @vitest-environment jsdom
import '@angular/compiler';
import { getTestBed, TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminMedios } from './admin-medios';
import { MediosService } from '../core/medios.service';
import { CmsContentService } from '../cms/cms-content.service';
import { CmsApiService } from '../cms/cms-api.service';
import { CmsHistoryService } from '../cms/cms-history.service';
import { API_BASE } from '../cms/cms.models';

getTestBed().initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

describe('AdminMedios', () => {
  let fixture: ComponentFixture<AdminMedios>;
  let component: AdminMedios;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AdminMedios],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        CmsApiService,
        CmsHistoryService,
        CmsContentService,
        MediosService,
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AdminMedios);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    http.verify();
    fixture.destroy();
    TestBed.resetTestingModule();
  });

  it('la biblioteca lista los medios del servidor', async () => {
    fixture.detectChanges();
    const req = http.expectOne(`${API_BASE}/medios`);
    expect(req.request.method).toBe('GET');
    req.flush({
      items: [
        { id: 1, nombre_original: 'foto.png', url: '/media/foto.png', mime: 'image/png', tamano: 2048 },
        { id: 2, nombre_original: 'logo.png', url: '/media/logo.png', mime: 'image/png', tamano: 1024 },
      ],
    });
    await vi.waitFor(() => expect(component.medios.items().length).toBe(2));
    fixture.detectChanges();

    const botones = fixture.nativeElement.querySelectorAll('.miniatura');
    expect(botones.length).toBe(2);
    expect(botones[0].getAttribute('aria-label')).toContain('foto.png');
  });

  it('subir un medio lo agrega a la lista', async () => {
    fixture.detectChanges();
    http.expectOne(`${API_BASE}/medios`).flush({ items: [] });
    await fixture.whenStable();

    const file = new File(['contenido'], 'nueva.png', { type: 'image/png' });
    component.elegirArchivo(file);
    const promesa = component.subir();
    const post = http.expectOne((r) => r.url === `${API_BASE}/medios` && r.method === 'POST');
    expect(post.request.body instanceof FormData).toBe(true);
    post.flush({
      id: 3,
      nombre_original: 'nueva.png',
      url: '/media/nueva.png',
      mime: 'image/png',
      tamano: 9,
    });
    await promesa;
    fixture.detectChanges();

    expect(component.medios.items().length).toBe(1);
    expect(component.medios.items()[0].id).toBe(3);
  });

  it('eliminar un medio pide confirmacion antes de llamar al servidor', async () => {
    fixture.detectChanges();
    http
      .expectOne(`${API_BASE}/medios`)
      .flush({
        items: [
          { id: 1, nombre_original: 'foto.png', url: '/media/foto.png', mime: 'image/png', tamano: 2048 },
        ],
      });
    await fixture.whenStable();
    fixture.detectChanges();

    component.abrir(1);
    fixture.detectChanges();

    // Sin confirmación: no se llama al servidor.
    const cancelado = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await component.eliminar();
    http.expectNone((r) => r.method === 'DELETE');
    expect(component.medios.items().length).toBe(1);
    cancelado.mockRestore();

    // Con confirmación: se elimina.
    const aceptado = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const promesa = component.eliminar();
    const del = http.expectOne(
      (r) => r.url === `${API_BASE}/medios/1` && r.method === 'DELETE',
    );
    del.flush({ ok: true });
    await promesa;
    aceptado.mockRestore();

    expect(component.medios.items().length).toBe(0);
  });
});
