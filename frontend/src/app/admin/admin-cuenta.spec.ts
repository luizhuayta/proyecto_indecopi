// @vitest-environment jsdom
import '@angular/compiler';
import { getTestBed, TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AdminCuenta } from './admin-cuenta';
import { AuthService } from '../cms/auth.service';

@Component({ template: '' })
class LoginFalso {}

getTestBed().initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

describe('AdminCuenta', () => {
  let http: HttpTestingController;
  let auth: AuthService;
  let router: Router;
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
        provideRouter([
          { path: 'admin/cuenta', component: AdminCuenta },
          { path: 'admin/login', component: LoginFalso },
        ]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
    auth.username.set('ana');
    auth.role.set('admin');
    auth.csrfToken.set('tok');
    harness = await RouterTestingHarness.create('/admin/cuenta');
    await recargar();
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('muestra el usuario en sesión', () => {
    const el: HTMLElement = harness.routeNativeElement!;
    expect(el.textContent).toContain('ana');
  });

  it('rechaza contraseñas cortas o que no coinciden sin llamar al API', async () => {
    escribir('#actual', 'ClaveVieja1');
    escribir('#nueva', 'corta');
    escribir('#confirmacion', 'corta');
    harness.routeNativeElement!.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    await recargar();
    const el: HTMLElement = harness.routeNativeElement!;
    expect(el.textContent).toContain('al menos 8 caracteres');
    http.expectNone('/api/auth/password');
  });

  it('cambia la contraseña, limpia la sesión y vuelve al login', async () => {
    escribir('#actual', 'ClaveVieja1');
    escribir('#nueva', 'ClaveNueva1');
    escribir('#confirmacion', 'ClaveNueva1');
    harness.routeNativeElement!.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    const req = http.expectOne('/api/auth/password');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ contrasena_actual: 'ClaveVieja1', contrasena: 'ClaveNueva1' });
    req.flush({ ok: true });
    await recargar();
    expect(router.url).toBe('/admin/login');
    expect(auth.username()).toBeNull();
    expect(auth.csrfToken()).toBe('');
  });

  it('muestra el mensaje del servidor cuando la contraseña actual no es correcta', async () => {
    escribir('#actual', 'MalMalMal');
    escribir('#nueva', 'ClaveNueva1');
    escribir('#confirmacion', 'ClaveNueva1');
    harness.routeNativeElement!.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    const req = http.expectOne('/api/auth/password');
    req.flush(
      { message: 'La contraseña actual no es correcta.' },
      { status: 401, statusText: 'Unauthorized' }
    );
    await recargar();
    const el: HTMLElement = harness.routeNativeElement!;
    expect(el.textContent).toContain('La contraseña actual no es correcta.');
    expect(router.url).toBe('/admin/cuenta');
  });
});
