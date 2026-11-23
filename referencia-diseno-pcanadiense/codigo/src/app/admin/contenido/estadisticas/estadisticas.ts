import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { EditorModuloBase } from '../../shared/editor-modulo/editor-modulo-base';
import { EditorEsquemaMarco } from '../../shared/editor-modulo/editor-esquema-marco';
import { AdminLivePreview } from '../../shared/admin-live-preview/admin-live-preview';
import { ESTADISTICAS_SCHEMA, ESTADISTICAS_TABS } from './estadisticas.schema';

@Component({
  selector: 'app-admin-estadisticas',
  standalone: true,
  imports: [EditorEsquemaMarco, AdminLivePreview],
  template: `
    <div class="live-editor-grid">
      <section class="live-editor-input">
    <app-editor-esquema-marco
      [editor]="this"
      modulo="estadisticas"
      titulo="Estadísticas"
      sub="Mantén actualizadas las cifras y los documentos estadísticos."
      publicPath="/estadisticas"
      [tabs]="tabs"
      [schema]="schema"
      [(activa)]="activa"
    />
      </section>

      <app-admin-live-preview
        modulo="estadisticas"
        titulo="Estadisticas"
        [borrador]="draft()"
        [pestana]="activa()"
        [cambios]="dirty()"
      />
    </div>
  `,
  styleUrl: '../../shared/admin-live-preview/admin-live-layout.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminEstadisticas extends EditorModuloBase<'estadisticas'> {
  protected readonly moduloId = 'estadisticas' as const;
  readonly schema = ESTADISTICAS_SCHEMA;
  readonly tabs = ESTADISTICAS_TABS;
  readonly activa = signal(ESTADISTICAS_TABS[0].id);
}
