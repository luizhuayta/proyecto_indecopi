import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AvisoBeta } from '../../shared/aviso-beta/aviso-beta';

/**
 * Los textos del repositorio siguen en preparación: por ahora se muestra un
 * marcador «Beta». El esquema anterior se conserva en `repositorio-copy.schema.ts`.
 */
import { ServiceLivePreview } from '../../shared/service-live-preview/service-live-preview';

@Component({
  selector: 'app-admin-repositorio-copy',
  standalone: true,
  imports: [AvisoBeta, ServiceLivePreview],
  template: `
    <div class="live-editor-grid">
      <section class="live-editor-input">
    <app-aviso-beta
      titulo="Textos del repositorio"
      sub="Editor en preparación."
      mensaje="El repositorio institucional todavía se está armando. Cuando esté listo podrá editar aquí los textos de la página; por ahora no hay nada que cambiar."
      publicPath="/repositorio"
    />
      </section>
      <app-service-live-preview
        modulo="repositorio-copy"
        titulo="Repositorio"
        [borrador]="null"
      />
    </div>
  `,
  styleUrl: '../../shared/admin-live-preview/admin-live-layout.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminRepositorioCopy {}
