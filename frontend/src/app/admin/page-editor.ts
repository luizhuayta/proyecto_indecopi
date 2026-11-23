import { Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { NgStyle } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { CmsContentService } from '../cms/cms-content.service';
import { CmsApiService } from '../cms/cms-api.service';
import { temaPublico } from '../core/tema';
import { CmsEditorService, PreviewDevice } from '../cms/cms-editor.service';
import { CmsHistoryService } from '../cms/cms-history.service';
import { BLOCK_TYPES, pageBlocks } from '../cms/block-registry';
import type { CmsBlock } from '../cms/block-registry';
import { CmsInspector } from './cms-inspector';
import { CmsPageBlocks } from '../cms/blocks/cms-page-blocks';
import type { CmsRevision } from '../cms/cms.models';

/**
 * Constructor visual de una página: vista previa por dispositivo, selección de
 * bloques al hacer clic, inspector de campos y acciones de bloque (agregar,
 * duplicar, ocultar, eliminar, mover) más deshacer/rehacer.
 */
@Component({
  selector: 'app-page-editor',
  standalone: true,
  imports: [NgStyle, CmsPageBlocks, CmsInspector],
  template: `
    <div class="editor">
      <div class="editor__barra">
        <div class="editor__grupo" role="group" aria-label="Vista previa por dispositivo">
          <button
            type="button"
            class="admin-btn"
            [class.admin-btn--activo]="editor.device() === 'desktop'"
            [attr.aria-pressed]="editor.device() === 'desktop'"
            (click)="setDevice('desktop')"
          >
            Escritorio
          </button>
          <button
            type="button"
            class="admin-btn"
            [class.admin-btn--activo]="editor.device() === 'tablet'"
            [attr.aria-pressed]="editor.device() === 'tablet'"
            (click)="setDevice('tablet')"
          >
            Tableta
          </button>
          <button
            type="button"
            class="admin-btn"
            [class.admin-btn--activo]="editor.device() === 'mobile'"
            [attr.aria-pressed]="editor.device() === 'mobile'"
            (click)="setDevice('mobile')"
          >
            Móvil
          </button>
          <span class="editor__escala" aria-live="polite">
            Vista previa al {{ escalaTexto() }}
          </span>
        </div>

        <div class="editor__grupo">
          <select
            [value]="newType()"
            (change)="newType.set($any($event.target).value)"
            aria-label="Tipo de bloque a agregar"
          >
            @for (cat of categorias(); track cat) {
              <optgroup [label]="cat">
                @for (b of bloquesDe(cat); track b.type) {
                  <option [value]="b.type">{{ b.label }}</option>
                }
              </optgroup>
            }
          </select>
          <button type="button" class="admin-btn" (click)="addBlock()">Agregar bloque</button>
        </div>

        <div class="editor__grupo">
          <button type="button" class="admin-btn" (click)="undo()" [disabled]="!canUndo()">Deshacer</button>
          <button type="button" class="admin-btn" (click)="redo()" [disabled]="!canRedo()">Rehacer</button>
          <button
            type="button"
            class="admin-btn"
            (click)="alternarHistorial()"
            [disabled]="cargandoHistorial()"
          >
            {{ cargandoHistorial() ? 'Cargando…' : historial() !== null ? 'Cerrar historial' : 'Historial' }}
          </button>
        </div>
      </div>

      @if (historial(); as lista) {
        <section class="editor__historial" aria-label="Historial de publicaciones">
          <div class="editor__historial-cabecera">
            <h2>Historial</h2>
            <button type="button" class="admin-btn" (click)="alternarHistorial()">Cerrar</button>
          </div>
          @if (lista.length === 0) {
            <p>Esta página todavía no tiene publicaciones guardadas.</p>
          } @else {
            <ul>
              @for (revision of lista; track revision.id) {
                <li>
                  <span class="editor__historial-fecha">{{ fechaRevision(revision.creado_en) }}</span>
                  <span class="editor__historial-autor">{{ revision.autor || 'Sin autor' }}</span>
                  <button
                    type="button"
                    class="admin-btn"
                    (click)="restaurar(revision)"
                    [disabled]="restaurando() !== null"
                  >
                    {{ restaurando() === revision.id ? 'Restaurando…' : 'Restaurar' }}
                  </button>
                </li>
              }
            </ul>
          }
          @if (error()) {
            <p class="admin-banner admin-banner--error" role="alert">{{ error() }}</p>
          }
        </section>
      }

      <div class="editor__cuerpo">
        <div class="editor__preview" #marcoPreview>          <div
            class="editor__preview-inner"
            [style.width.px]="deviceWidth()"
            [style.zoom]="escala()"
            [ngStyle]="tema()"
          >
            <app-cms-page-blocks
              [slug]="slug()"
              [seleccionadoId]="selectedId() ?? ''"
              (bloqueSeleccionado)="selectBlock($event)"
            ></app-cms-page-blocks>
          </div>
        </div>

        <aside class="editor__inspector" aria-label="Inspector">
          @if (selectedIndex() != null) {
            <div class="editor__acciones-bloque" role="group" aria-label="Acciones del bloque seleccionado">
              <button type="button" class="admin-btn" (click)="duplicateBlock()">Duplicar</button>
              <button type="button" class="admin-btn" (click)="toggleHidden()">Ocultar</button>
              <button type="button" class="admin-btn" (click)="moveBlock(-1)" [disabled]="selectedIndex() === 0">
                Subir
              </button>
              <button
                type="button"
                class="admin-btn"
                (click)="moveBlock(1)"
                [disabled]="selectedIndex() === bloques().length - 1"
              >
                Bajar
              </button>
              <button type="button" class="admin-btn admin-btn--peligro" (click)="removeBlock()">Eliminar</button>
            </div>
            <app-cms-inspector [blockIndex]="selectedIndex()!"></app-cms-inspector>
          } @else {
            <p>Selecciona un bloque de la vista previa para editar sus campos.</p>
          }
        </aside>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .editor {
        display: grid;
        gap: var(--space-16, 1rem);
      }
      .editor__barra {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-12, 0.75rem);
        min-width: 0;
        padding: 0.6rem 0.8rem;
        border: 1px solid var(--color-borde);
        border-radius: 14px;
        background: var(--color-fondo);
        box-shadow: var(--shadow-sm);
      }
      .editor__grupo {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-8, 0.5rem);
        min-width: 0;
      }
      .editor__escala {
        font-size: var(--texto-sm, 0.875rem);
        color: var(--color-texto-suave);
        white-space: normal;
      }
      .editor__historial {
        border: 1px solid var(--color-borde);
        border-radius: var(--radio-tarjeta, 6px);
        padding: var(--space-16, 1rem);
        background: var(--color-superficie);
      }
      .editor__historial-cabecera {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-8, 0.5rem);
        margin-bottom: var(--space-8, 0.5rem);
      }
      .editor__historial-cabecera h2 {
        margin: 0;
        font-size: var(--texto-lg, 1.125rem);
      }
      .editor__historial ul {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: var(--space-4, 0.25rem);
      }
      .editor__historial li {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-8, 0.5rem);
        padding: var(--space-4, 0.25rem) 0;
        border-top: 1px solid var(--color-borde);
      }
      .editor__historial-fecha {
        font-variant-numeric: tabular-nums;
      }
      .editor__historial-autor {
        color: var(--color-texto-suave);
        flex: 1;
      }
      .editor__cuerpo {
        display: grid;
        grid-template-columns: minmax(0, 1.08fr) minmax(20rem, 0.92fr);
        gap: var(--space-16, 1rem);
        align-items: start;
      }
      @media (max-width: 1350px) {
        .editor__cuerpo {
          grid-template-columns: minmax(0, 1fr);
        }
        .editor__preview,
        .editor__inspector {
          position: static;
          max-height: none;
        }
      }
      .editor__preview {
        position: relative;
        overflow: auto;
        max-height: calc(100vh - 13rem);
        min-height: 20rem;
        padding: 3.25rem 0.75rem 0.75rem;
        background: var(--color-superficie);
        border: 1px solid var(--color-borde);
        border-radius: 14px;
        box-shadow: var(--shadow-sm);
      }
      .editor__preview::before {
        content: 'Vista previa del borrador';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        padding: 0.9rem 1rem;
        border-bottom: 1px solid var(--color-borde);
        background: var(--color-fondo);
        color: var(--color-primario);
        font-size: 0.64rem;
        font-weight: 800;
        letter-spacing: 0.1em;
        text-transform: uppercase;
      }
      .editor__preview-inner {
        margin: 0 auto;
        background: var(--color-fondo);
        box-shadow: var(--shadow-md);
        transition: width 0.15s ease;
      }
      .editor__inspector {
        position: sticky;
        top: 9.5rem;
        max-height: calc(100vh - 11rem);
        overflow-y: auto;
        padding: 1.25rem;
        border: 1px solid var(--color-borde);
        border-radius: 14px;
        background: var(--color-fondo);
        box-shadow: var(--shadow-sm);
        scrollbar-width: thin;
      }
      .editor__acciones-bloque {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-8, 0.5rem);
        padding-bottom: var(--space-12, 0.75rem);
        margin-bottom: var(--space-12, 0.75rem);
        border-bottom: 1px solid var(--color-borde);
      }
      .admin-btn--activo {
        background: var(--color-primario);
        color: var(--color-boton-texto, #fff);
        border-color: var(--color-primario);
      }
      select {
        border: 1px solid var(--color-borde);
        border-radius: 10px;
        background: var(--color-fondo);
        color: var(--color-texto);
        padding: 0.5rem 0.65rem;
        font: inherit;
        min-height: 2.5rem;
      }
      select:focus-visible {
        outline: 2px solid var(--color-primario);
        outline-offset: 2px;
      }
    `,
  ],
})
export class PageEditor implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private api = inject(CmsApiService);
  cms = inject(CmsContentService);
  editor = inject(CmsEditorService);
  private history = inject(CmsHistoryService);

  readonly slug = signal('inicio');
  readonly selectedId = signal<string | null>(null);
  readonly error = signal('');
  readonly status = signal('');
  readonly newType = signal('richText');
  readonly historial = signal<CmsRevision[] | null>(null);
  readonly cargandoHistorial = signal(false);
  readonly restaurando = signal<number | null>(null);

  /** Ancho disponible en la vista previa, en píxeles. */
  private readonly anchoDisponible = signal(0);
  private observador?: ResizeObserver;

  /**
   * Factor con el que se reduce la vista previa para que quepa sin scroll
   * horizontal. La maqueta conserva su ancho real (1200, 768 o 390) y se
   * muestra encogida para caber sin desplazamiento horizontal.
   */
  readonly escala = computed(() => {
    const ancho = this.anchoDisponible();
    if (ancho <= 0) {
      return 1;
    }
    return Math.min(1, ancho / this.deviceWidth());
  });

  /** El factor de escala, en porcentaje: la vista previa se muestra encogida. */
  readonly escalaTexto = computed(() => `${Math.round(this.escala() * 100)}%`);

  private sub?: Subscription;

  readonly bloques = computed(() => pageBlocks(this.cms.activeContent()));
  readonly selectedIndex = computed(() => {
    const id = this.selectedId();
    if (!id) {
      return null;
    }
    const index = this.bloques().findIndex((block) => block.id === id);
    return index >= 0 ? index : null;
  });
  readonly canUndo = computed(() => this.history.canUndo());
  readonly canRedo = computed(() => this.history.canRedo());
  /** Variables CSS del tema de la institución, para que la vista previa se vea como el sitio. */
  readonly tema = signal<Record<string, string>>({});

  ngOnInit(): void {
    this.editor.enable();
    // En una pantalla de teléfono, la vista previa útil es la de teléfono.
    if (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(max-width: 768px)').matches
    ) {
      this.editor.device.set('mobile');
    }
    this.cms.startEditingSession();
    if (!this.cms.loaded()) {
      void this.cms.loadAll();
    }
    void this.api
      .getApariencia()
      .then((res) => this.tema.set(temaPublico((res.contenido ?? {}) as Record<string, unknown>)))
      .catch((e: unknown) => {
        // Sin apariencia el editor sigue siendo usable (tema por defecto),
        // pero el fallo no debe pasar desapercibido.
        console.warn('No se pudo cargar la apariencia para la vista previa.', e);
      });
    this.sub = this.route.paramMap.subscribe((params) => {
      const slug = params.get('slug') || 'inicio';
      this.slug.set(slug);
      this.cms.useSlug(slug);
      this.selectedId.set(null);
      this.historial.set(null);
      this.error.set('');
    });
  }

  /**
   * Mide el marco de la vista previa para calcular la escala. Se llama desde
   * la plantilla, cuando el marco ya existe en el DOM. Si el entorno no
   * tiene ResizeObserver (por ejemplo, en las pruebas), la vista previa se
   * muestra a escala 1:1.
   */
  medirMarco(elemento: HTMLElement): void {
    this.observador?.disconnect();
    this.observador = undefined;
    if (typeof ResizeObserver === 'undefined') {
      return;
    }
    this.observador = new ResizeObserver((entradas) => {
      const ancho = entradas[0]?.contentRect.width ?? 0;
      this.anchoDisponible.set(Math.max(0, Math.floor(ancho)));
    });
    this.observador.observe(elemento);
  }

  ngOnDestroy(): void {
    this.editor.disable();
    this.cms.stopEditingSession();
    this.observador?.disconnect();
    this.sub?.unsubscribe();
  }

  setDevice(device: PreviewDevice): void {
    this.editor.device.set(device);
  }

  deviceWidth(): number {
    return this.editor.deviceWidth();
  }

  /**
   * Referencia al marco de la vista previa, para medirlo.
   */
  marcoPreview?: ElementRef<HTMLElement>;

  @ViewChild('marcoPreview')
  set marco(elemento: ElementRef<HTMLElement> | undefined) {
    this.marcoPreview = elemento;
    if (elemento) {
      this.medirMarco(elemento.nativeElement);
    }
  }

  deviceLabel(): string {
    switch (this.editor.device()) {
      case 'tablet':
        return 'Tableta';
      case 'mobile':
        return 'Móvil';
      default:
        return 'Escritorio';
    }
  }

  selectBlock(id: string): void {
    this.selectedId.set(id);
  }

  async alternarHistorial(): Promise<void> {
    if (this.historial() !== null) {
      this.historial.set(null);
      return;
    }
    this.cargandoHistorial.set(true);
    this.error.set('');
    try {
      this.historial.set(await this.cms.listarRevisiones(this.slug()));
    } catch {
      this.error.set('No se pudo cargar el historial de la página.');
      this.historial.set(null);
    } finally {
      this.cargandoHistorial.set(false);
    }
  }

  fechaRevision(iso: string | null | undefined): string {
    if (!iso) {
      return '—';
    }
    const fecha = new Date(iso);
    return Number.isNaN(fecha.getTime()) ? '—' : fecha.toLocaleString('es-PE');
  }

  async restaurar(revision: CmsRevision): Promise<void> {
    if (this.restaurando() !== null) {
      return;
    }
    this.restaurando.set(revision.id);
    this.error.set('');
    try {
      await this.cms.restaurarRevision(this.slug(), revision.id);
      this.historial.set(null);
    } catch {
      this.error.set('No se pudo restaurar la revisión. Recarga la página e inténtalo de nuevo.');
    } finally {
      this.restaurando.set(null);
    }
  }

  categorias(): string[] {
    return [...new Set(BLOCK_TYPES.map((b) => b.category))];
  }

  bloquesDe(categoria: string) {
    return BLOCK_TYPES.filter((b) => b.category === categoria);
  }

  addBlock(): void {
    this.cms.addBlock(this.newType());
  }

  duplicateBlock(): void {
    const index = this.selectedIndex();
    if (index != null) {
      this.cms.duplicateBlock(index);
    }
  }

  removeBlock(): void {
    const index = this.selectedIndex();
    if (index != null) {
      this.cms.removeBlock(index);
      this.selectedId.set(null);
    }
  }

  toggleHidden(): void {
    const index = this.selectedIndex();
    if (index == null) {
      return;
    }
    const blocks = [...pageBlocks(this.cms.activeContent())];
    blocks[index] = { ...blocks[index], hidden: !blocks[index].hidden };
    this.cms.set('blocks', blocks);
  }

  moveBlock(delta: number): void {
    const index = this.selectedIndex();
    if (index == null) {
      return;
    }
    const blocks = [...pageBlocks(this.cms.activeContent())];
    const to = index + delta;
    if (to < 0 || to >= blocks.length) {
      return;
    }
    const [moved] = blocks.splice(index, 1);
    blocks.splice(to, 0, moved);
    this.cms.set('blocks', blocks);
  }

  undo(): void {
    this.cms.undo();
  }

  redo(): void {
    this.cms.redo();
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    const objetivo = event.target as HTMLElement | null;
    if (objetivo && (objetivo.tagName === 'INPUT' || objetivo.tagName === 'TEXTAREA' || objetivo.isContentEditable)) {
      return;
    }
    const ctrl = event.ctrlKey || event.metaKey;
    if (!ctrl) {
      return;
    }
    if (event.shiftKey && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      this.redo();
    } else if (event.key.toLowerCase() === 'z') {
      event.preventDefault();
      this.undo();
    }
  }

  bloqueLabel(block: CmsBlock): string {
    return block.type;
  }
}
