import {
  Component,
  HostListener,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  NavigationEnd,
  Params,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { NgStyle } from '@angular/common';
import { Subscription } from 'rxjs';
import { AuthService } from '../cms/auth.service';
import { CmsContentService } from '../cms/cms-content.service';
import { CmsEditorService } from '../cms/cms-editor.service';
import { buscarMarcadores } from '../cms/cms.models';
import { SitioPublicoService } from '../core/sitio-publico.service';
import type { NombreIcono } from '../cms/iconos';
import { Icono } from '../shared/public/icono';
import { BANDEJAS_MENSAJE } from './admin-mensajes';
import { DialogoService } from './dialogo.service';
import { guiaDe } from './guias-admin';
import { PendientesPanel } from './pendientes-panel';
import { PreferenciasPanel } from './preferencias-panel';

/**
 * Marco del panel: riel lateral oscuro con las secciones (buscador, grupos
 * plegables y píldoras de pendientes), cabecera con la sección actual, la
 * acción contextual, la píldora de pendientes, el modo claro/oscuro y el
 * menú de cuenta, barra de herramientas con la guía del módulo y el punto
 * de montaje de las rutas hijas. Guardar y Publicar siguen siendo acciones
 * distintas y separadas.
 */
/**
 * Nombre de la sección del panel según la ruta. Vacío cuando el título lo da
 * la página abierta en el editor.
 */
export function tituloDeSeccion(url: string): string {
  const [path, query] = url.split('?');
  if (path.startsWith('/admin/editor/')) {
    return '';
  }
  // La bandeja cambia de nombre según el tipo que lleva en la URL: las
  // entradas del menú «Gestión» son la misma pantalla con otro rótulo.
  if (path === '/admin/mensajes') {
    const tipo = new URLSearchParams(query ?? '').get('tipo') ?? '';
    return BANDEJAS_MENSAJE[tipo]?.titulo ?? 'Mensajes';
  }
  const secciones: Record<string, string> = {
    '/admin/paginas': 'Páginas',
    '/admin/identidad': 'Identidad',
    '/admin/apariencia': 'Apariencia',
    '/admin/medios': 'Medios',
    '/admin/noticias': 'Noticias',
    '/admin/usuarios': 'Usuarios',
    '/admin/cuenta': 'Mi cuenta',
    '/admin': 'Panel',
  };
  return secciones[path] ?? 'Panel';
}

/**
 * Icono del menú «Portal público» según la página conocida; el resto usa el
 * genérico de páginas. Es una convención visual, no un dato: que una página
 * nueva salga con el icono genérico nunca es un fallo.
 */
export function iconoDePagina(slug: string): NombreIcono {
  const mapa: Record<string, NombreIcono> = {
    inicio: 'inicio',
    nosotros: 'escuela',
    admision: 'graduacion',
    servicios: 'premio',
    transparencia: 'escudo',
    'mesa-de-partes': 'documento',
    'libro-de-reclamaciones': 'balanza',
    contacto: 'correo',
  };
  return mapa[slug] ?? 'paginas';
}

/** Entrada del menú lateral: una sección del panel o una bandeja temática. */
interface EntradaNav {
  id: string;
  titulo: string;
  icono: NombreIcono;
  /** Destino en comandos de routerLink. */
  comandos: string[];
  /** Bandejas temáticas: mismo path, se distinguen por `?tipo=`. */
  query?: Params;
  /** «/admin» lleva match exacto para no quedar activa en cada ruta hija. */
  exacta?: boolean;
  /** Tipo de mensaje de la bandeja: activo y píldora dependen de él. */
  bandeja?: string;
}

/** Grupo del menú lateral; los plegables recuerdan su estado en el navegador. */
interface GrupoNav {
  id: string;
  titulo: string;
  plegable: boolean;
  entradas: EntradaNav[];
}

/** Fila del `<nav>`: rótulo de grupo, entrada o aviso de «sin resultados». */
interface FilaNav {
  clave: string;
  grupo?: GrupoNav;
  entrada?: EntradaNav;
  aviso?: string;
}

/** Acción principal contextual de la sección actual, junto a «Sesión activa». */
interface AccionSeccion {
  rotulo: string;
  icono: NombreIcono;
  comandos: string[];
  query?: Params;
}

/**
 * Búsqueda del menú insensible a mayúsculas y acentos: «admision» encuentra
 * «Admisión» y «RECLAMO» encuentra «Reclamaciones».
 */
export function normalizarBusqueda(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

@Component({
  selector: 'app-admin-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NgStyle, Icono],
  template: `
    <div
      class="admin-shell"
      [ngStyle]="sitio.tema()"
      [attr.data-paleta]="prefs.paleta()"
      [attr.data-modo]="prefs.modo()"
      [class.admin-shell--plegado]="prefs.colapsado()"
      [class.admin-shell--nav-abierta]="navAbierto()"
    >
      <aside class="admin-nav" aria-label="Secciones del panel">
        <div class="admin-nav__marca">
          <span class="admin-nav__sello" aria-hidden="true">{{ siglas() }}</span>
          <span class="admin-nav__nombre">
            <strong>Panel</strong>
            <small>{{ sitio.nombre() }}</small>
          </span>
        </div>
        <div class="admin-nav__buscar">
          <app-icono nombre="busqueda" />
          <input
            #buscarNav
            type="search"
            class="admin-nav__busqueda"
            placeholder="Buscar sección"
            aria-label="Buscar sección"
            autocomplete="off"
            [value]="filtroSecciones()"
            (input)="filtroSecciones.set(buscarNav.value)"
            (keydown.escape)="limpiarBusqueda(buscarNav)"
          />
          @if (filtroSecciones()) {
            <button
              type="button"
              class="admin-nav__limpiar"
              aria-label="Limpiar la búsqueda"
              (click)="limpiarBusqueda(buscarNav)"
            >
              <app-icono nombre="cerrar" />
            </button>
          }
        </div>
        <nav>
          @for (f of filasNav(); track f.clave) {
            @if (f.grupo; as g) {
              <p class="admin-nav__grupo">
                @if (g.plegable) {
                  <button
                    type="button"
                    class="admin-nav__grupo-boton"
                    [attr.aria-expanded]="!prefs.grupoCerrado(g.id)"
                    [attr.aria-label]="
                      (prefs.grupoCerrado(g.id) ? 'Expandir' : 'Plegar') +
                      ' el grupo ' + g.titulo
                    "
                    (click)="prefs.alternarGrupo(g.id)"
                  >
                    <span>{{ g.titulo }}</span>
                    <app-icono nombre="chevron" />
                  </button>
                } @else {
                  <span>{{ g.titulo }}</span>
                }
              </p>
            }
            @if (f.entrada; as e) {
              <a
                [routerLink]="e.comandos"
                [queryParams]="e.query"
                [class.activo]="entradaActiva(e)"
                [attr.aria-current]="entradaActiva(e) ? 'page' : null"
                [attr.aria-label]="etiquetaEntrada(e)"
                [title]="e.titulo"
                ><app-icono [nombre]="e.icono" /><span>{{ e.titulo }}</span>
                @if (badgeDe(e) > 0) {
                  <span class="admin-nav__badge" aria-hidden="true">{{
                    badgeDe(e)
                  }}</span>
                }</a
              >
            }
            @if (f.aviso) {
              <p class="admin-nav__vacio">{{ f.aviso }}</p>
            }
          }
        </nav>
        <div class="admin-nav__pie">
          <a routerLink="/admin/cuenta" routerLinkActive="activo" title="Mi cuenta"
            ><app-icono nombre="cuenta" /><span>Mi cuenta</span></a
          >
          <a href="/" target="_blank" rel="noopener noreferrer" title="Ver el sitio público"
            ><app-icono nombre="enlace" /><span>Ver sitio</span></a
          >
        </div>
      </aside>
      <button
        type="button"
        class="admin-velo"
        aria-label="Cerrar el menú"
        (click)="navAbierto.set(false)"
      ></button>

      <div class="admin-shell__principal">
        <header class="admin-cabecera">
          <div class="admin-cabecera__izquierda">
            <button
              type="button"
              class="admin-plegar"
              (click)="alternarNav()"
              [attr.aria-label]="
                prefs.colapsado()
                  ? 'Expandir el menú de secciones'
                  : 'Plegar el menú de secciones'
              "
              [attr.aria-expanded]="!prefs.colapsado()"
            >
              <app-icono [nombre]="prefs.colapsado() ? 'desplegar' : 'plegar'" />
            </button>
            <div>
              <p class="admin-cabecera__antetitulo">
                Centro administrativo <span aria-hidden="true">/</span> {{ guia().etiqueta }}
              </p>
              <h1 class="admin-cabecera__titulo">{{ titulo() }}</h1>
              <p class="admin-cabecera__fecha">{{ hoy }}</p>
            </div>
          </div>
          <div class="admin-cabecera__acciones">
            @if (editor.editMode()) {
              <button
                type="button"
                class="admin-btn"
                (click)="save()"
                [disabled]="cms.saving()"
              >
                {{ cms.saving() ? 'Guardando…' : 'Guardar' }}
              </button>
              @if (auth.isAdmin()) {
                <button
                  type="button"
                  class="admin-btn admin-btn--primario"
                  (click)="publish()"
                  [disabled]="cms.saving()"
                >
                  Publicar
                </button>
              }
            }
            @if (accionSeccion(); as accion) {
              <a
                class="admin-btn admin-btn--primario admin-cabecera__accion"
                [routerLink]="accion.comandos"
                [queryParams]="accion.query"
                ><app-icono [nombre]="accion.icono" />{{ accion.rotulo }}</a
              >
            }
            @if (pendientes.total() > 0) {
              <a
                class="admin-pendientes"
                routerLink="/admin"
                [attr.aria-label]="etiquetaPendientes()"
                ><app-icono nombre="mensajes" />{{ pendientes.total() }}
                pendiente{{ pendientes.total() === 1 ? '' : 's' }}</a
              >
            }
            <span class="admin-sesion"
              ><span class="admin-sesion__punto" aria-hidden="true"></span>Sesión activa</span
            >
            <button
              type="button"
              class="admin-modo"
              (click)="alternarModo()"
              [attr.aria-pressed]="prefs.modo() === 'oscuro'"
              [attr.aria-label]="
                prefs.modo() === 'oscuro' ? 'Activar modo claro' : 'Activar modo oscuro'
              "
            >
              <app-icono [nombre]="prefs.modo() === 'oscuro' ? 'sol' : 'luna'" />
            </button>
            <div class="admin-cuenta-menu-wrap">
              <button
                type="button"
                class="admin-usuario"
                (click)="alternarMenu()"
                aria-haspopup="menu"
                [attr.aria-expanded]="menuAbierto() ? 'true' : 'false'"
                [attr.aria-label]="'Menú de cuenta de ' + (auth.username() ?? 'la sesión')"
              >
                <span class="admin-avatar" aria-hidden="true">{{ inicial() }}</span>
                <span class="admin-usuario__datos">
                  <span class="admin-usuario__nombre">{{ auth.username() ?? 'Sesión' }}</span>
                  <span class="admin-usuario__rol">{{ auth.rotuloRol() }}</span>
                </span>
              </button>
              @if (menuAbierto()) {
                <div class="admin-cuenta-menu" role="menu">
                  <a role="menuitem" routerLink="/admin/cuenta" (click)="cerrarMenu()"
                    >Mi cuenta</a
                  >
                  <button type="button" role="menuitem" (click)="logout()">
                    Cerrar sesión
                  </button>
                </div>
              }
            </div>
          </div>
        </header>

        <nav class="admin-herramientas" aria-label="Herramientas del panel">
          <p class="admin-miga">
            <a [routerLink]="auth.primeraSeccion()">Administración</a>
            <app-icono nombre="chevron" />
            <span aria-current="page">{{ titulo() }}</span>
          </p>
          <div class="admin-herramientas__acciones">
            @if (auth.puede('paginas') && rutaPath() !== '/admin/paginas') {
              <a class="admin-herramienta" routerLink="/admin/paginas"
                ><app-icono nombre="paginas" />Páginas</a
              >
            }
            @if (urlPaginaPublica(); as urlPublica) {
              <a
                class="admin-herramienta"
                [href]="urlPublica"
                target="_blank"
                rel="noopener noreferrer"
                ><app-icono nombre="enlace" />Ver página</a
              >
            }
            @if (auth.puede('medios') && rutaPath() !== '/admin/medios') {
              <a class="admin-herramienta" routerLink="/admin/medios"
                ><app-icono nombre="medios" />Medios</a
              >
            }
            <a class="admin-herramienta" href="/" target="_blank" rel="noopener noreferrer"
              ><app-icono nombre="enlace" />Ver sitio</a
            >
            <button
              type="button"
              class="admin-herramienta admin-guia-boton"
              [class.activo]="guiaAbierta()"
              [attr.aria-expanded]="guiaAbierta()"
              (click)="alternarGuia()"
            >
              <app-icono nombre="guia" />Guía del módulo
            </button>
          </div>
        </nav>

        @if (guiaAbierta()) {
          <section class="admin-guia" aria-label="Guía de la sección actual">
            <div class="admin-guia__cabecera">
              <div>
                <p class="admin-guia__antetitulo">Guía de trabajo</p>
                <h2>{{ guia().etiqueta }}</h2>
                <p>{{ guia().descripcion }}</p>
              </div>
              <button
                type="button"
                class="admin-btn admin-btn--fantasma"
                aria-label="Cerrar guía"
                (click)="guiaAbierta.set(false)"
              >
                <app-icono nombre="cerrar" />
              </button>
            </div>
            <ol>
              @for (paso of guia().acciones; track paso) {
                <li>{{ paso }}</li>
              }
            </ol>
          </section>
        }

        @if (aviso()) {
          <div
            class="admin-banner"
            [class.admin-banner--error]="aviso()!.error"
            [class.admin-banner--ok]="!aviso()!.error"
            role="status"
          >
            {{ aviso()!.texto }}
          </div>
        }

        <main class="admin-contenido">
          <router-outlet></router-outlet>
        </main>
      </div>
    </div>
  `,
})
export class AdminShell implements OnInit, OnDestroy {
  auth = inject(AuthService);
  cms = inject(CmsContentService);
  editor = inject(CmsEditorService);
  /** Apariencia publicada: el panel usa los mismos tokens que el sitio. */
  sitio = inject(SitioPublicoService);
  /** Preferencias del panel (paleta, modo, riel y grupos plegados). */
  readonly prefs = inject(PreferenciasPanel);
  /** Conteo compartido de solicitudes pendientes (píldoras y cabecera). */
  readonly pendientes = inject(PendientesPanel);
  private dialogo = inject(DialogoService);
  private router = inject(Router);
  private sub?: Subscription;

  readonly error = signal('');
  readonly status = signal('');
  /** Ruta actual del panel: al cambiar, se limpia el aviso de la sección anterior. */
  readonly ruta = signal('');
  /** Menú del avatar: cerrar sesión es una acción nombrada, no un toque accidental. */
  readonly menuAbierto = signal(false);
  /** Cajón del riel en pantalla estrecha. */
  readonly navAbierto = signal(false);
  /** Panel con la guía de la sección actual. */
  readonly guiaAbierta = signal(false);
  /** Texto del buscador de secciones del menú lateral. */
  readonly filtroSecciones = signal('');

  readonly guia = computed(() => guiaDe(this.ruta()));
  /** Tipos de mensaje con bandeja propia dentro del grupo «Gestión». */
  readonly tiposBandeja = ['tramite', 'reclamo', 'accesibilidad', 'contacto'] as const;
  readonly bandejas = BANDEJAS_MENSAJE;

  /** La ruta sin query: con ella se decide la sección actual y sus atajos. */
  readonly rutaPath = computed(() => this.ruta().split('?')[0]);

  /** «Mi cuenta» vive en el pie del riel pero también entra en la búsqueda. */
  private readonly entradaCuenta: EntradaNav = {
    id: 'cuenta',
    titulo: 'Mi cuenta',
    icono: 'cuenta',
    comandos: ['/admin/cuenta'],
  };

  /**
   * El menú por grupos, ya filtrado por rol: el modelo lo construyen las
   * mismas reglas que antes decoraban la plantilla, así el buscador y los
   * grupos plegables trabajan sobre un solo listado.
   */
  readonly gruposNav = computed<GrupoNav[]>(() => {
    const grupos: GrupoNav[] = [
      {
        id: 'panel',
        titulo: 'Panel',
        plegable: false,
        entradas: [
          {
            id: 'dashboard',
            titulo: 'Dashboard',
            icono: 'grafico',
            comandos: ['/admin'],
            exacta: true,
          },
        ],
      },
    ];
    if (this.auth.puede('paginas') && this.paginasMenu().length) {
      grupos.push({
        id: 'portal',
        titulo: 'Portal público',
        plegable: true,
        entradas: this.paginasMenu().map((p) => ({
          id: `pagina-${p.slug}`,
          titulo: p.titulo,
          icono: iconoDePagina(p.slug),
          comandos: ['/admin/editor', p.slug],
        })),
      });
    }
    const gestion: EntradaNav[] = [];
    if (this.auth.puede('noticias')) {
      gestion.push({
        id: 'noticias',
        titulo: 'Noticias',
        icono: 'noticias',
        comandos: ['/admin/noticias'],
      });
    }
    if (this.auth.puede('mensajes')) {
      for (const tipo of this.tiposBandeja) {
        gestion.push({
          id: `bandeja-${tipo}`,
          titulo: BANDEJAS_MENSAJE[tipo].titulo,
          icono: this.iconoDeBandeja(tipo),
          comandos: ['/admin/mensajes'],
          query: { tipo },
          bandeja: tipo,
        });
      }
    }
    if (this.auth.puede('medios')) {
      gestion.push({
        id: 'medios',
        titulo: 'Medios',
        icono: 'medios',
        comandos: ['/admin/medios'],
      });
    }
    if (gestion.length) {
      grupos.push({ id: 'gestion', titulo: 'Gestión', plegable: true, entradas: gestion });
    }
    const configuracion: EntradaNav[] = [];
    if (this.auth.puede('paginas')) {
      configuracion.push({
        id: 'paginas',
        titulo: 'Páginas',
        icono: 'paginas',
        comandos: ['/admin/paginas'],
      });
    }
    if (this.auth.isAdmin()) {
      configuracion.push(
        {
          id: 'identidad',
          titulo: 'Identidad',
          icono: 'identidad',
          comandos: ['/admin/identidad'],
        },
        {
          id: 'apariencia',
          titulo: 'Apariencia',
          icono: 'apariencia',
          comandos: ['/admin/apariencia'],
        },
        {
          id: 'usuarios',
          titulo: 'Usuarios',
          icono: 'usuarios',
          comandos: ['/admin/usuarios'],
        },
      );
    }
    if (configuracion.length) {
      grupos.push({
        id: 'configuracion',
        titulo: 'Configuración',
        plegable: true,
        entradas: configuracion,
      });
    }
    return grupos;
  });

  /** El buscador filtra las entradas visibles por rol (más «Mi cuenta»). */
  readonly buscando = computed(() => normalizarBusqueda(this.filtroSecciones()) !== '');
  readonly resultados = computed<EntradaNav[]>(() => {
    const q = normalizarBusqueda(this.filtroSecciones());
    if (!q) {
      return [];
    }
    const pool = [
      ...this.gruposNav().flatMap((g) => g.entradas),
      this.entradaCuenta,
    ];
    return pool.filter((e) => normalizarBusqueda(e.titulo).includes(q));
  });

  /**
   * Las filas del `<nav>` ya resueltas: con búsqueda, resultados planos bajo
   * un rótulo; sin ella, los grupos con sus entradas salvo los plegados.
   */
  readonly filasNav = computed<FilaNav[]>(() => {
    const filas: FilaNav[] = [];
    if (this.buscando()) {
      filas.push({
        clave: 'grupo-resultados',
        grupo: { id: 'resultados', titulo: 'Resultados', plegable: false, entradas: [] },
      });
      if (!this.resultados().length) {
        filas.push({
          clave: 'vacio',
          aviso: `Sin resultados para «${this.filtroSecciones().trim()}».`,
        });
      }
      for (const e of this.resultados()) {
        filas.push({ clave: `entrada-${e.id}`, entrada: e });
      }
      return filas;
    }
    for (const g of this.gruposNav()) {
      filas.push({ clave: `grupo-${g.id}`, grupo: g });
      if (g.plegable && this.prefs.grupoCerrado(g.id)) {
        continue;
      }
      for (const e of g.entradas) {
        filas.push({ clave: `entrada-${e.id}`, entrada: e });
      }
    }
    return filas;
  });

  /**
   * Acción principal contextual de la cabecera: «Nueva noticia», «Nueva
   * página»… Cada una navega a su sección con un parámetro que la propia
   * pantalla interpreta (abrir el formulario, enfocar el alta o abrir el
   * selector de archivos). En el editor no sale: allí las acciones ya son
   * Guardar y Publicar.
   */
  readonly accionSeccion = computed<AccionSeccion | null>(() => {
    if (this.editor.editMode()) {
      return null;
    }
    switch (this.rutaPath()) {
      case '/admin/noticias':
        return this.auth.puede('noticias')
          ? {
              rotulo: 'Nueva noticia',
              icono: 'noticias',
              comandos: ['/admin/noticias'],
              query: { nueva: '1' },
            }
          : null;
      case '/admin/paginas':
        return this.auth.isAdmin()
          ? {
              rotulo: 'Nueva página',
              icono: 'paginas',
              comandos: ['/admin/paginas'],
              query: { nueva: '1' },
            }
          : null;
      case '/admin/usuarios':
        return this.auth.isAdmin()
          ? {
              rotulo: 'Nueva cuenta',
              icono: 'usuarios',
              comandos: ['/admin/usuarios'],
              query: { nueva: '1' },
            }
          : null;
      case '/admin/medios':
        return this.auth.puede('medios')
          ? {
              rotulo: 'Subir imagen',
              icono: 'medios',
              comandos: ['/admin/medios'],
              query: { subir: '1' },
            }
          : null;
      default:
        return null;
    }
  });

  /**
   * En el editor, la barra de herramientas ofrece «Ver página»: la URL
   * pública de la página que se está editando.
   */
  readonly urlPaginaPublica = computed(() => {
    if (!this.rutaPath().startsWith('/admin/editor/')) {
      return null;
    }
    const slug = this.cms.currentSlug();
    const pagina = this.cms.pageList().find((p) => p.slug === slug);
    return pagina?.ruta || `/${slug}`;
  });

  /** Etiqueta completa de la píldora de pendientes de la cabecera. */
  readonly etiquetaPendientes = computed(() => {
    const n = this.pendientes.total();
    return `${n} ${n === 1 ? 'solicitud pendiente' : 'solicitudes pendientes'}: ir al panel`;
  });

  /**
   * Páginas del grupo «Portal público»: las que la institución decidió
   * mostrar en el menú, en el mismo orden que lleva la cabecera. Cada una
   * abre su editor: la entrada del menú es la relación página↔contenido.
   */
  readonly paginasMenu = computed(() =>
    this.cms
      .pageList()
      .filter((p) => p.mostrar_en_menu)
      .sort((a, b) => (a.orden_menu ?? 0) - (b.orden_menu ?? 0)),
  );
  readonly hoy = new Intl.DateTimeFormat('es-PE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());
  /** Iniciales de la marca para el sello del riel (dos letras con más peso). */
  readonly siglas = computed(
    () =>
      this.sitio
        .nombre()
        .split(/\s+/)
        .filter((p) => p.length > 2)
        .slice(0, 2)
        .map((p) => p[0].toUpperCase())
        .join('') || 'P',
  );

  /** Icono de cada entrada del grupo «Portal público» (función del módulo). */
  readonly iconoDePagina = iconoDePagina;

  /** Icono de cada bandeja del grupo «Gestión». */
  iconoDeBandeja(tipo: string): NombreIcono {
    const mapa: Record<string, NombreIcono> = {
      tramite: 'documento',
      reclamo: 'balanza',
      accesibilidad: 'accesibilidad',
      contacto: 'correo',
    };
    return mapa[tipo] ?? 'mensajes';
  }

  /**
   * Las bandejas comparten la ruta /admin/mensajes y solo se distinguen por
   * el `?tipo=`: routerLinkActive no mira la query, así que el estado activo
   * se compara contra la URL completa que guarda `ruta`.
   */
  bandejaActiva(tipo: string): boolean {
    return this.ruta() === `/admin/mensajes?tipo=${tipo}`;
  }

  /**
   * Estado activo de cada entrada del menú: las bandejas se comparan contra
   * la URL completa (comparten `/admin/mensajes`) y el resto contra el path,
   * con match exacto solo para el Dashboard.
   */
  entradaActiva(e: EntradaNav): boolean {
    if (e.bandeja) {
      return this.bandejaActiva(e.bandeja);
    }
    const destino = e.comandos.join('/');
    const path = this.rutaPath();
    if (e.exacta) {
      return path === destino;
    }
    return path === destino || path.startsWith(`${destino}/`);
  }

  /** Pendientes de una bandeja (0 para el resto de entradas). */
  badgeDe(e: EntradaNav): number {
    return e.bandeja ? this.pendientes.deTipo(e.bandeja) : 0;
  }

  /**
   * aria-label con el conteo, para que «Mesa de partes · 3» se anuncie como
   * «Mesa de partes: 3 pendientes» y no como un número suelto.
   */
  etiquetaEntrada(e: EntradaNav): string | null {
    const n = this.badgeDe(e);
    return n > 0 ? `${e.titulo}: ${n} pendiente${n === 1 ? '' : 's'}` : null;
  }

  /** Limpia el filtro (ESC o el ×) y devuelve el foco al campo. */
  limpiarBusqueda(campo: HTMLInputElement): void {
    this.filtroSecciones.set('');
    campo.focus();
  }

  alternarMenu(): void {
    this.menuAbierto.update((abierto) => !abierto);
  }

  cerrarMenu(): void {
    this.menuAbierto.set(false);
  }

  /** En escritorio pliega el riel; en móvil abre o cierra el cajón. */
  alternarNav(): void {
    if (window.matchMedia?.('(max-width: 900px)').matches) {
      this.navAbierto.update((v) => !v);
      return;
    }
    this.prefs.alternarColapsado();
  }

  alternarModo(): void {
    this.prefs.alternarModo();
  }

  alternarGuia(): void {
    this.guiaAbierta.update((v) => !v);
  }

  @HostListener('document:click', ['$event'])
  cerrarMenuPorFuera(evento: MouseEvent): void {
    if ((evento.target as HTMLElement).closest('.admin-cuenta-menu-wrap')) {
      return;
    }
    this.cerrarMenu();
  }

  @HostListener('document:keydown.escape')
  cerrarMenuPorEscape(): void {
    this.cerrarMenu();
    this.navAbierto.set(false);
  }

  readonly inicial = computed(() =>
    (this.auth.username() || 'A').slice(0, 1).toUpperCase(),
  );

  readonly titulo = computed(() => {
    const seccion = tituloDeSeccion(this.ruta());
    if (seccion !== '') {
      return seccion;
    }
    const slug = this.cms.currentSlug();
    const pagina = this.cms.pageList().find((p) => p.slug === slug);
    return pagina?.titulo || slug;
  });

  ngOnInit(): void {
    this.ruta.set(this.router.url);
    // El panel se pinta con la apariencia publicada por la institución.
    void this.sitio.cargar();
    // Píldoras del menú y de la cabecera: una sola petición de pendientes
    // por navegación (el servicio la omite si el rol no tiene bandeja).
    void this.pendientes.cargar();
    // «Portal público» lista las páginas del sitio; el catálogo solo lo
    // pueden leer los roles que editan páginas (la API lo exige también).
    if (this.auth.puede('paginas')) {
      void this.cms.listPages().catch(() => undefined);
    }
    this.sub = this.router.events.subscribe((evento) => {
      if (!(evento instanceof NavigationEnd)) {
        return;
      }
      this.ruta.set(evento.urlAfterRedirects);
      void this.pendientes.cargar();
      // El aviso pertenece a la sección donde se produjo: al cambiar de
      // pantalla se retira para no confundir con lo que se está viendo.
      this.status.set('');
      this.error.set('');
      this.navAbierto.set(false);
      this.guiaAbierta.set(false);
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  readonly aviso = computed(() => {
    if (this.error() || this.cms.conflict()) {
      return { error: true, texto: this.error() || this.cms.conflict() };
    }
    if (this.status()) {
      return { error: false, texto: this.status() };
    }
    return null;
  });

  async save(): Promise<void> {
    this.error.set('');
    this.status.set('');
    try {
      await this.cms.save();
      this.status.set('Guardado.');
    } catch {
      this.error.set(
        this.cms.conflict() ||
          'No se pudieron guardar los cambios. Revisa tu conexión.',
      );
    }
  }

  async publish(): Promise<void> {
    const marcadores = buscarMarcadores(this.cms.activeContent());
    if (marcadores.length > 0) {
      const seguir = await this.dialogo.confirmar({
        titulo: 'Publicar con marcadores sin sustituir',
        mensaje: `Quedan ${marcadores.length} ${marcadores.length === 1 ? 'marcador' : 'marcadores'} sin sustituir. Si publicas ahora, el texto del marcador se publicará tal cual.`,
        textoConfirmar: 'Publicar de todos modos',
      });
      if (!seguir) {
        return;
      }
    }
    this.error.set('');
    this.status.set('');
    try {
      await this.cms.publish();
      this.status.set('Publicado. La web ya muestra esta versión.');
    } catch {
      this.error.set(
        this.cms.conflict() ||
          'No se pudo publicar. Comprueba que tu usuario sea administrador.',
      );
    }
  }

  async logout(): Promise<void> {
    this.cerrarMenu();
    await this.auth.logout();
  }
}
