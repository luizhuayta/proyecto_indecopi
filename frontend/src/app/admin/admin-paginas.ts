import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CmsContentService } from '../cms/cms-content.service';
import { PAGE_TEMPLATES } from '../cms/block-registry';

/**
 * Listado de páginas del sitio, con alta de página nueva y acciones para
 * editar o eliminar cada una.
 */
@Component({
  selector: 'app-admin-paginas',
  standalone: true,
  imports: [RouterLink],
  template: `
    <header>
      <h1 class="admin-titulo">Páginas</h1>
      <p class="admin-subtitulo">El contenido de cada página se edita en el constructor visual.</p>
    </header>

    <form class="admin-alta" (ngSubmit)="crear()">
      <div class="admin-campo">
        <label for="nueva-titulo">Título de la página</label>
        <input
          id="nueva-titulo"
          class="admin-control"
          type="text"
          [value]="titulo()"
          (input)="titulo.set($any($event.target).value)"
          placeholder="Nombre de la institución"
        />
      </div>
      <div class="admin-campo">
        <label for="nueva-plantilla">Plantilla</label>
        <select
          id="nueva-plantilla"
          class="admin-control"
          [value]="plantilla()"
          (change)="plantilla.set($any($event.target).value)"
        >
          @for (tpl of plantillas(); track tpl.id) {
            <option [value]="tpl.id">{{ tpl.label }}</option>
          }
        </select>
      </div>
      <button type="submit" class="admin-btn admin-btn--primario" [disabled]="busy()">
        {{ busy() ? 'Creando…' : 'Crear página' }}
      </button>
    </form>

    @if (error()) {
      <p class="admin-banner admin-banner--error" role="alert">{{ error() }}</p>
    }

    @if (cms.pageList().length === 0) {
      <p class="admin-vacio">Aún no hay páginas. Crea la primera para empezar.</p>
    } @else {
      <table class="admin-tabla">
        <thead>
          <tr>
            <th scope="col">Título</th>
            <th scope="col">Ruta</th>
            <th scope="col">Actualizada</th>
            <th scope="col"><span class="sr-only">Acciones</span></th>
          </tr>
        </thead>
        <tbody>
          @for (pagina of cms.pageList(); track pagina.slug) {
            <tr>
              <td>{{ pagina.titulo }}</td>
              <td>/{{ pagina.ruta || pagina.slug }}</td>
              <td>{{ fecha(pagina.actualizado_en) }}</td>
              <td class="admin-tabla__acciones">
                <a class="admin-btn admin-btn--fantasma" [routerLink]="['/admin/editor', pagina.slug]">
                  Editar
                </a>
                <button
                  type="button"
                  class="admin-btn admin-btn--fantasma admin-btn--peligro"
                  (click)="eliminar(pagina.slug)"
                >
                  Eliminar
                </button>
              </td>
            </tr>
          }
        </tbody>
      </table>
    }
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        gap: var(--space-16, 1rem);
      }
      .admin-titulo {
        margin: 0;
        font-family: var(--font-titulos, serif);
        font-weight: 600;
      }
      .admin-subtitulo {
        margin: 0;
        color: var(--color-texto-suave);
      }
      .admin-alta {
        display: flex;
        gap: var(--space-12, 0.75rem);
        align-items: flex-end;
        flex-wrap: wrap;
        padding: var(--space-16, 1rem);
        border: 1px solid var(--color-borde);
        border-radius: var(--radio-tarjeta, 6px);
        background: var(--color-superficie);
      }
      .admin-alta .admin-campo {
        flex: 1 1 12rem;
      }
      .admin-vacio {
        color: var(--color-texto-suave);
      }
      .admin-tabla__acciones {
        display: flex;
        gap: var(--space-8, 0.5rem);
        justify-content: flex-end;
      }
      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
      }
    `,
  ],
})
export class AdminPaginas implements OnInit {
  cms = inject(CmsContentService);
  private router = inject(Router);

  readonly titulo = signal('');
  readonly plantilla = signal('blank');
  readonly error = signal('');
  readonly busy = signal(false);

  ngOnInit(): void {
    if (!this.cms.loaded()) {
      void this.cms.loadAll();
    }
  }

  plantillas() {
    return PAGE_TEMPLATES;
  }

  fecha(iso: string | null | undefined): string {
    if (!iso) {
      return '—';
    }
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-PE');
  }

  async crear(): Promise<void> {
    const t = this.titulo().trim();
    if (!t) {
      this.error.set('Escribe un título para la página.');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    try {
      const pagina = await this.cms.createPage({ titulo: t, plantilla: this.plantilla() });
      this.titulo.set('');
      await this.router.navigate(['/admin/editor', pagina.slug]);
    } catch {
      this.error.set('No se pudo crear la página. Inténtalo de nuevo.');
    } finally {
      this.busy.set(false);
    }
  }

  async eliminar(slug: string): Promise<void> {
    if (!confirm('¿Eliminar esta página? Esta acción no se puede deshacer.')) {
      return;
    }
    this.error.set('');
    try {
      await this.cms.deletePage(slug);
    } catch {
      this.error.set('No se pudo eliminar la página.');
    }
  }
}
