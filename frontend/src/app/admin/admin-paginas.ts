import { Component, ElementRef, OnDestroy, OnInit, ViewChild, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { CmsContentService } from '../cms/cms-content.service';
import { AuthService } from '../cms/auth.service';
import { PAGE_TEMPLATES } from '../cms/block-registry';
import type { CmsPageSummary } from '../cms/cms.models';
import { DialogoService } from './dialogo.service';
import { EstadoVacio } from './estado-vacio';

/** Mensaje del servidor cuando rechaza la operación; si no hay, el genérico. */
function mensajeDeError(err: unknown, porDefecto: string): string {
  const mensaje = (err as { error?: { message?: string } } | null)?.error?.message;
  return typeof mensaje === 'string' && mensaje ? mensaje : porDefecto;
}

/**
 * Listado de páginas del sitio, con alta de página nueva y acciones para
 * editar o eliminar cada una.
 */
@Component({
  selector: 'app-admin-paginas',
  standalone: true,
  imports: [RouterLink, FormsModule, EstadoVacio],
  template: `
    <header class="admin-encabezado">
      <div>
        <h2 class="admin-encabezado__titulo">Páginas</h2>
        <p class="admin-subtitulo admin-encabezado__texto">El contenido de cada página se edita en el constructor visual.</p>
      </div>
    </header>

    @if (auth.isAdmin()) {
      <form class="admin-alta admin-tarjeta" (ngSubmit)="crear()">
        <div class="admin-campo">
          <label for="nueva-titulo">Título de la página</label>
          <input
            #nuevoTitulo
            id="nueva-titulo"
            class="admin-control"
            type="text"
            [value]="titulo()"
            (input)="titulo.set($any($event.target).value)"
            placeholder="Por ejemplo: Admisión"
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
    }

    @if (error()) {
      <p class="admin-banner admin-banner--error" role="alert">{{ error() }}</p>
    }
    @if (status()) {
      <p class="admin-banner admin-banner--ok" role="status">{{ status() }}</p>
    }

    @if (metaPagina(); as p) {
      <section class="admin-alta admin-tarjeta admin-meta" aria-labelledby="meta-titulo">
        <h2 id="meta-titulo" class="admin-titulo admin-titulo--chico">
          Metadatos de «{{ p.titulo }}»
        </h2>
        <form class="admin-form-meta" (ngSubmit)="guardarMeta()">
          <div class="admin-campo">
            <label for="meta-titulo-campo">Título</label>
            <input
              id="meta-titulo-campo"
              class="admin-control"
              type="text"
              [value]="metaTitulo()"
              (input)="metaTitulo.set($any($event.target).value)"
            />
          </div>
          <div class="admin-campo">
            <label for="meta-slug">Slug</label>
            <input
              id="meta-slug"
              class="admin-control"
              type="text"
              [value]="metaSlug()"
              (input)="metaSlug.set($any($event.target).value)"
            />
          </div>
          <div class="admin-campo">
            <label for="meta-ruta">Ruta</label>
            <input
              id="meta-ruta"
              class="admin-control"
              type="text"
              [value]="metaRuta()"
              (input)="metaRuta.set($any($event.target).value)"
            />
          </div>
          <div class="admin-campo">
            <label for="meta-orden">Orden en menú</label>
            <input
              id="meta-orden"
              class="admin-control"
              type="number"
              [value]="metaOrden()"
              (input)="metaOrden.set(+$any($event.target).value)"
            />
          </div>
          <div class="admin-campo admin-campo--check">
            <label>
              <input
                type="checkbox"
                [checked]="metaMenu()"
                (change)="metaMenu.set($any($event.target).checked)"
              />
              Mostrar en el menú
            </label>
          </div>
          <div class="admin-meta__acciones">
            <button type="submit" class="admin-btn admin-btn--primario" [disabled]="guardandoMeta()">
              {{ guardandoMeta() ? 'Guardando…' : 'Guardar metadatos' }}
            </button>
            <button type="button" class="admin-btn" (click)="cerrarMeta()" [disabled]="guardandoMeta()">
              Cancelar
            </button>
          </div>
        </form>
      </section>
    }

    @if (cms.pageList().length === 0) {
      <app-estado-vacio
        icono="paginas"
        titulo="Todavía no hay páginas"
        mensaje="Crea la primera página y empieza a llenar el sitio con contenido."
        [textoAccion]="auth.isAdmin() ? 'Crear la primera página' : ''"
        (accion)="enfocarAlta()"
      />
    } @else {
      <div class="admin-tabla-scroll">
      <table class="admin-tabla">
        <thead>
          <tr>
            <th scope="col">Título</th>
            <th scope="col">Ruta</th>
            <th scope="col">Estado</th>
            <th scope="col">Actualizada</th>
            <th scope="col"><span class="sr-only">Acciones</span></th>
          </tr>
        </thead>
        <tbody>
          @for (pagina of cms.pageList(); track pagina.slug) {
            <tr>
              <td>{{ pagina.titulo }}</td>
              <td>{{ pagina.ruta || '/' + pagina.slug }}</td>
              <td>
                @if (cms.hasDraft()[pagina.slug]) {
                  <span class="admin-etiqueta admin-etiqueta--borrador">Cambios sin publicar</span>
                } @else {
                  <span class="admin-etiqueta admin-etiqueta--ok">Publicada</span>
                }
              </td>
              <td>{{ fecha(pagina.actualizado_en) }}</td>
              <td class="admin-tabla__acciones">
                @if (auth.isAdmin()) {
                  <button
                    type="button"
                    class="admin-btn admin-btn--fantasma"
                    (click)="editarMeta(pagina)"
                  >
                    Metadatos
                  </button>
                }
                <a class="admin-btn admin-btn--fantasma" [routerLink]="['/admin/editor', pagina.slug]">
                  Editar
                </a>
                @if (auth.isAdmin()) {
                  <button
                    type="button"
                    class="admin-btn admin-btn--fantasma admin-btn--peligro"
                    (click)="eliminar(pagina.slug, pagina.titulo)"
                  >
                    Eliminar
                  </button>
                }
              </td>
            </tr>
          }
        </tbody>
      </table>
      </div>
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
      }
      .admin-alta .admin-campo {
        flex: 1 1 12rem;
      }
      .admin-meta {
        display: block;
      }
      .admin-titulo--chico {
        font-size: 1.25rem;
        margin: 0 0 0.75rem;
      }
      .admin-form-meta {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: var(--space-12, 0.75rem);
        align-items: end;
      }
      .admin-form-meta .admin-campo--check {
        flex-direction: row;
        align-items: center;
      }
      .admin-meta__acciones {
        grid-column: 1 / -1;
        display: flex;
        gap: var(--space-8, 0.5rem);
      }
      @media (max-width: 900px) {
        .admin-form-meta {
          grid-template-columns: 1fr;
        }
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
export class AdminPaginas implements OnInit, OnDestroy {
  cms = inject(CmsContentService);
  auth = inject(AuthService);
  private dialogo = inject(DialogoService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private sub?: Subscription;

  @ViewChild('nuevoTitulo') private nuevoTitulo?: ElementRef<HTMLInputElement>;

  /** El estado vacío ofrece crear la primera página: el foco va al campo. */
  enfocarAlta(): void {
    this.nuevoTitulo?.nativeElement.focus();
  }

  readonly titulo = signal('');
  readonly plantilla = signal('blank');
  readonly error = signal('');
  readonly status = signal('');
  readonly busy = signal(false);
  readonly metaPagina = signal<CmsPageSummary | null>(null);
  readonly metaTitulo = signal('');
  readonly metaSlug = signal('');
  readonly metaRuta = signal('');
  readonly metaMenu = signal(false);
  readonly metaOrden = signal(0);
  readonly guardandoMeta = signal(false);

  ngOnInit(): void {
    if (!this.cms.loaded()) {
      void this.cms.loadAll();
    }
    // «Nueva página» de la cabecera llega como ?nueva=1: el foco va al título
    // del alta y el parámetro se retira de la URL.
    this.sub = this.route.queryParams.subscribe((params) => {
      if (params['nueva'] !== '1' || !this.auth.isAdmin()) {
        return;
      }
      setTimeout(() => this.enfocarAlta());
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { nueva: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
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

  editarMeta(pagina: CmsPageSummary): void {
    this.metaPagina.set(pagina);
    this.metaTitulo.set(pagina.titulo);
    this.metaSlug.set(pagina.slug);
    this.metaRuta.set(pagina.ruta || '/' + pagina.slug);
    this.metaMenu.set(!!pagina.mostrar_en_menu);
    this.metaOrden.set(pagina.orden_menu ?? 0);
    this.error.set('');
    this.status.set('');
  }

  cerrarMeta(): void {
    this.metaPagina.set(null);
    this.error.set('');
  }

  async guardarMeta(): Promise<void> {
    const pagina = this.metaPagina();
    if (!pagina || this.guardandoMeta()) {
      return;
    }
    const titulo = this.metaTitulo().trim();
    if (!titulo) {
      this.error.set('El título no puede quedar vacío.');
      return;
    }
    this.guardandoMeta.set(true);
    this.error.set('');
    this.status.set('');
    try {
      await this.cms.updatePageMeta(pagina.slug, {
        titulo,
        slug: this.metaSlug().trim(),
        ruta: this.metaRuta().trim(),
        mostrar_en_menu: this.metaMenu(),
        orden_menu: this.metaOrden(),
      });
      this.metaPagina.set(null);
      this.status.set('Metadatos guardados.');
    } catch (err: unknown) {
      this.error.set(mensajeDeError(err, 'No se pudieron guardar los metadatos.'));
    } finally {
      this.guardandoMeta.set(false);
    }
  }

  async eliminar(slug: string, titulo = ''): Promise<void> {
    const nombre = titulo || slug;
    const seguir = await this.dialogo.confirmar({
      titulo: 'Eliminar esta página',
      mensaje: `«${nombre}» desaparecerá del sitio. Esta acción no se puede deshacer.`,
      textoConfirmar: 'Eliminar',
      peligro: true,
    });
    if (!seguir) {
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
