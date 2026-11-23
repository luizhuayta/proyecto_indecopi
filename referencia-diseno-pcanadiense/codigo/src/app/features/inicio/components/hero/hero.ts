import { AppSrc } from '../../../../core/directives/app-src';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { InstitutionService } from '../../../../core/services/institution.service';
import { ContenidoStore } from '../../../../core/store/contenido.store';
import type { InicioContent } from '../../../../core/constants/inicio.constant';

@Component({
  selector: 'app-inicio-hero',
  standalone: true,
  imports: [AppSrc, RouterLink],
  templateUrl: './hero.html',
  styleUrl: './hero.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Hero {
  private readonly institution = inject(InstitutionService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly contenido = inject(ContenidoStore);

  readonly info = this.institution.info;
  readonly previewCopy = input<InicioContent | null>(null);

  readonly copy = computed(() =>
    this.previewCopy() ?? this.contenido.inicio.value()
  );
  readonly heroImages = computed(() => this.copy().heroImages);

  readonly currentHeroIndex = signal(0);
  private readonly imageStates = signal<ReadonlyMap<string, boolean>>(new Map());
  readonly primeraResuelta = computed(() => {
    const primera = this.heroImages()[0];
    return !!primera && this.imageStates().has(primera.src);
  });

  private heroInterval: ReturnType<typeof setInterval> | null = null;
  private accessibilityObserver: MutationObserver | null = null;

  constructor() {
    effect(() => {
      this.heroImages();
      this.currentHeroIndex.set(0);
      this.updateSlideshowState();
    });

    afterNextRender(() => {
      this.observeAccessibility();
      this.updateSlideshowState();
    });

    this.destroyRef.onDestroy(() => {
      this.stopHeroSlideshow();
      this.accessibilityObserver?.disconnect();
    });
  }

  imagenCargada(src: string): void {
    // El fallback de AppSrc también dispara load; no cuenta como foto lista.
    if (this.imageStates().get(src) === false) return;
    this.imageStates.update((states) => new Map(states).set(src, true));
  }

  imagenFallida(src: string): void {
    this.imageStates.update((states) => new Map(states).set(src, false));
  }

  private observeAccessibility(): void {
    if (typeof document === 'undefined') return;

    this.accessibilityObserver = new MutationObserver(() => {
      this.updateSlideshowState();
    });

    this.accessibilityObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ['class'],
    });

    this.accessibilityObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
  }

  private updateSlideshowState(): void {
    if (typeof document === 'undefined') return;

    const detenido =
      document.body.classList.contains('ae-stop-animation') ||
      document.documentElement.classList.contains('ae-stop-animation');

    if (detenido) {
      this.stopHeroSlideshow();
      console.log('Hero detenido por accesibilidad');
    } else {
      this.startHeroSlideshow();
    }
  }

  private startHeroSlideshow(): void {
    if (typeof window === 'undefined') return;

    const detenido =
      document.body.classList.contains('ae-stop-animation') ||
      document.documentElement.classList.contains('ae-stop-animation');

    if (
      detenido ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      this.stopHeroSlideshow();
      return;
    }

    this.stopHeroSlideshow();

    if (this.heroImages().length <= 1) return;

    this.heroInterval = setInterval(() => {
      const images = this.heroImages();
      const states = this.imageStates();
      for (let offset = 1; offset < images.length; offset++) {
        const next = (this.currentHeroIndex() + offset) % images.length;
        const ready = states.get(images[next].src);
        if (ready === false) continue;
        // En una conexión lenta se conserva la imagen actual hasta que llegue la siguiente.
        if (ready === true) this.currentHeroIndex.set(next);
        break;
      }
    }, 3500);
  }

  private stopHeroSlideshow(): void {
    if (this.heroInterval !== null) {
      clearInterval(this.heroInterval);
      this.heroInterval = null;
    }
  }
}
