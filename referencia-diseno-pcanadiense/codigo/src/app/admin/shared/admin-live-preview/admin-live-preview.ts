import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';

import { PageHero } from '../../../shared/components/page-hero/page-hero';
import { ContenidoStore, type ContentByModulo } from '../../../core/store/contenido.store';
import { InstitutionService } from '../../../core/services/institution.service';

import type {
  InstitutionFees,
  InstitutionBankAccount,
} from '../../../core/constants/institution.constant';

import { Visor as VisorBecas } from '../../../features/becas/components/visor/visor';
import { Visor as VisorCostos } from '../../../features/costos/components/visor/visor';
import { Visor as VisorEstadisticas } from '../../../features/estadisticas/components/visor/visor';
import { Visor as VisorHorarios } from '../../../features/horarios/components/visor/visor';
import { Visor as VisorInversiones } from '../../../features/inversiones/components/visor/visor';
import { Visor as VisorLicenciamiento } from '../../../features/licenciamiento/components/visor/visor';
import { InicioComponent } from '../../../features/inicio/inicio.component';
import { Nosotros } from '../../../features/nosotros/nosotros';

export type ModuloVista =
  | 'becas'
  | 'costos'
  | 'estadisticas'
  | 'horarios'
  | 'inversiones'
  | 'licenciamiento'
  | 'inicio'
  | 'nosotros';

@Component({
  selector: 'app-admin-live-preview',
  standalone: true,

  imports: [
    PageHero,
    VisorBecas,
    VisorCostos,
    VisorEstadisticas,
    VisorHorarios,
    VisorInversiones,
    VisorLicenciamiento,
    InicioComponent,
    Nosotros,
  ],

  template: `
    <section class="preview-shell">

      <header class="preview-header">
        <div>
          <span class="preview-label">
            {{ soloLectura() ? 'VISTA DEL PORTAL PUBLICO' : 'VISTA PREVIA DEL BORRADOR' }}
          </span>

          <h2>
            <i class="fa fa-display" aria-hidden="true"></i>
            {{ titulo() }}
          </h2>

          <p>
            {{ soloLectura() ? 'Consulta del contenido publicado.' : 'Los cambios aparecen sin guardar ni publicar.' }}
          </p>
        </div>

        <span
          class="preview-state"
          [class.pending]="cambios()"
        >
          <i
            class="fa"
            [class.fa-circle]="cambios()"
            [class.fa-check-circle]="!cambios()"
          ></i>
          {{ cambios() ? 'Sin guardar' : 'Sin cambios' }}
        </span>
      </header>

      <nav class="preview-toolbar" aria-label="Vista previa">
        <span>
          Pagina publica real
        </span>

        <div class="preview-zoom">
          <button
            type="button"
            aria-label="Alejar"
            (click)="alejar()"
          >
            <i class="fa fa-minus"></i>
          </button>

          <strong>{{ (zoom() * 100).toFixed(0) }}%</strong>

          <button
            type="button"
            aria-label="Acercar"
            (click)="acercar()"
          >
            <i class="fa fa-plus"></i>
          </button>
        </div>
      </nav>

      <div class="preview-scroll">
        <div
          class="preview-scaled"
          [style.zoom]="zoom()"
          [style.width.%]="100 / zoom()"
        >

          @if (modulo() !== 'inicio' && modulo() !== 'nosotros') {
            <app-page-hero
              [title]="tituloPagina()"
              [subtitle]="institution.info().name"
            />
          }

          @switch (modulo()) {

            @case ('inicio') {
              <app-inicio [previewCopy]="inicioCopy()" />
            }

            @case ('nosotros') {
              <app-nosotros [previewCopy]="nosotrosCopy()" />
            }

            @case ('becas') {
              <app-becas-visor
                [previewCopy]="becasCopy()"
                [previewTab]="pestana()"
              />
            }

            @case ('costos') {
              <app-costos-visor
                [previewCopy]="costosCopy()"
                [previewTab]="pestana()"
                [previewFees]="fees()"
                [previewAccounts]="accounts()"
              />
            }

            @case ('estadisticas') {
              <app-estadisticas-visor
                [previewCopy]="estadisticasCopy()"
                [previewTab]="pestana()"
              />
            }

            @case ('horarios') {
              <app-horarios-visor
                [previewCopy]="horariosCopy()"
                [previewTab]="pestana()"
              />
            }

            @case ('inversiones') {
              <app-inversiones-visor
                [previewCopy]="inversionesCopy()"
                [previewTab]="pestana()"
              />
            }

            @case ('licenciamiento') {
              <app-licenciamiento-visor
                [previewCopy]="licenciamientoCopy()"
                [previewTab]="pestana()"
              />
            }
          }

        </div>
      </div>

      <footer class="preview-footer">
        <span>
          <i class="fa fa-circle-info"></i>
          {{ soloLectura() ? 'Contenido publicado' : 'Previsualizacion sin publicar' }}
        </span>

        <a
          [href]="'/' + modulo()"
          target="_blank"
          rel="noopener noreferrer"
        >
          <i class="fa fa-arrow-up-right-from-square"></i>
          Ver publicada
        </a>
      </footer>

    </section>
  `,

  styleUrl: './admin-live-preview.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminLivePreview {

  readonly institution = inject(InstitutionService);
  private readonly contenido = inject(ContenidoStore);

  readonly modulo = input.required<ModuloVista>();
  readonly titulo = input.required<string>();
  readonly borrador = input.required<unknown>();
  readonly pestana = input.required<string>();

  readonly cambios = input(false);
  readonly soloLectura = input(false);

  readonly fees = input<InstitutionFees | null>(null);
  readonly accounts = input<InstitutionBankAccount[] | null>(null);

  readonly zoom = signal(0.75);

  private valor<K extends ModuloVista>(
    modulo: K
  ): ContentByModulo[K] {

    const actual = this.borrador();

    if (
      this.modulo() === modulo &&
      actual !== null &&
      typeof actual === 'object' &&
      !Array.isArray(actual) &&
      Object.keys(actual).length > 0
    ) {
      return actual as ContentByModulo[K];
    }

    return this.contenido.de(modulo).value();
  }

  readonly becasCopy = computed(() => this.valor('becas'));
  readonly costosCopy = computed(() => this.valor('costos'));
  readonly estadisticasCopy = computed(() => this.valor('estadisticas'));
  readonly horariosCopy = computed(() => this.valor('horarios'));
  readonly inversionesCopy = computed(() => this.valor('inversiones'));
  readonly licenciamientoCopy = computed(() => this.valor('licenciamiento'));
  readonly inicioCopy = computed(() => this.valor('inicio'));
  readonly nosotrosCopy = computed(() => this.valor('nosotros'));

  readonly tituloPagina = computed(() => {
    const data = this.borrador();

    if (
      data &&
      typeof data === 'object' &&
      'heroTitle' in data &&
      typeof data.heroTitle === 'string'
    ) {
      return data.heroTitle;
    }

    return this.titulo();
  });

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
}