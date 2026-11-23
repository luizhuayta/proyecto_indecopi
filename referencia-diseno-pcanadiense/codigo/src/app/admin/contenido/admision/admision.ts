
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
  viewChild,
} from '@angular/core';

import {
  normalizarAdmision,
  type AdmissionContent,
} from '../../../core/constants/admission.constant';

import { Proceso } from '../../../features/admision/components/proceso/proceso';

import type {
  PuedeSalirConCambios,
} from '../../shared/aviso-cambios/salir-con-cambios';

import { ModuloEditor } from '../../shared/modulo-editor/modulo-editor';

import {
  ADMISION_SCHEMA,
  ADMISION_TABS,
} from './admision.schema';

@Component({
  selector: 'app-admin-admision',
  standalone: true,
  imports: [ModuloEditor, Proceso],

  template: `
    <div class="admision-live-studio">

      <section class="admision-form-panel">

        <app-modulo-editor
          #editor
          modulo="admision"
          titulo="Admisión"
          descripcion="Organiza los requisitos, textos y documentos del proceso de admisión."
          publicPath="/admision"
          [schema]="schema"
          [tabs]="tabs"
        />

      </section>

      <aside class="admision-preview-panel">

        <header class="preview-heading">
          <div>
            <span class="preview-overline">
              VISTA PREVIA DEL BORRADOR
            </span>

            <h2>
              <i class="fa fa-display" aria-hidden="true"></i>
              Admisión en tiempo real
            </h2>

            <p>
              Los cambios se reflejan mientras editas,
              sin modificar la página publicada.
            </p>
          </div>

          <div class="preview-actions">

            @if (tieneCambios()) {
              <span class="draft-state">
                <i class="fa fa-circle" aria-hidden="true"></i>
                Sin guardar
              </span>
            } @else {
              <span class="saved-state">
                <i class="fa fa-check-circle" aria-hidden="true"></i>
                Guardado
              </span>
            }

            <a
              href="/admision"
              target="_blank"
              rel="noopener noreferrer"
              class="open-page"
            >
              <i class="fa fa-arrow-up-right-from-square"></i>
              Abrir publicada
            </a>

          </div>
        </header>

        <div class="preview-controls">
          <span>Vista escritorio · Página real</span>

          <div class="preview-zoom">
            <button
              type="button"
              aria-label="Alejar vista"
              (click)="alejar()">
              <i class="fa fa-minus"></i>
            </button>

            <span>{{ (zoom() * 100).toFixed(0) }}%</span>

            <button
              type="button"
              aria-label="Acercar vista"
              (click)="acercar()">
              <i class="fa fa-plus"></i>
            </button>
          </div>
        </div>

        <div class="preview-scroll">

          <div
            class="preview-scaled"
            [style.zoom]="zoom()"
            [style.width.%]="100 / zoom()"
          >
            <app-admision-proceso
              class="preview-mode"
              [previewCopy]="borrador()"
              [previewTab]="pestana()"
            />
          </div>

        </div>

        <footer class="preview-footer">
          <i class="fa fa-circle-info" aria-hidden="true"></i>
          Esta vista usa el componente público original de Admisión.
          Guarda los cambios desde el formulario de la izquierda.
        </footer>

      </aside>

    </div>
  `,

  styleUrl: './admision.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminAdmision implements PuedeSalirConCambios {
  private readonly editor = viewChild<ModuloEditor>('editor');

  readonly schema = ADMISION_SCHEMA;
  readonly tabs = ADMISION_TABS;

  readonly zoom = signal(0.75);

  readonly borrador = computed<AdmissionContent | null>(() => {
    const editor = this.editor();

    if (!editor) return null;

    const data = editor.draft();

    if (
      !data ||
      typeof data !== 'object' ||
      Array.isArray(data)
    ) {
      return null;
    }

    return normalizarAdmision(data);
  });

  readonly pestana = computed(
    () => this.editor()?.active() ?? 'convocatoria'
  );

  readonly tieneCambios = computed(
    () => this.editor()?.dirty() ?? false
  );

  acercar(): void {
    this.zoom.update(value =>
      Math.min(1, Number((value + 0.05).toFixed(2)))
    );
  }

  alejar(): void {
    this.zoom.update(value =>
      Math.max(0.5, Number((value - 0.05).toFixed(2)))
    );
  }

  dirty(): boolean {
    return this.editor()?.dirty() ?? false;
  }

  confirmarSalida(): Promise<boolean> {
    return (
      this.editor()?.confirmarSalida() ??
      Promise.resolve(true)
    );
  }
}
