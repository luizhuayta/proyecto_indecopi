import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { EditorModuloBase } from '../../shared/editor-modulo/editor-modulo-base';
import { EditorEsquemaMarco } from '../../shared/editor-modulo/editor-esquema-marco';
import { AdminLivePreview } from '../../shared/admin-live-preview/admin-live-preview';
import { LICENCIAMIENTO_SCHEMA, LICENCIAMIENTO_TABS } from './licenciamiento.schema';

@Component({
  selector: 'app-admin-licenciamiento',
  standalone: true,
  imports: [EditorEsquemaMarco, AdminLivePreview],
  template: `
    <div class="live-editor-grid">
      <section class="live-editor-input">
    <app-editor-esquema-marco
      [editor]="this"
      modulo="licenciamiento"
      titulo="Licenciamiento"
      sub="Gestiona la información y los documentos del licenciamiento institucional."
      publicPath="/licenciamiento"
      [tabs]="tabs"
      [schema]="schema"
      [(activa)]="activa"
    />
      </section>

      <app-admin-live-preview
        modulo="licenciamiento"
        titulo="Licenciamiento"
        [borrador]="draft()"
        [pestana]="activa()"
        [cambios]="dirty()"
      />
    </div>
  `,
  styleUrl: '../../shared/admin-live-preview/admin-live-layout.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminLicenciamiento extends EditorModuloBase<'licenciamiento'> {
  protected readonly moduloId = 'licenciamiento' as const;
  readonly schema = LICENCIAMIENTO_SCHEMA;
  readonly tabs = LICENCIAMIENTO_TABS;
  readonly activa = signal(LICENCIAMIENTO_TABS[0].id);
}
