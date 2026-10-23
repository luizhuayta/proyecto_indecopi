import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../cms/auth.service';
import { CmsContentService } from '../cms/cms-content.service';
import { CmsEditorService } from '../cms/cms-editor.service';
import { buscarMarcadores } from '../cms/cms.models';

/**
 * Marco del panel: navegación lateral, cabecera con las acciones Guardar y
 * Publicar (distintas y separadas) y el punto de montaje de las rutas hijas.
 */
@Component({
  selector: 'app-admin-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="admin-shell">
      <aside class="admin-nav">
        <div class="admin-nav__marca">Panel</div>
        <nav aria-label="Secciones del panel">
          <a routerLink="/admin/paginas" routerLinkActive="activo">Páginas</a>
          <a routerLink="/admin/identidad" routerLinkActive="activo">Identidad</a>
          <a routerLink="/admin/apariencia" routerLinkActive="activo">Apariencia</a>
          <a routerLink="/admin/medios" routerLinkActive="activo">Medios</a>
          <a routerLink="/admin/mensajes" routerLinkActive="activo">Mensajes</a>
          <a routerLink="/admin/usuarios" routerLinkActive="activo">Usuarios</a>
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
export class AdminShell {
  auth = inject(AuthService);
  cms = inject(CmsContentService);
  editor = inject(CmsEditorService);

  readonly error = signal('');
  readonly status = signal('');

  readonly inicial = computed(() => (this.auth.username() || 'A').slice(0, 1).toUpperCase());

  readonly titulo = computed(() => {
    const slug = this.cms.currentSlug();
    const pagina = this.cms.pageList().find((p) => p.slug === slug);
    return pagina?.titulo || (this.editor.editMode() ? slug : 'Panel');
  });

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
