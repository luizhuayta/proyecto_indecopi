import { AppSrc } from '../../../../core/directives/app-src';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Reveal } from '../../../../core/directives/reveal';
import { ContenidoStore } from '../../../../core/store/contenido.store';
import type { InicioContent } from '../../../../core/constants/inicio.constant';

@Component({
  selector: 'app-inicio-otros-servicios',
  standalone: true,
  imports: [AppSrc, RouterLink, Reveal],
  templateUrl: './otros-servicios.html',
  styleUrl: './otros-servicios.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OtrosServicios {
  private readonly contenido = inject(ContenidoStore);
  readonly previewCopy = input<InicioContent | null>(null);

  readonly services = computed(() =>
    (this.previewCopy() ?? this.contenido.inicio.value()).services
  );
}
