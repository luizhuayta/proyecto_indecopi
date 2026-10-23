// @vitest-environment jsdom
import '@angular/compiler';
import { getTestBed, TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AdminUsuarios } from './admin-usuarios';
import { AuthService } from '../cms/auth.service';
import { UsuarioItem } from '../cms/cms-api.service';

getTestBed().initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

const ana: UsuarioItem = {
  id: 1,
  usuario: 'ana',
  rol: 'admin',
  activo: true,
  creado_en: '2026-01-15T09:00:00+00:00',
};

const beto: UsuarioItem = {
  id: 2,
  usuario: 'beto',
  rol: 'editor',
  activo: true,
  creado_en: '2026-02-20T09:00:00+00:00',
};

describe('AdminUsuarios', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;

  async function recargar(): Promise<void> {
    harness.detectChanges();
    await new Promise((r) => setTimeout(r, 0));
    harness.detectChanges();
  }

  function escribir(selector: string, valor: string): void {
    const campo = harness.routeNativeElement!.querySelector<HTMLInputElement>(selector)!;
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
    harness.detectChanges();
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'admin/usuarios', component: AdminUsuarios }]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(AuthService).username.set('ana');
    harness = await RouterTestingHarness.create('/admin/usuarios');
    http.expectOne('/api/auth/usuarios').flush({ items: [ana, beto] });
    await recargar();
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('lista los usuarios con su rol y estado', () => {
    const el: HTMLElement = harness.routeNativeElement!;
    expect(el.textContent).toContain('ana');
    expect(el.textContent).toContain('beto');
    expect(el.textContent).toContain('Activa');
    expect(el.textContent).toContain('15/01/2026');
    expect(el.querySelector<HTMLSelectElement>('#rol-1')!.value).toBe('admin');
    expect(el.querySelector<HTMLSelectElement>('#rol-2')!.value).toBe('editor');
  });

  it('crea un usuario y envía el POST con sus datos', async () => {
    escribir('#nuevo-usuario', 'carla');
    escribir('#nuevo-contrasena', 'clave-segura');
    const rol = harness.routeNativeElement!.querySelector<HTMLSelectElement>('#nuevo-rol')!;
    rol.value = 'admin';
    rol.dispatchEvent(new Event('change'));
    harness.detectChanges();

    harness.routeNativeElement!.querySelector<HTMLFormElement>('.admin-form-alta')!
      .dispatchEvent(new Event('submit'));

    const req = http.expectOne((r) => r.url === '/api/auth/usuarios' && r.method === 'POST');
    expect(req.request.body).toEqual({
      usuario: 'carla',
      contrasena: 'clave-segura',
      rol: 'admin',
    });
    req.flush({ ok: true, item: { id: 3, usuario: 'carla', rol: 'admin', activo: true } });
    await recargar();

    expect(harness.routeNativeElement!.textContent).toContain('carla');
    expect(harness.routeNativeElement!.textContent).toContain('Usuario carla creado');
  });

  it('cambiar el rol de otro usuario llama al PATCH', async () => {
    const select = harness.routeNativeElement!.querySelector<HTMLSelectElement>('#rol-2')!;
    select.value = 'admin';
    select.dispatchEvent(new Event('change'));

    const req = http.expectOne((r) => r.url === '/api/auth/usuarios/2' && r.method === 'PATCH');
    expect(req.request.body).toEqual({ rol: 'admin' });
    req.flush({ ok: true, item: { ...beto, rol: 'admin' } });
    await recargar();

    expect(harness.routeNativeElement!.querySelector<HTMLSelectElement>('#rol-2')!.value).toBe(
      'admin',
    );
  });

  it('no permite desactivar la cuenta propia ni llama al API', async () => {
    const boton = harness.routeNativeElement!.querySelector<HTMLButtonElement>('#activar-1')!;
    expect(boton.disabled).toBe(true);

    boton.click();
    await recargar();

    http.expectNone((r) => r.method === 'PATCH');
    expect(harness.routeNativeElement!.textContent).toContain('Activa');
  });

  it('desactivar otra cuenta envía activo en el PATCH', async () => {
    harness.routeNativeElement!.querySelector<HTMLButtonElement>('#activar-2')!.click();

    const req = http.expectOne((r) => r.url === '/api/auth/usuarios/2' && r.method === 'PATCH');
    expect(req.request.body).toEqual({ activo: false });
    req.flush({ ok: true, item: { ...beto, activo: false } });
    await recargar();

    expect(harness.routeNativeElement!.textContent).toContain('Desactivada');
  });
});
