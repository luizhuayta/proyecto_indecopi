import { Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { CmsContentService } from '../cms/cms-content.service';
import { CmsEditorService, PreviewDevice } from '../cms/cms-editor.service';
import { CmsHistoryService } from '../cms/cms-history.service';
import { BLOCK_TYPES, pageBlocks } from '../cms/block-registry';
import type { CmsBlock } from '../cms/block-registry';
import { CmsInspector } from './cms-inspector';
import { CmsPageBlocks } from '../cms/blocks/cms-page-blocks';

/**
 * Constructor visual de una página: vista previa por dispositivo, selección de
 * bloques al hacer clic, inspector de campos y acciones de bloque (agregar,
 * duplicar, ocultar, eliminar, mover) más deshacer/rehacer.
 */
@Component({
  selector: 'app-page-editor',
  standalone: true,
  imports: [CmsPageBlocks, CmsInspector],
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
        </div>

        @if (selectedIndex() != null) {
          <div class="editor__grupo" aria-label="Acciones del bloque seleccionado">
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
        }
      </div>

      <div class="editor__cuerpo">
        <div class="editor__preview" #marcoPreview>          <div
            class="editor__preview-inner"
            [style.width.px]="deviceWidth()"
            [style.zoom]="escala()"
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
        grid-template-rows: auto 1fr;
        gap: var(--space-16, 1rem);
        height: 100%;
      }
      .editor__barra {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-12, 0.75rem);
        align-items: center;
      }
      .editor__grupo {
        display: flex;
        gap: var(--space-8, 0.5rem);
        align-items: center;
      }
      .editor__cuerpo {
        display: grid;
        grid-template-columns: 1fr minmax(18rem, 24rem);
        gap: var(--space-16, 1rem);
        align-items: start;
      }
      @media (max-width: 900px) {
        .editor__cuerpo {
          grid-template-columns: 1fr;
        }
      }
      .editor__preview {
        background: var(--color-fondo);
        border: 1px solid var(--color-borde);
        border-radius: var(--radio-tarjeta, 6px);
        overflow: auto;
        min-height: 20rem;
      }
      .editor__preview-inner {
        margin: 0 auto;
        transition: width 0.15s ease;
      }
      .editor__inspector {
        border: 1px solid var(--color-borde);
        border-radius: var(--radio-tarjeta, 6px);
        padding: var(--space-16, 1rem);
        background: var(--color-superficie);
      }
      .admin-btn {
        border: 1px solid var(--color-borde);
        background: var(--color-superficie);
        color: var(--color-texto);
        border-radius: var(--radio-campo, 4px);
        padding: 0.4rem 0.75rem;
        font: inherit;
        cursor: pointer;
      }
      .admin-btn:hover {
        border-color: var(--color-secundario);
      }
      .admin-btn:focus-visible,
      select:focus-visible {
        outline: 2px solid var(--color-primario);
        outline-offset: 2px;
      }
      .admin-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .admin-btn--activo {
        background: var(--color-primario);
        color: #fff;
        border-color: var(--color-primario);
      }
      .admin-btn--peligro {
        color: var(--color-acento);
      }
      select {
        border: 1px solid var(--color-borde);
        border-radius: var(--radio-campo, 4px);
        background: var(--color-superficie);
        color: var(--color-texto);
        padding: 0.4rem 0.5rem;
        font: inherit;
      }
    `,
  ],
})
export class PageEditor implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  cms = inject(CmsContentService);
  editor = inject(CmsEditorService);
  private history = inject(CmsHistoryService);

  readonly slug = signal('inicio');
  readonly selectedId = signal<string | null>(null);
  readonly error = signal('');
  readonly status = signal('');
  readonly newType = signal('richText');

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

  ngOnInit(): void {
    this.editor.enable();
    this.cms.startEditingSession();
    if (!this.cms.loaded()) {
      void this.cms.loadAll();
    }
    this.sub = this.route.paramMap.subscribe((params) => {
      const slug = params.get('slug') || 'inicio';
      this.slug.set(slug);
      this.cms.useSlug(slug);
      this.selectedId.set(null);
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
