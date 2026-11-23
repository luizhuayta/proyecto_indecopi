import { ChangeDetectionStrategy, Component, computed, inject, signal, input } from '@angular/core';
import { ContenidoStore } from '../../../../core/store/contenido.store';
import type { AboutContent } from '../../../../core/constants/about.constant';
import { AppSrc } from '../../../../core/directives/app-src';
import { htmlVacio } from '../../../../core/utils/html';
import { ButtonDirective } from '../../../../shared/ui';

@Component({
  selector: 'app-nosotros-historia',
  standalone: true,
  imports: [ButtonDirective, AppSrc],
  templateUrl: './historia.html',
  styleUrl: './historia.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Historia {
  private readonly contenido = inject(ContenidoStore);
  readonly previewCopy = input<AboutContent | null>(null);

  readonly copy = computed(() =>
    this.previewCopy() ?? this.contenido.nosotros.value()
  );
  readonly expanded = signal(false);
  readonly tieneCronologia = computed(() => !htmlVacio(this.copy().historyTimeline));
}
