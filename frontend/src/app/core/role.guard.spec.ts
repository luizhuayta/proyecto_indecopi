// @vitest-environment jsdom
import '@angular/compiler';
import { getTestBed, TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import {
  ActivatedRouteSnapshot,
  provideRouter,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { adminGuard, seccionGuard } from './role.guard';
import { AdminRole, AuthService } from '../cms/auth.service';

getTestBed().initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

describe('guards de rol del panel', () => {
  let auth: AuthService;
  let router: Router;

  /** Simula una sesión ya resuelta con el rol indicado (sin llamar al API). */
  function conRol(rol: AdminRole): void {
    auth.ready.set(true);
    auth.username.set(rol === '' ? null : 'usuaria-prueba');
    auth.role.set(rol);
  }

  async function activa(
    guard: (
      route: ActivatedRouteSnapshot,
      state: RouterStateSnapshot,
    ) => Promise<boolean | UrlTree>,
  ): Promise<boolean | string> {
    const resultado = await TestBed.runInInjectionContext(() =>
      guard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );
    return resultado instanceof UrlTree ? router.serializeUrl(resultado) : resultado;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    auth = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  describe('AuthService.puede y primeraSeccion', () => {
    it('la secretaria solo entra a noticias, medios, mensajes y cuenta', () => {
      conRol('secretaria');
      for (const seccion of ['noticias', 'medios', 'mensajes', 'cuenta'] as const) {
        expect(auth.puede(seccion), seccion).toBe(true);
      }
      for (const seccion of ['paginas', 'identidad', 'apariencia', 'usuarios'] as const) {
        expect(auth.puede(seccion), seccion).toBe(false);
      }
      expect(auth.primeraSeccion()).toBe('/admin');
      expect(auth.isSecretaria()).toBe(true);
      expect(auth.isAdmin()).toBe(false);
    });

    it('el editor conserva páginas y su portada es el tablero /admin', () => {
      conRol('editor');
      expect(auth.puede('paginas')).toBe(true);
      expect(auth.puede('identidad')).toBe(false);
      expect(auth.primeraSeccion()).toBe('/admin');
      expect(auth.isSecretaria()).toBe(false);
    });

    it('el administrador entra a todo y su portada es el tablero /admin', () => {
      conRol('admin');
      expect(auth.puede('usuarios')).toBe(true);
      expect(auth.puede('apariencia')).toBe(true);
      expect(auth.primeraSeccion()).toBe('/admin');
      expect(auth.rotuloRol()).toBe('Administrador');
    });

    it('rotuloRol etiqueta cada rol en español', () => {
      conRol('secretaria');
      expect(auth.rotuloRol()).toBe('Secretaría');
      conRol('editor');
      expect(auth.rotuloRol()).toBe('Editor');
    });
  });

  describe('seccionGuard', () => {
    it('páginas deja pasar a admin y editor pero no a secretaria', async () => {
      const guard = seccionGuard('paginas');
      conRol('admin');
      expect(await activa(guard)).toBe(true);
      conRol('editor');
      expect(await activa(guard)).toBe(true);
      conRol('secretaria');
      expect(await activa(guard)).toBe('/admin');
    });

    it('sin sesión manda al login', async () => {
      const guard = seccionGuard('paginas');
      conRol('');
      expect(await activa(guard)).toBe('/admin/login');
    });
  });

  describe('adminGuard', () => {
    it('solo deja pasar al administrador y redirige a la primera sección del rol', async () => {
      conRol('admin');
      expect(await activa(adminGuard)).toBe(true);
      conRol('editor');
      expect(await activa(adminGuard)).toBe('/admin');
      conRol('secretaria');
      expect(await activa(adminGuard)).toBe('/admin');
    });
  });
});
