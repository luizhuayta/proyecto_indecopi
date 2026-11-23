// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Carruseles, iniciarCarrusel } from './hero-carrusel';
import { renderBloque } from './render-bloque';
import { makeBlock } from '../block-registry';

function montarHero(n = 3): HTMLElement {
  const slides = Array.from({ length: n }, (_, i) => ({ badge: `B${i}`, title: `Banner ${i}`, image: `/m/${i}.webp` }));
  const raiz = document.createElement('div');
  raiz.innerHTML = renderBloque(makeBlock('hero', { slides }));
  document.body.appendChild(raiz);
  return raiz;
}
const activo = (raiz: HTMLElement) =>
  Array.from(raiz.querySelectorAll('.hero__slide')).findIndex((s) => s.classList.contains('hero__slide--activa'));

describe('carrusel del banner', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia;
  });
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('avanza solo y vuelve al inicio', () => {
    const raiz = montarHero(2);
    const detener = iniciarCarrusel(raiz.querySelector<HTMLElement>('.hero')!, 1000);
    vi.advanceTimersByTime(1000);
    expect(activo(raiz)).toBe(1);
    expect(raiz.querySelectorAll('.hero__slide')[0].hasAttribute('inert')).toBe(true);
    vi.advanceTimersByTime(1000);
    expect(activo(raiz)).toBe(0);
    detener();
  });

  it('el botón de pausa detiene y reanuda', () => {
    const raiz = montarHero();
    iniciarCarrusel(raiz.querySelector<HTMLElement>('.hero')!, 1000);
    const pausa = raiz.querySelector<HTMLButtonElement>('.hero__pausa')!;
    pausa.click();
    expect(pausa.getAttribute('aria-pressed')).toBe('true');
    expect(pausa.getAttribute('aria-label')).toBe('Reanudar carrusel');
    vi.advanceTimersByTime(5000);
    expect(activo(raiz)).toBe(0);
    pausa.click();
    vi.advanceTimersByTime(1000);
    expect(activo(raiz)).toBe(1);
  });

  it('los puntos llevan al banner elegido', () => {
    const raiz = montarHero();
    iniciarCarrusel(raiz.querySelector<HTMLElement>('.hero')!, 1000);
    raiz.querySelectorAll<HTMLButtonElement>('.hero__punto')[2].click();
    expect(activo(raiz)).toBe(2);
    expect(raiz.querySelectorAll('.hero__punto')[2].getAttribute('aria-current')).toBe('true');
  });

  it('con movimiento reducido arranca en pausa', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia;
    const raiz = montarHero();
    iniciarCarrusel(raiz.querySelector<HTMLElement>('.hero')!, 1000);
    vi.advanceTimersByTime(5000);
    expect(activo(raiz)).toBe(0);
    expect(raiz.querySelector('.hero__pausa')!.getAttribute('aria-pressed')).toBe('true');
  });

  it('con «Detener animaciones» del panel de accesibilidad arranca en pausa', () => {
    document.documentElement.classList.add('pa-sin-animaciones');
    const raiz = montarHero();
    iniciarCarrusel(raiz.querySelector<HTMLElement>('.hero')!, 1000);
    vi.advanceTimersByTime(5000);
    expect(activo(raiz)).toBe(0);
    expect(raiz.querySelector('.hero__pausa')!.getAttribute('aria-pressed')).toBe('true');
    document.documentElement.classList.remove('pa-sin-animaciones');
  });

  it('Carruseles inicia cada banner una vez y limpia los que salen del DOM', () => {
    const raiz = montarHero();
    const carruseles = new Carruseles(1000);
    carruseles.sincronizar(raiz);
    carruseles.sincronizar(raiz);
    vi.advanceTimersByTime(1000);
    expect(activo(raiz)).toBe(1); // un solo temporizador, no dos
    raiz.remove();
    carruseles.sincronizar(document.body);
    expect(vi.getTimerCount()).toBe(0);
  });
});
