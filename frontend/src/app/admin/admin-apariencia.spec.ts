// @vitest-environment jsdom
import '@angular/compiler';
import { getTestBed, TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AdminApariencia } from './admin-apariencia';
import { CmsApiService } from '../cms/cms-api.service';
import { API_BASE } from '../cms/cms.models';

getTestBed().initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

const APARIENCIA = {
  contenido: { colores: { primario: '#123A6D' } },
  version: 3,
  actualizado_en: null,
  tiene_borrador: false,
};

describe('AdminApariencia', () => {
  let fixture: ComponentFixture<AdminApariencia>;
  let component: AdminApariencia;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AdminApariencia],
      providers: [provideHttpClient(), provideHttpClientTesting(), CmsApiService],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AdminApariencia);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    http.verify();
    fixture.destroy();
    TestBed.resetTestingModule();
  });

  async function cargar(): Promise<void> {
    fixture.detectChanges();
    http.expectOne(`${API_BASE}/configuracion/apariencia`).flush(APARIENCIA);
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('al enviar el formulario se guarda la apariencia en el servidor', async () => {
    await cargar();

    const formulario = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    formulario.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();
    fixture.detectChanges();

    const put = http.expectOne(
      (r) => r.url === `${API_BASE}/configuracion/apariencia` && r.method === 'PUT',
    );
    expect(put.request.body).toEqual({ contenido: APARIENCIA.contenido, version: 3 });
    put.flush({ contenido: APARIENCIA.contenido, version: 4 });
    await fixture.whenStable();

    const publicar = http.expectOne(
      (r) => r.url === `${API_BASE}/configuracion/apariencia/publicar` && r.method === 'POST',
    );
    publicar.flush({ contenido: APARIENCIA.contenido, version: 5 });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.status()).toBe('Publicado en el sitio.');
  });

  it('al guardar tambien publica los cambios en el sitio', async () => {
    await cargar();
    const enCurso = component.guardar();

    const guardar = http.expectOne(`${API_BASE}/configuracion/apariencia`);
    expect(guardar.request.method).toBe('PUT');
    guardar.flush({ contenido: guardar.request.body['contenido'], version: 4 });
    await fixture.whenStable();

    const publicar = http.expectOne(`${API_BASE}/configuracion/apariencia/publicar`);
    expect(publicar.request.method).toBe('POST');
    expect(publicar.request.body['version']).toBe(4);
    publicar.flush({ contenido: {}, version: 5 });
    await enCurso;
    fixture.detectChanges();

    expect(component.status()).toBe('Publicado en el sitio.');
  });
});
