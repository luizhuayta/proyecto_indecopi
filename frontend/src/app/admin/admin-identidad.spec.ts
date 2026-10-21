// @vitest-environment jsdom
import '@angular/compiler';
import { getTestBed, TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AdminIdentidad } from './admin-identidad';
import { CmsApiService } from '../cms/cms-api.service';
import { API_BASE } from '../cms/cms.models';

getTestBed().initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

const IDENTIDAD = {
  nombre: 'Instituto Test',
  ruc: '20123456789',
  direccion: 'Av. Siempre Viva 123',
  telefono: '01 555 5555',
  correo: 'contacto@test.pe',
  ciudad: 'Lima',
};

describe('AdminIdentidad', () => {
  let fixture: ComponentFixture<AdminIdentidad>;
  let component: AdminIdentidad;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AdminIdentidad],
      providers: [provideHttpClient(), provideHttpClientTesting(), CmsApiService],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AdminIdentidad);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    http.verify();
    fixture.destroy();
    TestBed.resetTestingModule();
  });

  it('la identidad se carga con los datos del servidor', async () => {
    fixture.detectChanges();
    const req = http.expectOne(`${API_BASE}/identidad`);
    expect(req.request.method).toBe('GET');
    req.flush(IDENTIDAD);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.campos().nombre).toBe('Instituto Test');
    expect(component.campos().ruc).toBe('20123456789');
    const nombreInput = fixture.nativeElement.querySelector('#identidad-nombre');
    expect(nombreInput.value).toBe('Instituto Test');
  });

  it('guardar la identidad envia solo los campos editados', async () => {
    fixture.detectChanges();
    http.expectOne(`${API_BASE}/identidad`).flush(IDENTIDAD);
    await fixture.whenStable();
    fixture.detectChanges();

    component.setCampo('nombre', 'Instituto Nuevo');
    fixture.detectChanges();

    const promesa = component.guardar(false);
    const put = http.expectOne((r) => r.url === `${API_BASE}/identidad` && r.method === 'PUT');
    expect(put.request.body).toEqual({ nombre: 'Instituto Nuevo' });
    put.flush({ nombre: 'Instituto Nuevo' });
    await promesa;

    expect(component.status()).toBe('Identidad guardada.');
  });
});
