import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import type { AboutContent } from '../../../core/constants/about.constant';
import { EditorModuloBase } from '../../shared/editor-modulo/editor-modulo-base';
import { EditorModuloMarco, type MarcoTab } from '../../shared/editor-modulo/editor-modulo-marco';
import { NosotrosPanelHistoria } from './panel-historia';
import { NosotrosPanelIdentidad } from './panel-identidad';
import { NosotrosPanelPilares } from './panel-pilares';
import { AdminLivePreview } from '../../shared/admin-live-preview/admin-live-preview';

const TABS: MarcoTab[] = [
  { id: 'identidad', label: 'Portada' },
  { id: 'pilares', label: 'Misión y visión' },
  { id: 'historia', label: 'Historia' },
];

@Component({
  selector: 'app-admin-nosotros',
  standalone: true,
  imports: [EditorModuloMarco, NosotrosPanelIdentidad, NosotrosPanelPilares, NosotrosPanelHistoria, AdminLivePreview],
  template: `
    <div class="live-editor-grid">
      <section class="live-editor-input">
    <app-editor-modulo-marco
      [editor]="this"
      titulo="Nosotros"
      sub="Actualiza la presentación institucional, misión, visión, organigrama e historia."
      publicPath="/nosotros"
      [tabs]="tabs"
      [(activa)]="activa"
    >
      @switch (activa()) {
        @case ('identidad') {
          <app-nosotros-panel-identidad
            [heroTitle]="draft().heroTitle"
            [heroLead]="draft().heroLead"
            (heroTitleChange)="parche({ heroTitle: $event })"
            (heroLeadChange)="parche({ heroLead: $event })"
          />
        }
        @case ('pilares') {
          <app-nosotros-panel-pilares
            [mission]="draft().mission"
            [vision]="draft().vision"
            [valuesText]="draft().valuesText"
            [organigramaSrc]="draft().organigrama.src"
            [organigramaAlt]="draft().organigrama.alt"
            (missionChange)="parche({ mission: $event })"
            (visionChange)="parche({ vision: $event })"
            (valuesTextChange)="parche({ valuesText: $event })"
            (organigramaSrcChange)="parcheOrganigrama('src', $event)"
            (organigramaAltChange)="parcheOrganigrama('alt', $event)"
            (pedirQuitarOrganigrama)="confirmarQuitarOrganigrama()"
          />
        }
        @case ('historia') {
          <app-nosotros-panel-historia
            [historyLead]="draft().historyLead"
            [imagenSrc]="draft().historiaImage.src"
            [imagenAlt]="draft().historiaImage.alt"
            [timeline]="draft().historyTimeline"
            (historyLeadChange)="parche({ historyLead: $event })"
            (imagenSrcChange)="parcheHistoriaImagen('src', $event)"
            (imagenAltChange)="parcheHistoriaImagen('alt', $event)"
            (timelineChange)="parche({ historyTimeline: $event })"
            (pedirQuitarImagen)="confirmarQuitarHistoriaImagen()"
          />
        }
      }
    </app-editor-modulo-marco>
      </section>

      <app-admin-live-preview
        modulo="nosotros"
        titulo="Nosotros"
        [borrador]="draft()"
        [pestana]="activa()"
        [cambios]="dirty()"
      />
    </div>
  `,
  styleUrl: '../../shared/admin-live-preview/admin-live-layout.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminNosotros extends EditorModuloBase<'nosotros'> {
  protected readonly moduloId = 'nosotros' as const;
  protected override mensajeGuardado =
    'Los cambios ya están publicados en la sección Nosotros de la web.';

  readonly tabs = TABS;
  readonly activa = signal('identidad');

  parcheOrganigrama(campo: 'src' | 'alt', valor: string): void {
    this.parche({ organigrama: { ...this.draft().organigrama, [campo]: valor } });
  }

  parcheHistoriaImagen(campo: 'src' | 'alt', valor: string): void {
    this.parche({ historiaImage: { ...this.draft().historiaImage, [campo]: valor } });
  }

  confirmarQuitarOrganigrama(): void {
    this.pedirConfirmacion({
      titulo: 'Quitar organigrama',
      detalle: 'La sección quedará sin organigrama hasta que suba una nueva imagen.',
      accion: () => this.parche({ organigrama: { src: '', alt: '' } }),
    });
  }

  confirmarQuitarHistoriaImagen(): void {
    this.pedirConfirmacion({
      titulo: 'Eliminar imagen de la historia',
      detalle: 'La reseña histórica quedará sin imagen hasta que suba una nueva.',
      accion: () => this.parche({ historiaImage: { src: '', alt: '' } }),
    });
  }

  private sinIndice<T>(lista: T[], index: number): T[] {
    return lista.filter((_, i) => i !== index);
  }
}

// Ayuda a las herramientas de tipos.
export type { AboutContent };
