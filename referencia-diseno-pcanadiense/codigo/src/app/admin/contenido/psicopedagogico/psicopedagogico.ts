import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { EditorEsquema } from '../../shared/editor-modulo/editor-esquema';
import { EditorModuloBase } from '../../shared/editor-modulo/editor-modulo-base';
import { EditorModuloMarco, type MarcoTab } from '../../shared/editor-modulo/editor-modulo-marco';
import { PanelServiciosBienestar } from '../../shared/panel-servicios-bienestar/panel-servicios-bienestar';
import { PSICOPEDAGOGICO_SCHEMA, PSICOPEDAGOGICO_TABS } from './psicopedagogico.schema';

const TABS: MarcoTab[] = PSICOPEDAGOGICO_TABS.map((t) => ({ id: t.id, label: t.label }));

import { ServiceLivePreview } from '../../shared/service-live-preview/service-live-preview';

@Component({
  selector: 'app-admin-psicopedagogico',
  standalone: true,
  imports: [ServiceLivePreview, EditorModuloMarco, EditorEsquema, PanelServiciosBienestar],
  template: `
    <div class="live-editor-grid">
      <section class="live-editor-input">
    <app-editor-modulo-marco
      [editor]="this"
      titulo="Psicopedagógico"
      sub="Los cambios guardados se actualizarán directamente en la página del servicio psicopedagógico."
      publicPath="/psicopedagogico"
      [tabs]="tabs"
      [(activa)]="activa"
    >
      @switch (activa()) {
        @case ('portada') {
          <app-editor-esquema [host]="this" titulo="Portada" [schema]="camposPortada()" />
        }
        @case ('servicios') {
          <app-panel-servicios-bienestar
            [items]="draft().servicios"
            (itemsChange)="parche({ servicios: $event })"
            (pedirEliminar)="confirmarEliminar($event)"
          />
        }
      }
    </app-editor-modulo-marco>
      </section>
      <app-service-live-preview
        modulo="psicopedagogico"
        titulo="Psicopedagogico"
        [borrador]="draft()"
        [cambios]="dirty()"
      />
    </div>
  `,
  styleUrl: '../../shared/admin-live-preview/admin-live-layout.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminPsicopedagogico extends EditorModuloBase<'psicopedagogico'> {
  protected readonly moduloId = 'psicopedagogico' as const;
  protected override mensajeGuardado =
    'Los cambios ya están publicados en la página del servicio psicopedagógico.';

  readonly tabs = TABS;
  readonly activa = signal(TABS[0].id);

  readonly camposPortada = computed(() =>
    PSICOPEDAGOGICO_SCHEMA.filter((campo) => campo.seccion === 'portada'),
  );

  confirmarEliminar(index: number): void {
    const nombre = this.draft().servicios[index]?.titulo?.trim();
    this.pedirConfirmacion({
      titulo: 'Eliminar servicio',
      detalle: nombre
        ? `Se eliminará el servicio «${nombre}». Esta acción no se puede deshacer.`
        : 'Se eliminará este servicio. Esta acción no se puede deshacer.',
      accion: () =>
        this.parche({ servicios: this.draft().servicios.filter((_, i) => i !== index) }),
    });
  }
}
