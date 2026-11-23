// @vitest-environment jsdom
import '@angular/compiler';
import { getTestBed, TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Component } from '@angular/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AdminShell, normalizarBusqueda, tituloDeSeccion } from './admin-shell';
import { AuthService } from '../cms/auth.service';
import { CmsContentService } from '../cms/cms-content.service';
import { PendientesPanel } from './pendientes-panel';

getTestBed().initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

// El jsdom de vitest no expone localStorage (el global de Node queda
// undefined): se siembra uno en memoria para probar las preferencias.
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

describe('tituloDeSeccion', () => {
  it('nombra la sección del panel según la ruta', () => {
    expect(tituloDeSeccion('/admin/paginas')).toBe('Páginas');
    expect(tituloDeSeccion('/admin/identidad')).toBe('Identidad');
    expect(tituloDeSeccion('/admin/apariencia')).toBe('Apariencia');
    expect(tituloDeSeccion('/admin/medios')).toBe('Medios');
    expect(tituloDeSeccion('/admin/mensajes')).toBe('Mensajes');
    expect(tituloDeSeccion('/admin/usuarios')).toBe('Usuarios');
  });

  it('en el editor manda el título de la página, y sin ruta conocida dice Panel', () => {
    expect(tituloDeSeccion('/admin/editor/oferta')).toBe('');
    expect(tituloDeSeccion('/admin/otra-cosa')).toBe('Panel');
  });

  it('la bandeja toma el nombre del tipo que llega en la URL', () => {
    expect(tituloDeSeccion('/admin/mensajes?tipo=tramite')).toBe('Mesa de partes');
    expect(tituloDeSeccion('/admin/mensajes?tipo=reclamo')).toBe('Reclamaciones');
    expect(tituloDeSeccion('/admin/mensajes?tipo=accesibilidad')).toBe(
      'Reportes de accesibilidad',
    );
    expect(tituloDeSeccion('/admin/mensajes?tipo=contacto')).toBe('Otras solicitudes');
    expect(tituloDeSeccion('/admin/mensajes?tipo=rarísimo')).toBe('Mensajes');
  });
});

@Component({ selector: 'app-login-prueba', template: 'login' })
class LoginPrueba {}

describe('AdminShell — marco del panel', () => {
  let http: HttpTestingController;
  let router: Router;
  let harness: RouterTestingHarness;

  async function estable(): Promise<void> {
    harness.detectChanges();
    await new Promise((r) => setTimeout(r, 0));
    harness.detectChanges();
  }

  /**
   * Monta el shell en la ruta indicada (las rutas de las secciones apuntan al
   * mismo shell, así la prueba ve la barra en el contexto que le interesa) y
   * devuelve el elemento raíz del shell y el fixture para repintar.
   */
  async function montarShell(
    ruta = '/admin'
  ): Promise<{ el: HTMLElement; fixture: { detectChanges(): void } }> {
    harness = await RouterTestingHarness.create(ruta);
    // El shell pide los datos públicos del sitio; la respuesta vacía basta.
    http.match((r) => r.method === 'GET').forEach((req) => req.flush({}));
    await estable();
    return {
      el: harness.routeNativeElement!,
      fixture: { detectChanges: () => harness.detectChanges() },
    };
  }

  beforeEach(() => {
    // Las preferencias del panel viven en localStorage y se leen al montar.
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'admin', component: AdminShell },
          { path: 'admin/medios', component: AdminShell },
          { path: 'admin/mensajes', component: AdminShell },
          { path: 'admin/noticias', component: AdminShell },
          { path: 'admin/paginas', component: AdminShell },
          { path: 'admin/usuarios', component: AdminShell },
          { path: 'admin/editor/:slug', component: AdminShell },
          { path: 'admin/login', component: LoginPrueba },
        ]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('el avatar abre un menú y no cierra la sesión por sí solo', async () => {
    const { el } = await montarShell();
    const boton = el.querySelector<HTMLButtonElement>('.admin-usuario')!;
    el.querySelector<HTMLElement>('.admin-avatar')!.click();
    await estable();

    expect(boton.getAttribute('aria-expanded')).toBe('true');
    const menu = el.querySelector('[role="menu"]');
    expect(menu).toBeTruthy();
    expect(menu!.textContent).toContain('Mi cuenta');
    expect(menu!.textContent).toContain('Cerrar sesión');
  });

  it('cerrar sesión sale desde el menú y vuelve al login', async () => {
    const { el } = await montarShell();
    el.querySelector<HTMLElement>('.admin-avatar')!.click();
    await estable();
    const menu = el.querySelector('[role="menu"]')!;
    const cerrar = [...menu.querySelectorAll<HTMLButtonElement>('button')].find(
      (b) => b.textContent!.trim() === 'Cerrar sesión'
    )!;
    cerrar.click();
    const req = http.expectOne((r) => r.url === '/api/auth/logout');
    expect(req.request.method).toBe('POST');
    req.flush({ ok: true });
    await estable();
    expect(router.url).toContain('/admin/login');
  });

  it('aplica la paleta guardada (rojo por defecto)', async () => {
    const { el } = await montarShell();
    expect(el.querySelector('.admin-shell')!.getAttribute('data-paleta')).toBe('rojo');
  });

  it('el riel lateral se pliega y lo recuerda', async () => {
    const { el, fixture } = await montarShell();
    el.querySelector<HTMLButtonElement>('.admin-plegar')!.click();
    fixture.detectChanges();
    expect(el.querySelector('.admin-shell')!.classList).toContain('admin-shell--plegado');
    expect(localStorage.getItem('admin-nav-colapsado')).toBe('1');
  });

  it('el modo oscuro se activa desde la barra y se recuerda', async () => {
    const { el, fixture } = await montarShell();
    const boton = el.querySelector<HTMLButtonElement>('.admin-modo')!;
    expect(boton.getAttribute('aria-label')).toBe('Activar modo oscuro');
    boton.click();
    fixture.detectChanges();
    expect(el.querySelector('.admin-shell')!.getAttribute('data-modo')).toBe('oscuro');
    expect(boton.getAttribute('aria-pressed')).toBe('true');
    expect(localStorage.getItem('admin-modo')).toBe('oscuro');
  });

  it('la guía del módulo muestra los pasos de la sección actual', async () => {
    const { el, fixture } = await montarShell('/admin/medios');
    el.querySelector<HTMLButtonElement>('.admin-guia-boton')!.click();
    fixture.detectChanges();
    const guia = el.querySelector('.admin-guia')!;
    expect(guia.textContent).toContain('Biblioteca de medios');
    expect(guia.querySelectorAll('ol li')).toHaveLength(3);
  });

  it('la barra superior dice la sección y el rol de la sesión', async () => {
    const auth = TestBed.inject(AuthService);
    auth.ready.set(true);
    auth.username.set('beto');
    auth.role.set('editor');
    const { el } = await montarShell('/admin/medios');
    expect(el.querySelector('.admin-cabecera__antetitulo')!.textContent).toContain(
      'Biblioteca de medios'
    );
    expect(el.querySelector('.admin-usuario__rol')!.textContent).toContain('Editor');
  });

  it('a la secretaria le salen el dashboard, la gestión y su cuenta, sin portal ni configuración', async () => {
    const auth = TestBed.inject(AuthService);
    auth.ready.set(true);
    auth.username.set('secretaria');
    auth.role.set('secretaria');

    const { el } = await montarShell('/admin/medios');
    const enlaces = [...el.querySelectorAll<HTMLAnchorElement>('.admin-nav nav a')].map(
      (a) => a.textContent!.trim(),
    );
    expect(enlaces).toEqual([
      'Dashboard',
      'Noticias',
      'Mesa de partes',
      'Reclamaciones',
      'Reportes de accesibilidad',
      'Otras solicitudes',
      'Medios',
    ]);
    const pie = [...el.querySelectorAll<HTMLAnchorElement>('.admin-nav__pie a')].map((a) =>
      a.textContent!.trim(),
    );
    expect(pie).toEqual(['Mi cuenta', 'Ver sitio']);
    // Sin «Portal público» ni «Configuración», ni el atajo a Páginas.
    expect(el.querySelector('.admin-nav')!.textContent).not.toContain('Portal público');
    expect(el.querySelector('.admin-nav')!.textContent).not.toContain('Configuración');
    expect(el.querySelector('.admin-herramientas')!.textContent).not.toContain('Páginas');
    expect(el.querySelector('.admin-usuario__rol')!.textContent).toContain('Secretaría');
  });

  it('al administrador le sale el menú completo por grupos', async () => {
    const auth = TestBed.inject(AuthService);
    auth.ready.set(true);
    auth.username.set('admin');
    auth.role.set('admin');

    const { el } = await montarShell('/admin/medios');
    const grupos = [...el.querySelectorAll('.admin-nav__grupo')].map((g) =>
      g.textContent!.trim(),
    );
    expect(grupos).toEqual(['Panel', 'Gestión', 'Configuración']);
    const enlaces = [...el.querySelectorAll<HTMLAnchorElement>('.admin-nav nav a')].map(
      (a) => a.textContent!.trim(),
    );
    expect(enlaces).toEqual([
      'Dashboard',
      'Noticias',
      'Mesa de partes',
      'Reclamaciones',
      'Reportes de accesibilidad',
      'Otras solicitudes',
      'Medios',
      'Páginas',
      'Identidad',
      'Apariencia',
      'Usuarios',
    ]);
  });

  it('«Portal público» lista las páginas del menú y cada una abre su editor', async () => {
    const auth = TestBed.inject(AuthService);
    auth.ready.set(true);
    auth.username.set('admin');
    auth.role.set('admin');

    const { el, fixture } = await montarShell('/admin/medios');
    const cms = TestBed.inject(CmsContentService);
    cms.pageList.set([
      { slug: 'inicio', titulo: 'Inicio', mostrar_en_menu: true, orden_menu: 0 },
      { slug: 'interna', titulo: 'Borrador interno', mostrar_en_menu: false, orden_menu: 1 },
      { slug: 'contacto', titulo: 'Contacto', mostrar_en_menu: true, orden_menu: 2 },
      { slug: 'admision', titulo: 'Admisión', mostrar_en_menu: true, orden_menu: 1 },
    ]);
    fixture.detectChanges();

    const grupos = [...el.querySelectorAll('.admin-nav__grupo')].map((g) =>
      g.textContent!.trim(),
    );
    expect(grupos).toContain('Portal público');
    const editor = [...el.querySelectorAll<HTMLAnchorElement>('.admin-nav nav a')]
      .filter((a) => a.getAttribute('href')!.startsWith('/admin/editor/'))
      .map((a) => ({
        texto: a.textContent!.trim(),
        href: a.getAttribute('href'),
      }));
    // Solo las páginas con mostrar_en_menu, ordenadas por orden_menu.
    expect(editor).toEqual([
      { texto: 'Inicio', href: '/admin/editor/inicio' },
      { texto: 'Admisión', href: '/admin/editor/admision' },
      { texto: 'Contacto', href: '/admin/editor/contacto' },
    ]);
  });

  it('las bandejas del menú apuntan a /admin/mensajes con su ?tipo=', async () => {
    const auth = TestBed.inject(AuthService);
    auth.ready.set(true);
    auth.username.set('admin');
    auth.role.set('admin');

    const { el } = await montarShell('/admin/medios');
    const hrefs = [...el.querySelectorAll<HTMLAnchorElement>('.admin-nav nav a')].map(
      (a) => a.getAttribute('href'),
    );
    expect(hrefs).toContain('/admin/mensajes?tipo=tramite');
    expect(hrefs).toContain('/admin/mensajes?tipo=reclamo');
    expect(hrefs).toContain('/admin/mensajes?tipo=accesibilidad');
    expect(hrefs).toContain('/admin/mensajes?tipo=contacto');
  });

  it('cada bandeja lleva una píldora con sus pendientes y su aria-label', async () => {
    const auth = TestBed.inject(AuthService);
    auth.ready.set(true);
    auth.username.set('admin');
    auth.role.set('admin');

    const { el, fixture } = await montarShell('/admin/medios');
    TestBed.inject(PendientesPanel).porTipo.set({ tramite: 3, reclamo: 1 });
    fixture.detectChanges();

    const enlace = (tipo: string) =>
      [...el.querySelectorAll<HTMLAnchorElement>('.admin-nav nav a')].find(
        (a) => a.getAttribute('href') === `/admin/mensajes?tipo=${tipo}`,
      )!;

    const mesa = enlace('tramite');
    expect(mesa.querySelector('.admin-nav__badge')!.textContent!.trim()).toBe('3');
    expect(mesa.getAttribute('aria-label')).toBe('Mesa de partes: 3 pendientes');

    const reclamos = enlace('reclamo');
    expect(reclamos.querySelector('.admin-nav__badge')!.textContent!.trim()).toBe('1');
    expect(reclamos.getAttribute('aria-label')).toBe('Reclamaciones: 1 pendiente');

    // Sin pendientes no hay píldora ni aria-label extra.
    const contacto = enlace('contacto');
    expect(contacto.querySelector('.admin-nav__badge')).toBeNull();
    expect(contacto.getAttribute('aria-label')).toBeNull();
  });

  it('los rótulos de grupo son botones que pliegan y recuerdan el estado', async () => {
    const auth = TestBed.inject(AuthService);
    auth.ready.set(true);
    auth.username.set('admin');
    auth.role.set('admin');

    const { el, fixture } = await montarShell('/admin/medios');
    const botonGestion = () =>
      [...el.querySelectorAll<HTMLButtonElement>('.admin-nav__grupo-boton')].find(
        (b) => b.textContent!.includes('Gestión'),
      )!;

    expect(botonGestion().getAttribute('aria-expanded')).toBe('true');
    botonGestion().click();
    fixture.detectChanges();

    expect(botonGestion().getAttribute('aria-expanded')).toBe('false');
    const enlaces = [...el.querySelectorAll<HTMLAnchorElement>('.admin-nav nav a')].map(
      (a) => a.textContent!.trim(),
    );
    // El grupo entero desaparece del DOM (fuera del orden de tabulación).
    expect(enlaces).not.toContain('Noticias');
    expect(enlaces).not.toContain('Mesa de partes');
    // Los demás grupos siguen abiertos.
    expect(enlaces).toContain('Dashboard');
    expect(enlaces).toContain('Páginas');
    expect(localStorage.getItem('admin-grupos-cerrados')).toContain('gestion');

    botonGestion().click();
    fixture.detectChanges();
    expect(botonGestion().getAttribute('aria-expanded')).toBe('true');
    expect(
      [...el.querySelectorAll<HTMLAnchorElement>('.admin-nav nav a')].map((a) =>
        a.textContent!.trim(),
      ),
    ).toContain('Noticias');
  });

  it('un grupo guardado como plegado nace plegado', async () => {
    const auth = TestBed.inject(AuthService);
    auth.ready.set(true);
    auth.username.set('admin');
    auth.role.set('admin');
    localStorage.setItem('admin-grupos-cerrados', 'gestion,configuracion');

    const { el } = await montarShell('/admin/medios');
    const enlaces = [...el.querySelectorAll<HTMLAnchorElement>('.admin-nav nav a')].map(
      (a) => a.textContent!.trim(),
    );
    expect(enlaces).toEqual(['Dashboard']);
  });

  it('el buscador filtra las entradas sin distinguir mayúsculas ni acentos', async () => {
    const auth = TestBed.inject(AuthService);
    auth.ready.set(true);
    auth.username.set('admin');
    auth.role.set('admin');

    const { el, fixture } = await montarShell('/admin/medios');
    const cms = TestBed.inject(CmsContentService);
    cms.pageList.set([
      { slug: 'admision', titulo: 'Admisión', mostrar_en_menu: true, orden_menu: 0 },
    ]);

    const input = el.querySelector<HTMLInputElement>('.admin-nav__busqueda')!;
    input.value = 'ADMISION';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const enlaces = [...el.querySelectorAll<HTMLAnchorElement>('.admin-nav nav a')].map(
      (a) => a.textContent!.trim(),
    );
    expect(el.querySelector('.admin-nav__grupo')!.textContent).toContain('Resultados');
    expect(enlaces).toEqual(['Admisión']);
    expect(enlaces[0]).not.toBe('Noticias');
    // La entrada encontrada sigue apuntando a su editor.
    expect(
      el.querySelector<HTMLAnchorElement>('.admin-nav nav a')!.getAttribute('href'),
    ).toBe('/admin/editor/admision');
  });

  it('«Mi cuenta» también aparece en la búsqueda aunque viva en el pie', async () => {
    const auth = TestBed.inject(AuthService);
    auth.ready.set(true);
    auth.username.set('admin');
    auth.role.set('admin');

    const { el, fixture } = await montarShell('/admin/medios');
    const input = el.querySelector<HTMLInputElement>('.admin-nav__busqueda')!;
    input.value = 'cuenta';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const enlaces = [...el.querySelectorAll<HTMLAnchorElement>('.admin-nav nav a')].map(
      (a) => a.textContent!.trim(),
    );
    expect(enlaces).toEqual(['Mi cuenta']);
  });

  it('la búsqueda solo propone lo que el rol puede abrir', async () => {
    const auth = TestBed.inject(AuthService);
    auth.ready.set(true);
    auth.username.set('secretaria');
    auth.role.set('secretaria');

    const { el, fixture } = await montarShell('/admin/medios');
    const input = el.querySelector<HTMLInputElement>('.admin-nav__busqueda')!;
    input.value = 'usuarios';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(el.querySelector('.admin-nav__vacio')!.textContent).toContain('Sin resultados');

    input.value = 'noti';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    const enlaces = [...el.querySelectorAll<HTMLAnchorElement>('.admin-nav nav a')].map(
      (a) => a.textContent!.trim(),
    );
    expect(enlaces).toEqual(['Noticias']);
  });

  it('sin coincidencias muestra «Sin resultados» y ESC o el × limpian el filtro', async () => {
    const auth = TestBed.inject(AuthService);
    auth.ready.set(true);
    auth.username.set('admin');
    auth.role.set('admin');

    const { el, fixture } = await montarShell('/admin/medios');
    const input = el.querySelector<HTMLInputElement>('.admin-nav__busqueda')!;
    input.value = 'zzzz';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(el.querySelector('.admin-nav__vacio')!.textContent).toContain(
      'Sin resultados para «zzzz»',
    );

    // El × limpia; después el ESC también (con el campo ya vacío no falla).
    el.querySelector<HTMLButtonElement>('.admin-nav__limpiar')!.click();
    fixture.detectChanges();
    expect(el.querySelector('.admin-nav__vacio')).toBeNull();
    expect(
      [...el.querySelectorAll<HTMLAnchorElement>('.admin-nav nav a')].length,
    ).toBeGreaterThan(1);

    input.value = 'usu';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(input.value).toBe('');
    expect(el.querySelector('.admin-nav__limpiar')).toBeNull();
  });

  it('la cabecera muestra una píldora con el total de pendientes hacia el tablero', async () => {
    const auth = TestBed.inject(AuthService);
    auth.ready.set(true);
    auth.username.set('admin');
    auth.role.set('admin');

    const { el, fixture } = await montarShell('/admin/medios');
    // Sin pendientes la píldora no sale.
    expect(el.querySelector('.admin-pendientes')).toBeNull();

    TestBed.inject(PendientesPanel).porTipo.set({ tramite: 2, reclamo: 1 });
    fixture.detectChanges();
    const pildora = el.querySelector<HTMLAnchorElement>('.admin-pendientes')!;
    expect(pildora.textContent).toContain('3 pendientes');
    expect(pildora.getAttribute('href')).toBe('/admin');
    expect(pildora.getAttribute('aria-label')).toBe(
      '3 solicitudes pendientes: ir al panel',
    );
  });

  it('la acción contextual cambia con la sección y respeta el rol', async () => {
    const auth = TestBed.inject(AuthService);
    auth.ready.set(true);
    auth.username.set('admin');
    auth.role.set('admin');

    const { el } = await montarShell('/admin/noticias');
    const accion = el.querySelector<HTMLAnchorElement>('.admin-cabecera__accion')!;
    expect(accion.textContent).toContain('Nueva noticia');
    expect(accion.getAttribute('href')).toBe('/admin/noticias?nueva=1');
  });

  it('en Páginas la acción es «Nueva página» solo para el administrador', async () => {
    const auth = TestBed.inject(AuthService);
    auth.ready.set(true);
    auth.username.set('admin');
    auth.role.set('admin');

    const { el } = await montarShell('/admin/paginas');
    const accion = el.querySelector<HTMLAnchorElement>('.admin-cabecera__accion')!;
    expect(accion.textContent).toContain('Nueva página');
    expect(accion.getAttribute('href')).toBe('/admin/paginas?nueva=1');
  });

  it('la acción de Páginas no sale para el editor y en Medios es «Subir imagen»', async () => {
    const auth = TestBed.inject(AuthService);
    auth.ready.set(true);
    auth.username.set('beto');
    auth.role.set('editor');

    const { el } = await montarShell('/admin/paginas');
    // El editor edita páginas pero el alta es del administrador.
    expect(el.querySelector('.admin-cabecera__accion')).toBeNull();
  });

  it('en Medios la acción contextual es «Subir imagen»', async () => {
    const auth = TestBed.inject(AuthService);
    auth.ready.set(true);
    auth.username.set('admin');
    auth.role.set('admin');

    const { el } = await montarShell('/admin/medios');
    const accion = el.querySelector<HTMLAnchorElement>('.admin-cabecera__accion')!;
    expect(accion.textContent).toContain('Subir imagen');
    expect(accion.getAttribute('href')).toBe('/admin/medios?subir=1');
  });

  it('los atajos de la barra ocultan la sección actual', async () => {
    const auth = TestBed.inject(AuthService);
    auth.ready.set(true);
    auth.username.set('admin');
    auth.role.set('admin');

    const { el } = await montarShell('/admin/medios');
    const herramientas = el.querySelector('.admin-herramientas__acciones')!;
    // En Medios no tiene sentido el atajo a Medios.
    expect(herramientas.textContent).not.toContain('Medios');
    expect(herramientas.textContent).toContain('Páginas');
  });

  it('en el editor la barra ofrece «Ver página» con la URL pública', async () => {
    const auth = TestBed.inject(AuthService);
    auth.ready.set(true);
    auth.username.set('admin');
    auth.role.set('admin');

    const { el, fixture } = await montarShell('/admin/editor/inicio');
    const cms = TestBed.inject(CmsContentService);
    cms.pageList.set([
      { slug: 'inicio', titulo: 'Inicio', ruta: '/', mostrar_en_menu: true },
    ]);
    cms.currentSlug.set('inicio');
    fixture.detectChanges();

    const verPagina = [
      ...el.querySelectorAll<HTMLAnchorElement>('.admin-herramienta'),
    ].find((a) => a.textContent!.includes('Ver página'))!;
    expect(verPagina.getAttribute('href')).toBe('/');
    expect(verPagina.getAttribute('target')).toBe('_blank');
  });
});
