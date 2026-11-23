
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  HostListener,
  inject,
  signal,
} from '@angular/core';

import {
  NavigationEnd,
  Router,
  RouterLink,
  RouterOutlet,
} from '@angular/router';

import { filter } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { PortalSync } from '../../core/api/portal-sync';
import { AuthService } from '../../core/auth/auth.service';
import { AdminNavStore } from '../shared/admin-nav.store';
import { AdminPaletaService } from '../shared/admin-paleta.service';
import { ToastHost } from '../shared/toast/toast-host';
import { DialogComponent } from '../../shared/ui';
import { AdminSidebarComponent } from '../sidebar/sidebar.component';

interface ContextoSeccion {
  etiqueta: string;
  descripcion: string;
  acciones: string[];
}

const ROUTE_TITLES: Record<string, string> = {
  '/admin/dashboard': 'Dashboard',
  '/admin/contenido': 'Contenido del portal',
  '/admin/inicio': 'Inicio',
  '/admin/admision': 'Admisión',
  '/admin/becas': 'Becas y créditos',
  '/admin/costos': 'Costos',
  '/admin/estadisticas': 'Estadísticas',
  '/admin/horarios': 'Horarios',
  '/admin/inversiones': 'Inversiones',
  '/admin/licenciamiento': 'Licenciamiento',
  '/admin/nosotros': 'Nosotros',
  '/admin/servicios': 'Servicios',
  '/admin/transparencia': 'Transparencia',
  '/admin/reglamentos': 'Reglamentos',
  '/admin/procedimientos': 'Procedimientos',
  '/admin/psicopedagogico': 'Psicopedagógico',
  '/admin/servicio-social': 'Servicio social',
  '/admin/soporte-medico': 'Soporte médico',
  '/admin/pagina-reclamaciones': 'Página de reclamaciones',
  '/admin/privacidad': 'Privacidad',
  '/admin/repositorio-copy': 'Textos del repositorio',
  '/admin/programas': 'Programas de estudio',
  '/admin/menu': 'Menú de navegación',
  '/admin/noticias': 'Noticias',
  '/admin/comunicados': 'Comunicados',
  '/admin/personal': 'Personal y docentes',
  '/admin/contactos': 'Contactos',
  '/admin/investigaciones': 'Investigaciones',
  '/admin/documentos': 'Documentos',
  '/admin/mesa-de-partes': 'Mesa de partes',
  '/admin/reclamaciones': 'Reclamaciones',
  '/admin/accesibilidad': 'Accesibilidad',
  '/admin/solicitudes': 'Otras solicitudes',
  '/admin/usuarios': 'Usuarios',
  '/admin/mi-cuenta': 'Mi cuenta',
};

const RUTAS_PUBLICAS: Record<string, string> = {
  '/admin/inicio': '/inicio',
  '/admin/nosotros': '/nosotros',
  '/admin/admision': '/admision',
  '/admin/programas': '/programas',
  '/admin/noticias': '/noticias',
  '/admin/servicios': '/servicios',
  '/admin/transparencia': '/transparencia',
  '/admin/becas': '/becas',
  '/admin/costos': '/costos',
  '/admin/estadisticas': '/estadisticas',
  '/admin/horarios': '/horarios',
  '/admin/inversiones': '/inversiones',
  '/admin/licenciamiento': '/licenciamiento',
  '/admin/reglamentos': '/reglamentos',
  '/admin/procedimientos': '/procedimientos',
  '/admin/psicopedagogico': '/psicopedagogico',
  '/admin/servicio-social': '/servicio-social',
  '/admin/soporte-medico': '/soporte-medico',
  '/admin/repositorio-copy': '/repositorio',
  '/admin/mesa-de-partes': '/mesa-de-partes',
  '/admin/pagina-reclamaciones': '/reclamaciones',
  '/admin/privacidad': '/privacidad',
};

const CONTEXTOS: Record<string, ContextoSeccion> = {
  '/admin/dashboard': {
    etiqueta: 'CENTRO DE OPERACIONES',
    descripcion:
      'Consulta el estado del contenido y las solicitudes del portal.',
    acciones: [
      'Revisar los indicadores del dashboard.',
      'Consultar publicaciones y solicitudes.',
      'Entrar al módulo que necesites administrar.',
    ],
  },

  '/admin/contenido': {
    etiqueta: 'GESTIÓN DE CONTENIDO',
    descripcion:
      'Organiza la información institucional de las páginas públicas.',
    acciones: [
      'Seleccionar la página que quieres editar.',
      'Modificar los campos habilitados en su editor.',
      'Guardar y comprobar el resultado en el portal.',
    ],
  },

  '/admin/inicio': {
    etiqueta: 'EDITOR DE PORTADA',
    descripcion:
      'Administra el contenido principal de la página de inicio.',
    acciones: [
      'Revisar los textos y las imágenes de la portada.',
      'Editar los apartados disponibles del formulario.',
      'Guardar y revisar la página Inicio.',
    ],
  },

  '/admin/nosotros': {
    etiqueta: 'IDENTIDAD INSTITUCIONAL',
    descripcion:
      'Administra la información institucional y sus secciones.',
    acciones: [
      'Revisar misión, visión, valores y reseña histórica.',
      'Actualizar los campos disponibles.',
      'Comprobar cómo se muestra la información pública.',
    ],
  },

  '/admin/programas': {
    etiqueta: 'OFERTA ACADÉMICA',
    descripcion:
      'Gestiona los programas de estudio que ofrece el instituto.',
    acciones: [
      'Revisar los programas registrados.',
      'Actualizar sus datos e imágenes disponibles.',
      'Comprobar las tarjetas y detalles en la página pública.',
    ],
  },

  '/admin/noticias': {
    etiqueta: 'GESTIÓN EDITORIAL',
    descripcion:
      'Administra las publicaciones informativas del portal.',
    acciones: [
      'Consultar las noticias existentes.',
      'Crear o editar publicaciones mediante el editor.',
      'Revisar el estado de publicación y el portal público.',
    ],
  },

  '/admin/admision': {
    etiqueta: 'PROCESO DE ADMISIÓN',
    descripcion:
      'Gestiona el contenido informativo de admisión.',
    acciones: [
      'Revisar convocatoria, requisitos, fechas y demás apartados.',
      'Modificar textos y recursos disponibles.',
      'Guardar y verificar la página pública de Admisión.',
    ],
  },

  '/admin/servicios': {
    etiqueta: 'SERVICIOS INSTITUCIONALES',
    descripcion:
      'Gestiona los apartados de atención y servicios del instituto.',
    acciones: [
      'Revisar los servicios publicados.',
      'Actualizar descripciones y enlaces disponibles.',
      'Verificar las páginas relacionadas.',
    ],
  },

  '/admin/transparencia': {
    etiqueta: 'TRANSPARENCIA INSTITUCIONAL',
    descripcion:
      'Administra los apartados informativos de transparencia.',
    acciones: [
      'Revisar los rubros y apartados existentes.',
      'Actualizar los textos disponibles en el editor.',
      'Comprobar los documentos y enlaces publicados.',
    ],
  },

  '/admin/menu': {
    etiqueta: 'ARQUITECTURA DE NAVEGACIÓN',
    descripcion:
      'Configura la navegación institucional del portal.',
    acciones: [
      'Revisar los enlaces existentes.',
      'Modificar nombres y destinos desde el formulario.',
      'Comprobar la navegación en la web pública.',
    ],
  },

  '/admin/documentos': {
    etiqueta: 'GESTIÓN DOCUMENTAL',
    descripcion:
      'Administra los documentos publicados por la institución.',
    acciones: [
      'Consultar los documentos existentes.',
      'Agregar o editar los registros disponibles.',
      'Comprobar los archivos publicados.',
    ],
  },

  '/admin/usuarios': {
    etiqueta: 'CONTROL DE ACCESOS',
    descripcion:
      'Gestiona los usuarios y permisos del sistema existente.',
    acciones: [
      'Consultar las cuentas autorizadas.',
      'Administrar los permisos según el rol.',
      'Verificar los cambios mediante el sistema original.',
    ],
  },
};

const CONTEXTO_GENERAL: ContextoSeccion = {
  etiqueta: 'MÓDULO ADMINISTRATIVO',
  descripcion:
    'Utiliza los controles de esta sección para gestionar su información.',
  acciones: [
    'Revisar la información existente.',
    'Realizar los cambios en los formularios disponibles.',
    'Guardar y comprobar que la operación se completó.',
  ],
};

@Component({
  selector: 'app-admin-layout',
  standalone: true,

  imports: [
    RouterOutlet,
    RouterLink,
    AdminSidebarComponent,
    ToastHost,
    DialogComponent,
  ],

  templateUrl: './admin-layout.component.html',
  styleUrl: './admin-layout.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminLayoutComponent {
  private readonly router = inject(Router);
  private readonly sync = inject(PortalSync);
  private readonly auth = inject(AuthService);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly nav = inject(AdminNavStore);
  private readonly apariencia = inject(AdminPaletaService);

  readonly paleta = this.apariencia.actual;
  readonly modo = this.apariencia.modo;

  readonly rutaActual = signal(
    this.router.url.split('?')[0].split('#')[0]
  );

  readonly pageTitle = signal(
    ROUTE_TITLES[this.rutaActual()] ?? 'Dashboard'
  );

  readonly contextoActual = computed(
    () => CONTEXTOS[this.rutaActual()] ?? CONTEXTO_GENERAL
  );

  readonly rutaPublica = computed(
    () => RUTAS_PUBLICAS[this.rutaActual()] ?? '/inicio'
  );

  readonly tieneVistaPublica = computed(
    () => Boolean(RUTAS_PUBLICAS[this.rutaActual()])
  );

  readonly guiaAbierta = signal(false);

  readonly usuario = this.auth.usuario;

  readonly menuAbierto = signal(false);

  readonly confirmarSalida = signal(false);

  readonly navAbierto = this.nav.cajonAbierto;

  readonly colapsado = this.nav.colapsado;

  readonly hoy = new Date().toLocaleDateString('es-PE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  readonly iniciales = computed(() => {
    const nombre = this.usuario()?.nombre?.trim();

    if (!nombre) return 'PC';

    const partes = nombre.split(/\s+/).filter(Boolean);

    const dos =
      (partes[0][0] ?? '') +
      (partes.length > 1 ? partes[partes.length - 1][0] : '');

    return dos.toUpperCase() || 'PC';
  });

  readonly rolEtiqueta = computed(() =>
    this.usuario()?.rol === 'admin'
      ? 'Administrador'
      : 'Editor'
  );

  constructor() {
    // Conserva la sincronización original.
    void this.sync.hydrateAdmin();

    this.router.events
      .pipe(
        filter(
          (evento): evento is NavigationEnd =>
            evento instanceof NavigationEnd
        ),
        takeUntilDestroyed()
      )
      .subscribe(evento => {
        const ruta = evento.urlAfterRedirects
          .split('?')[0]
          .split('#')[0];

        this.rutaActual.set(ruta);
        this.pageTitle.set(ROUTE_TITLES[ruta] ?? 'Admin');

        this.menuAbierto.set(false);
        this.guiaAbierta.set(false);

        this.nav.cerrarCajon();

        if (typeof window !== 'undefined') {
          window.scrollTo({
            top: 0,
            behavior: 'smooth',
          });
        }
      });
  }

  alternarModo(evento: MouseEvent): void {
    const cambiar = () => this.apariencia.alternarModo();

    if (typeof document === 'undefined') {
      cambiar();
      return;
    }

    const doc = document as Document & {
      startViewTransition?: (
        update: () => void
      ) => { finished: Promise<void> };
    };

    if (
      !doc.startViewTransition ||
      window.matchMedia(
        '(prefers-reduced-motion: reduce)'
      ).matches
    ) {
      cambiar();
      return;
    }

    const boton = evento.currentTarget as HTMLElement;
    const rect = boton.getBoundingClientRect();

    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    const radio = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );

    document.documentElement.style.setProperty(
      '--theme-origin-x',
      x + 'px'
    );

    document.documentElement.style.setProperty(
      '--theme-origin-y',
      y + 'px'
    );

    document.documentElement.style.setProperty(
      '--theme-radius',
      radio + 'px'
    );

    document.documentElement.classList.add(
      'admin-theme-reveal'
    );

    try {
      const transicion = doc.startViewTransition(cambiar);

      void transicion.finished.finally(() => {
        document.documentElement.classList.remove(
          'admin-theme-reveal'
        );

        document.documentElement.style.removeProperty(
          '--theme-origin-x'
        );

        document.documentElement.style.removeProperty(
          '--theme-origin-y'
        );

        document.documentElement.style.removeProperty(
          '--theme-radius'
        );
      });
    } catch {
      document.documentElement.classList.remove(
        'admin-theme-reveal'
      );

      cambiar();
    }
  }

  alternarMenu(): void {
    this.menuAbierto.update(abierto => !abierto);
  }

  alternarGuia(): void {
    this.guiaAbierta.update(abierta => !abierta);
  }

  alternarNav(): void {
    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(max-width: 900px)').matches
    ) {
      this.nav.alternarCajon();
    } else {
      this.nav.alternarColapso();
    }
  }

  cerrarSesion(): void {
    this.menuAbierto.set(false);
    this.confirmarSalida.set(true);
  }

  confirmarCerrarSesion(): void {
    this.confirmarSalida.set(false);
    this.auth.logout();
  }

  @HostListener('document:click', ['$event'])
  cerrarSiClicFuera(evento: MouseEvent): void {
    if (!this.menuAbierto()) return;

    const menu =
      this.host.nativeElement.querySelector('.usermenu');

    if (menu && !menu.contains(evento.target as Node)) {
      this.menuAbierto.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  cerrarConEscape(): void {
    this.menuAbierto.set(false);
    this.guiaAbierta.set(false);
    this.nav.cerrarCajon();
  }
}
