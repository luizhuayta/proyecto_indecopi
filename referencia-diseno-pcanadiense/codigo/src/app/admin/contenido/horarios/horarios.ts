import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { EditorModuloBase } from '../../shared/editor-modulo/editor-modulo-base';
import { EditorEsquemaMarco } from '../../shared/editor-modulo/editor-esquema-marco';
import { AdminLivePreview } from '../../shared/admin-live-preview/admin-live-preview';
import { HORARIOS_SCHEMA, HORARIOS_TABS } from './horarios.schema';

@Component({
  selector: 'app-admin-horarios',
  standalone: true,
  imports: [EditorEsquemaMarco, AdminLivePreview],
  template: `
    <div class="live-editor-grid">
      <section class="live-editor-input">
    <app-editor-esquema-marco
      [editor]="this"
      modulo="horarios"
      titulo="Horarios"
      sub="Edita la información y los documentos de los horarios institucionales."
      publicPath="/horarios"
      [tabs]="tabs"
      [schema]="schema"
      [(activa)]="activa"
    />
      </section>

      <app-admin-live-preview
        modulo="horarios"
        titulo="Horarios"
        [borrador]="draft()"
        [pestana]="activa()"
        [cambios]="dirty()"
      />
    </div>
  `,
  styleUrl: '../../shared/admin-live-preview/admin-live-layout.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminHorarios extends EditorModuloBase<'horarios'> {
  protected readonly moduloId = 'horarios' as const;
  readonly schema = HORARIOS_SCHEMA;
  readonly tabs = HORARIOS_TABS;
  readonly activa = signal(HORARIOS_TABS[0].id);
}
