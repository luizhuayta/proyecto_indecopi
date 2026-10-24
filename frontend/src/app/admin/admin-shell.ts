import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { NgStyle } from '@angular/common';
import { Subscription } from 'rxjs';
import { AuthService } from '../cms/auth.service';
import { CmsContentService } from '../cms/cms-content.service';
import { CmsEditorService } from '../cms/cms-editor.service';
import { buscarMarcadores } from '../cms/cms.models';
import { SitioPublicoService } from '../core/sitio-publico.service';

/**
 * Marco del panel: navegación lateral, cabecera con las acciones Guardar y
 * Publicar (distintas y separadas) y el punto de montaje de las rutas hijas.
 */
/**
 * Nombre de la sección del panel según la ruta. Vacío cuando el título lo da
 * la página abierta en el editor.
 */
export function tituloDeSeccion(url: string): string {
  const secciones: Record<string, string> = {
    '/admin/paginas': 'Páginas',
    '/admin/identidad': 'Identidad',
    '/admin/apariencia': 'Apariencia',
    '/admin/medios': 'Medios',
    '/admin/mensajes': 'Mensajes',
    '/admin/usuarios': 'Usuarios',
    '/admin/cuenta': 'Mi cuenta',
    '/admin': 'Panel',
  };
  if (url.startsWith('/admin/editor/')) {
    return '';
  }
  return secciones[url] ?? 'Panel';
}

@Component({
  selector: 'app-admin-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NgStyle],
  template: `
    <div class="admin-shell" [ngStyle]="sitio.tema()">
      <aside class="admin-nav">
        <div class="admin-nav__marca">Panel</div>
        <nav aria-label="Secciones del panel">
          <a routerLink="/admin/paginas" routerLinkActive="activo">Páginas</a>
          <a routerLink="/admin/identidad" routerLinkActive="activo">Identidad</a>
          <a routerLink="/admin/apariencia" routerLinkActive="activo">Apariencia</a>
          <a routerLink="/admin/medios" routerLinkActive="activo">Medios</a>
          <a routerLink="/admin/mensajes" routerLinkActive="activo">Mensajes</a>
          <a routerLink="/admin/usuarios" routerLinkActive="activo">Usuarios</a>
          <a routerLink="/admin/cuenta" routerLinkActive="activo">Mi cuenta</a>
        </nav>
      </aside>

      <div class="admin-shell__principal">
        <header class="admin-cabecera">
          <div class="admin-cabecera__titulo">{{ titulo() }}</div>
          <div class="admin-cabecera__acciones">
            @if (editor.editMode()) {
              <button type="button" class="admin-btn" (click)="save()" [disabled]="cms.saving()">
                {{ cms.saving() ? 'Guardando…' : 'Guardar' }}
              </button>
              <button
                type="button"
                class="admin-btn admin-btn--primario"
                (click)="publish()"
                [disabled]="cms.saving()"
              >
                Publicar
              </button>
            }
            <button
              type="button"
              class="admin-avatar"
              (click)="logout()"
              [attr.aria-label]="'Cerrar sesión de ' + (auth.username() ?? '')"
            >
              {{ inicial() }}
            </button>
          </div>
        </header>

        @if (aviso()) {
          <div class="admin-banner" [class.admin-banner--error]="aviso()!.error" [class.admin-banner--ok]="!aviso()!.error" role="status">
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
  private router = inject(Router);
  private sub?: Subscription;

  readonly error = signal('');
  readonly status = signal('');
  /** Ruta actual del panel: al cambiar, se limpia el aviso de la sección anterior. */
  readonly ruta = signal('');

  readonly inicial = computed(() => (this.auth.username() || 'A').slice(0, 1).toUpperCase());

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
    this.ruta.set(this.router.url.split('?')[0]);
    // El panel se pinta con la apariencia publicada por la institución.
    void this.sitio.cargar();
    this.sub = this.router.events.subscribe((evento) => {
      if (!(evento instanceof NavigationEnd)) {
        return;
      }
      this.ruta.set(evento.urlAfterRedirects.split('?')[0]);
      // El aviso pertenece a la sección donde se produjo: al cambiar de
      // pantalla se retira para no confundir con lo que se está viendo.
      this.status.set('');
      this.error.set('');
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
      this.error.set(this.cms.conflict() || 'No se pudieron guardar los cambios. Revisa tu conexión.');
    }
  }

  async publish(): Promise<void> {
    const marcadores = buscarMarcadores(this.cms.activeContent());
    if (marcadores.length > 0) {
      const seguir = confirm(
        `Quedan marcadores sin sustituir: ${marcadores.length}. ¿Publicar de todos modos?`,
      );
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
        this.cms.conflict() || 'No se pudo publicar. Comprueba que tu usuario sea administrador.',
      );
    }
  }

  async logout(): Promise<void> {
    await this.auth.logout();
  }
}
