import { Component, EventEmitter, Input, Output, computed, inject, signal } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { CmsContentService } from '../cms-content.service';
import { CmsEditorService } from '../cms-editor.service';
import { blockLabel, pageBlocks } from '../block-registry';
import type { CmsBlock } from '../block-registry';
import { renderBloque } from './render-bloque';
import { FormularioContacto } from '../../public/formulario-contacto';
import { FormularioReclamo } from '../../public/formulario-reclamo';
import { JsonMap } from '../cms.models';
import { SitioPublicoService } from '../../core/sitio-publico.service';
import { contieneTokens, resolverTokensEnBloque } from '../../core/tokens';

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
  imports: [FormularioContacto, FormularioReclamo],
  template: `
    <div class="cms-bloques">
      @for (block of visibles(); track block.id) {
        <div
          class="bloque-host"
          [class.bloque-host--editable]="editable()"
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
          @if (esFormulario(block)) {
            <app-formulario-contacto
              [bloque]="block.props"
              [csrf]="csrf"
              [ruta]="ruta"
            />
          } @else if (esLibroReclamaciones(block)) {
            <app-formulario-reclamo
              [bloque]="block.props"
              [csrf]="csrf"
              [ruta]="ruta"
            />
          } @else {
            <div
              class="bloque-host__cuerpo"
              [attr.aria-hidden]="editable() || null"
              [innerHTML]="html(block)"
            ></div>
          }
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
        padding: 0.1rem 0.4rem;
        border: 1px solid var(--color-primario);
        border-radius: var(--radio-campo, 4px);
        background: var(--color-fondo);
        color: var(--color-primario);
        font-size: var(--texto-xs, 0.75rem);
        font-weight: 600;
        opacity: 0;
        transition: opacity 0.12s ease;
        pointer-events: none;
      }
      .bloque-host:hover > .bloque-host__etiqueta,
      .bloque-host:focus-visible > .bloque-host__etiqueta,
      .bloque-host--seleccionado > .bloque-host__etiqueta {
        opacity: 1;
      }
      .bloque-host--editable:hover {
        outline: 1px dashed var(--color-borde);
        outline-offset: -1px;
      }
      .bloque-host--seleccionado {
        outline: 2px solid var(--color-primario);
        outline-offset: -2px;
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
  /** Identidad publicada: la vista previa muestra los tokens ya resueltos. */
  private sitio = inject(SitioPublicoService);

  @Input() slug = '';
  @Input() seleccionadoId = '';
  @Input() csrf = '';
  @Input() ruta = '';
  private readonly documentoPublico = signal<JsonMap | null>(null);
  @Input() set documento(valor: JsonMap | null) { this.documentoPublico.set(valor); }
  @Output() bloqueSeleccionado = new EventEmitter<string>();

  readonly editable = computed(() => this.documentoPublico() === null && this.editor.editMode());

  esFormulario(block: CmsBlock): boolean {
    return block.type === 'contactForm';
  }

  /** El libro de reclamaciones lleva su propio formulario, no texto plano. */
  esLibroReclamaciones(block: CmsBlock): boolean {
    return block.type === 'claimsBook';
  }

  readonly bloques = computed(() => {
    const publicado = this.documentoPublico();
    if (publicado !== null) return pageBlocks(publicado);
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
    // La vista previa del editor recibe el contenido en crudo: los tokens de
    // la institución se resuelven aquí para que se vea lo mismo que verá el
    // visitante. El inspector sigue mostrando el texto con el token intacto,
    // para que guardarlo no destruya la sustitución.
    const bloque = this.bloqueParaVista(block);
    // El HTML lo genera el renderizador del catálogo: escapa los textos y solo
    // deja los embebidos validados por el servidor.
    return this.sanitizer.bypassSecurityTrustHtml(
      renderBloque(bloque, { imageMeta: this.cms.imageMeta() }),
    );
  }

  private bloqueParaVista(block: CmsBlock): CmsBlock {
    const identidad = this.sitio.identidad();
    if (identidad) {
      return resolverTokensEnBloque(block, identidad);
    }
    if (contieneTokens(block)) {
      // Todavía no se conoce la identidad: se pide una sola vez y la vista
      // previa se vuelve a pintar cuando llegue.
      void this.sitio.cargar();
    }
    return block;
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
