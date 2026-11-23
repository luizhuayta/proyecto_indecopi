import { ChangeDetectionStrategy, Component, inject, signal, input, computed } from '@angular/core';
import { ContenidoStore } from '../../../../core/store/contenido.store';
import type { AboutContent } from '../../../../core/constants/about.constant';
import { AppSrc } from '../../../../core/directives/app-src';
import { AboutPillarId } from '../../../../core/constants/about.constant';
import { DialogComponent } from '../../../../shared/ui';

interface PillarCard {
  id: AboutPillarId;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-nosotros-pilares',
  standalone: true,
  imports: [DialogComponent, AppSrc],
  templateUrl: './pilares.html',
  styleUrl: './pilares.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Pilares {
  private readonly contenido = inject(ContenidoStore);
  readonly previewCopy = input<AboutContent | null>(null);

  readonly copy = computed(() =>
    this.previewCopy() ?? this.contenido.nosotros.value()
  );
  readonly pillars: readonly PillarCard[] = [
    { id: 'mision', label: 'Misión', icon: 'fa-bolt' },
    { id: 'vision', label: 'Visión', icon: 'fa-eye' },
    { id: 'valores', label: 'Valores', icon: 'fa-heart' },
    { id: 'organigrama', label: 'Organigrama', icon: 'fa-sitemap' },
  ];

  readonly active = signal<AboutPillarId | null>('mision');
  readonly viewerOpen = signal(false);

  toggle(id: AboutPillarId): void {
    this.active.update((current) => (current === id ? null : id));
  }
}
