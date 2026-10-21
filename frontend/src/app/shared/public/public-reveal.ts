import { afterNextRender, Directive, ElementRef, inject, input, OnDestroy, signal } from '@angular/core';

/**
 * Revela un elemento al entrar en el viewport. Respeta `prefers-reduced-motion`:
 * si el usuario pide menos movimiento, el elemento se muestra directamente.
 */
@Directive({
  selector: '[appReveal]',
  standalone: true,
  host: {
    class: 'public-reveal',
    '[class.is-in]': 'shown()',
    '[style.--reveal-delay]': 'delay()',
  },
})
export class PublicReveal implements OnDestroy {
  private el = inject(ElementRef<HTMLElement>);
  readonly delay = input('0ms');
  readonly shown = signal(false);
  private observer?: IntersectionObserver;

  constructor() {
    afterNextRender(() => {
      const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reducido || typeof IntersectionObserver === 'undefined') {
        this.shown.set(true);
        return;
      }
      this.observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            this.shown.set(true);
            this.observer?.disconnect();
          }
        },
        { threshold: 0.08, rootMargin: '80px 0px 12% 0px' },
      );
      this.observer.observe(this.el.nativeElement);
    });
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}
