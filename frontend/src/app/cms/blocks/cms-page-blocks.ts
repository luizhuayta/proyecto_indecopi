import { Component, EventEmitter, Input, Output, computed, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { CmsContentService } from '../cms-content.service';
import { CmsEditorService } from '../cms-editor.service';
import { blockLabel, pageBlocks } from '../block-registry';
import type { CmsBlock } from '../block-registry';
import { renderBloque } from './render-bloque';

/**
 * Renderiza los bloques de una página.
 *
 * En modo edición (dentro del constructor visual) cada bloque se envuelve en
 * un contenedor enfocable que permite seleccionarlo y muestra una etiqueta con
 * su tipo; el HTML de la vista previa queda `aria-hidden` para no duplicar el
 * contenido a los lectores de pantalla (el inspector es la copia editable).
 * En modo lectura se muestra el contenido tal cual.
 */
@Component({
  selector: 'app-cms-page-blocks',
  standalone: true,
  template: `
    <div class="cms-bloques">
      @for (block of visibles(); track block.id) {
        <div
          class="bloque-host"
          [class.bloque-host--seleccionado]="editable() && seleccionadoId === block.id"
          [class.bloque-host--oculto]="block.hidden"
          [attr.data-block-id]="block.id"
          [tabindex]="editable() ? 0 : null"
          [attr.role]="editable() ? 'button' : null"
          [attr.aria-label]="editable() ? 'Seleccionar bloque ' + nombre(block.type) : null"
          [attr.aria-pressed]="editable() ? (seleccionadoId === block.id) : null"
          (click)="onSeleccionar(block)"
          (keydown.enter)="onSeleccionar(block)"
          (keydown.space)="onSeleccionar(block); $event.preventDefault()"
        >
          @if (editable()) {
            <div class="bloque-host__etiqueta" aria-hidden="true">
              {{ nombre(block.type) }}
              @if (block.hidden) {
                <span class="bloque-host__estado">oculto</span>
              }
            </div>
          }
          <div
            class="bloque-host__cuerpo"
            [attr.aria-hidden]="editable() || null"
            [innerHTML]="html(block)"
          ></div>
        </div>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .cms-bloques {
        display: block;
      }
      .bloque-host {
        position: relative;
      }
      .bloque-host:focus-visible {
        outline: 2px solid var(--color-primario);
        outline-offset: 2px;
      }
      .bloque-host--seleccionado::after {
        content: '';
        position: absolute;
        inset: 0;
        pointer-events: none;
        border: 2px solid var(--color-primario);
        z-index: 1;
      }
      .bloque-host--oculto .bloque-host__cuerpo {
        opacity: 0.45;
      }
      .bloque-host__etiqueta {
        position: absolute;
        top: 0.25rem;
        right: 0.25rem;
        z-index: 2;
        padding: 0.15rem 0.5rem;
        border-radius: var(--radio-campo, 4px);
        background: var(--color-primario);
        color: #fff;
        font-size: var(--texto-xs, 0.75rem);
        font-weight: 600;
      }
      .bloque-host__estado {
        margin-left: 0.35rem;
        opacity: 0.85;
      }
    `,
  ],
})
export class CmsPageBlocks {
  private cms = inject(CmsContentService);
  private editor = inject(CmsEditorService);
  private sanitizer = inject(DomSanitizer);

  @Input() slug = '';
  @Input() seleccionadoId = '';
  @Output() bloqueSeleccionado = new EventEmitter<string>();

  readonly editable = computed(() => this.editor.editMode());

  readonly bloques = computed(() => {
    const slug = this.slug || this.cms.currentSlug();
    const page = slug === 'sitio' ? this.cms.site() : (this.cms.pages()[slug] ?? {});
    return pageBlocks(page);
  });

  readonly visibles = computed(() => {
    const todos = this.bloques();
    if (this.editable()) {
      return todos;
    }
    return todos.filter((block) => !block.hidden);
  });

  html(block: CmsBlock): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(
      renderBloque(block, { imageMeta: this.cms.imageMeta() }),
    );
  }

  nombre(type: string): string {
    return blockLabel(type);
  }

  onSeleccionar(block: CmsBlock): void {
    if (this.editable()) {
      this.bloqueSeleccionado.emit(block.id);
    }
  }
}
