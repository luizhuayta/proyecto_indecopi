import { ChangeDetectionStrategy, Component, viewChild } from '@angular/core';
import type { PuedeSalirConCambios } from '../../shared/aviso-cambios/salir-con-cambios';
import { ModuloEditor } from '../../shared/modulo-editor/modulo-editor';
import { AdminLivePreview } from '../../shared/admin-live-preview/admin-live-preview';
import { BECAS_SCHEMA, BECAS_TABS } from './becas.schema';

@Component({
  selector: 'app-admin-becas',
  standalone: true,
  imports: [ModuloEditor, AdminLivePreview],
  template: `
    <div class="live-editor-grid">
      <section class="live-editor-input">
    <app-modulo-editor
      #editor
      modulo="becas"
      titulo="Becas y créditos"
      descripcion="Gestiona la información y los documentos de becas y créditos."
      publicPath="/becas"
      [schema]="schema"
      [tabs]="tabs"
    />
      </section>
      <app-admin-live-preview
        modulo="becas"
        titulo="Becas y creditos"
        [borrador]="editor.draft()"
        [pestana]="editor.active()"
        [cambios]="dirty()"
      />
    </div>
  `,
  styleUrl: '../../shared/admin-live-preview/admin-live-layout.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminBecas implements PuedeSalirConCambios {
  readonly editor = viewChild<ModuloEditor>('editor');
  readonly schema = BECAS_SCHEMA;
  readonly tabs = BECAS_TABS;

  dirty(): boolean {
    return this.editor()?.dirty() ?? false;
  }

  confirmarSalida(): Promise<boolean> {
    return this.editor()?.confirmarSalida() ?? Promise.resolve(true);
  }
}
