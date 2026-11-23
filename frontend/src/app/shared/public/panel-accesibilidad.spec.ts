// @vitest-environment jsdom
import '@angular/compiler';
import { getTestBed, TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PanelAccesibilidad } from './panel-accesibilidad';
import { SitioPublicoService } from '../../core/sitio-publico.service';

getTestBed().initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

// El jsdom de vitest no expone localStorage (el global de Node queda
// undefined): se siembra uno en memoria para probar la persistencia.
const memoria = new Map<string, string>();
const almacen = {
  getItem: (k: string) => (memoria.has(k) ? memoria.get(k)! : null),
  setItem: (k: string, v: string) => void memoria.set(k, String(v)),
  removeItem: (k: string) => void memoria.delete(k),
  clear: () => memoria.clear(),
};
Object.defineProperty(globalThis, 'localStorage', {
  value: almacen,
  configurable: true,
  writable: true,
});

describe('PanelAccesibilidad', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    TestBed.resetTestingModule();
  });

  function montar() {
    const f = TestBed.createComponent(PanelAccesibilidad);
    f.detectChanges();
    return f;
  }

  it('abre un diálogo nombrado desde un botón con estado', () => {
    const f = montar();
    const boton = f.nativeElement.querySelector('button.pa-boton') as HTMLButtonElement;
    expect(boton.getAttribute('aria-label')).toBe('Opciones de accesibilidad');
    boton.click();
    f.detectChanges();
    expect(boton.getAttribute('aria-expanded')).toBe('true');
    expect(
      f.nativeElement.querySelector('[role="dialog"]')?.getAttribute('aria-label'),
    ).toBe('Opciones de accesibilidad');
  });

  it('activar un ajuste pone la clase en la raíz y lo recuerda', () => {
    const f = montar();
    f.componentInstance.alternar('texto-grande');
    f.detectChanges();
    expect(document.documentElement.classList).toContain('pa-texto-grande');
    expect(JSON.parse(localStorage.getItem('pa-ajustes')!)).toEqual(['texto-grande']);
  });

  it('restaura los ajustes guardados al cargar y los limpia con Restablecer', () => {
    localStorage.setItem('pa-ajustes', JSON.stringify(['alto-contraste', 'no-existe']));
    const f = montar();
    expect(document.documentElement.classList).toContain('pa-alto-contraste');
    expect(document.documentElement.classList).not.toContain('pa-no-existe');
    f.componentInstance.restablecer();
    f.detectChanges();
    expect(document.documentElement.className).toBe('');
  });

  it('Escape cierra el panel', () => {
    const f = montar();
    f.componentInstance.abierto.set(true);
    f.detectChanges();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    f.detectChanges();
    expect(f.componentInstance.abierto()).toBe(false);
  });

  describe('reportar un problema', () => {
    let http: HttpTestingController;
    let fixture: ComponentFixture<PanelAccesibilidad>;

    const tick = () => new Promise((r) => setTimeout(r, 0));

    beforeEach(async () => {
      http = TestBed.inject(HttpTestingController);
      fixture = TestBed.createComponent(PanelAccesibilidad);
      fixture.detectChanges();
      await fixture.whenStable();
      // En el sitio real el marco ya cargó los datos publicados (y el token
      // de sesión) antes de que la persona abra el panel.
      const sitio = TestBed.inject(SitioPublicoService);
      const carga = sitio.cargar();
      http.expectOne((r) => r.url === '/api/publico/sitio').flush({ csrf: 'token-prueba' });
      await carga;
      fixture.componentInstance.abierto.set(true);
      fixture.detectChanges();
    });

    afterEach(() => fixture.destroy());

    function abrirReporte(): HTMLElement {
      const el: HTMLElement = fixture.nativeElement;
      const boton = el.querySelector<HTMLButtonElement>('.pa-reportar');
      expect(boton, 'debe existir el botón de reporte dentro del diálogo').toBeTruthy();
      boton!.click();
      fixture.detectChanges();
      return el;
    }

    it('el botón abre un mini formulario dentro del diálogo y enfoca la descripción', async () => {
      const el = abrirReporte();
      await tick();
      const desc = el.querySelector<HTMLTextAreaElement>('#pa-reporte-desc');
      const correo = el.querySelector<HTMLInputElement>('#pa-reporte-correo');
      expect(desc).toBeTruthy();
      expect(correo).toBeTruthy();
      expect(el.querySelector('[role="dialog"]')!.contains(desc)).toBe(true);
      expect(document.activeElement).toBe(desc);
    });

    it('sin descripción marca el campo, muestra el aviso y no envía nada', async () => {
      const el = abrirReporte();
      await tick();
      el.querySelector<HTMLButtonElement>('.pa-reporte__enviar')!.click();
      await fixture.whenStable();
      fixture.detectChanges();
      const desc = el.querySelector<HTMLTextAreaElement>('#pa-reporte-desc')!;
      expect(desc.getAttribute('aria-invalid')).toBe('true');
      expect(el.textContent).toContain('Describe el problema');
      http.expectNone((r) => r.url === '/api/mensajes');
    });

    it('un correo mal formado se marca y no se envía', async () => {
      const el = abrirReporte();
      await tick();
      const desc = el.querySelector<HTMLTextAreaElement>('#pa-reporte-desc')!;
      desc.value = 'El menú no responde al teclado';
      desc.dispatchEvent(new Event('input'));
      const correo = el.querySelector<HTMLInputElement>('#pa-reporte-correo')!;
      correo.value = 'no-es-correo';
      correo.dispatchEvent(new Event('input'));
      await fixture.whenStable();

      el.querySelector<HTMLButtonElement>('.pa-reporte__enviar')!.click();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(correo.getAttribute('aria-invalid')).toBe('true');
      http.expectNone((r) => r.url === '/api/mensajes');
    });

    it('envía un mensaje tipo accesibilidad con la ruta actual y muestra el ticket', async () => {
      const el = abrirReporte();
      await tick();
      const desc = el.querySelector<HTMLTextAreaElement>('#pa-reporte-desc')!;
      desc.value = 'El contraste del menú es insuficiente';
      desc.dispatchEvent(new Event('input'));
      await fixture.whenStable();

      el.querySelector<HTMLButtonElement>('.pa-reporte__enviar')!.click();
      const req = http.expectOne((r) => r.url === '/api/mensajes');
      expect(req.request.method).toBe('POST');
      expect(req.request.body.tipo).toBe('accesibilidad');
      expect(req.request.body.mensaje).toBe('El contraste del menú es insuficiente');
      expect(req.request.body.ruta).toBe('/');
      expect(req.request.headers.get('X-CSRF-Token')).toBe('token-prueba');
      req.flush({ ticket: 'MSG-777' });
      await fixture.whenStable();
      fixture.detectChanges();

      const aviso = el.querySelector('[role="status"]');
      expect(aviso).toBeTruthy();
      expect(aviso!.textContent).toContain('MSG-777');
      // Tras el éxito el formulario ya no está: no se envía dos veces.
      expect(el.querySelector('#pa-reporte-desc')).toBeNull();
    });

    it('un fallo del servidor muestra un error y permite reintentar', async () => {
      const el = abrirReporte();
      await tick();
      const desc = el.querySelector<HTMLTextAreaElement>('#pa-reporte-desc')!;
      desc.value = 'Los puntos del carrusel no tienen nombre';
      desc.dispatchEvent(new Event('input'));
      await fixture.whenStable();

      el.querySelector<HTMLButtonElement>('.pa-reporte__enviar')!.click();
      http
        .expectOne((r) => r.url === '/api/mensajes')
        .flush({ message: 'Error interno' }, { status: 500, statusText: 'Error' });
      await fixture.whenStable();
      fixture.detectChanges();

      expect(el.querySelector('[role="alert"]')).toBeTruthy();
      // El formulario sigue a la vista con el texto escrito.
      const denuevo = el.querySelector<HTMLTextAreaElement>('#pa-reporte-desc')!;
      expect(denuevo.value).toBe('Los puntos del carrusel no tienen nombre');
    });
  });
});
