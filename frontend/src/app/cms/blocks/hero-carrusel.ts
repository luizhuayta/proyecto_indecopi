/**
 * Carrusel del banner de portada. El HTML lo genera el renderizador como
 * cadena, así que el comportamiento se engancha después, sobre el DOM.
 * Cumple WCAG 2.2.2: todo lo que se mueve solo se puede pausar, y con
 * «reducir movimiento» arranca pausado.
 */
export const INTERVALO_HERO = 6000;

export function iniciarCarrusel(hero: HTMLElement, intervalo = INTERVALO_HERO): () => void {
  const slides = Array.from(hero.querySelectorAll<HTMLElement>('.hero__slide'));
  const puntos = Array.from(hero.querySelectorAll<HTMLButtonElement>('.hero__punto'));
  const pausa = hero.querySelector<HTMLButtonElement>('.hero__pausa');
  if (slides.length < 2) {
    return () => {};
  }
  let actual = 0;
  // Arranca pausado si el sistema pide menos movimiento o si el visitante
  // activó «Detener animaciones» en el panel de accesibilidad (clase pa-* en
  // <html>). Se mira al iniciar: el ajuste se guarda entre visitas.
  let pausado =
    (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false) ||
    document.documentElement.classList.contains('pa-sin-animaciones');
  let temporizador: ReturnType<typeof setInterval> | undefined;

  const mostrar = (i: number): void => {
    actual = (i + slides.length) % slides.length;
    slides.forEach((s, k) => {
      const visible = k === actual;
      s.classList.toggle('hero__slide--activa', visible);
      s.toggleAttribute('inert', !visible);
      if (visible) s.removeAttribute('aria-hidden');
      else s.setAttribute('aria-hidden', 'true');
    });
    puntos.forEach((p, k) => p.setAttribute('aria-current', String(k === actual)));
  };
  const detener = (): void => {
    clearInterval(temporizador);
    temporizador = undefined;
  };
  const arrancar = (): void => {
    detener();
    if (!pausado) temporizador = setInterval(() => mostrar(actual + 1), intervalo);
  };
  const pintarPausa = (): void => {
    pausa?.setAttribute('aria-pressed', String(pausado));
    pausa?.setAttribute('aria-label', pausado ? 'Reanudar carrusel' : 'Pausar carrusel');
  };
  const alPausar = (): void => {
    pausado = !pausado;
    pintarPausa();
    arrancar();
  };
  const alElegir = (e: Event): void => {
    mostrar(puntos.indexOf(e.currentTarget as HTMLButtonElement));
    arrancar();
  };

  pausa?.addEventListener('click', alPausar);
  puntos.forEach((p) => p.addEventListener('click', alElegir));
  // Mientras el visitante lee o usa el teclado dentro del banner, no cambia.
  hero.addEventListener('mouseenter', detener);
  hero.addEventListener('mouseleave', arrancar);
  hero.addEventListener('focusin', detener);
  hero.addEventListener('focusout', arrancar);
  pintarPausa();
  arrancar();

  return () => {
    detener();
    pausa?.removeEventListener('click', alPausar);
    puntos.forEach((p) => p.removeEventListener('click', alElegir));
    hero.removeEventListener('mouseenter', detener);
    hero.removeEventListener('mouseleave', arrancar);
    hero.removeEventListener('focusin', detener);
    hero.removeEventListener('focusout', arrancar);
  };
}

/** Lleva la cuenta de los carruseles vivos de una página: inicia los nuevos y limpia los que ya no están. */
export class Carruseles {
  private readonly activos = new Map<HTMLElement, () => void>();

  constructor(private readonly intervalo = INTERVALO_HERO) {}

  sincronizar(raiz: HTMLElement): void {
    for (const [hero, detener] of this.activos) {
      if (!hero.isConnected) {
        detener();
        this.activos.delete(hero);
      }
    }
    raiz.querySelectorAll<HTMLElement>('.hero[data-carrusel]').forEach((hero) => {
      if (!this.activos.has(hero)) this.activos.set(hero, iniciarCarrusel(hero, this.intervalo));
    });
  }

  detenerTodo(): void {
    this.activos.forEach((detener) => detener());
    this.activos.clear();
  }
}
