import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { INICIO_COPY } from '../../../../core/constants/inicio.constant';
import { ContenidoStore } from '../../../../core/store/contenido.store';
import { Hero } from './hero';

describe('Hero', () => {
  const images = [
    { src: '/images/primera.webp', alt: 'Primera imagen' },
    { src: '/images/segunda.webp', alt: 'Segunda imagen' },
    { src: '/images/tercera.webp', alt: 'Tercera imagen' },
  ];

  const crear = async () => {
    await TestBed.configureTestingModule({
      imports: [Hero],
      providers: [provideHttpClient(), provideRouter([])],
    }).compileComponents();
    const store = TestBed.inject(ContenidoStore);
    store.inicio.set({ ...INICIO_COPY, heroImages: images });
    const fixture = TestBed.createComponent(Hero);
    await fixture.whenStable();
    return { fixture, store, raiz: fixture.nativeElement as HTMLElement };
  };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    vi.stubGlobal('matchMedia', (media: string) => ({
      matches: false,
      media,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => true,
    }));
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('carga solo la primera imagen inicialmente y le da prioridad alta', async () => {
    const { raiz } = await crear();
    const slides = raiz.querySelectorAll<HTMLImageElement>('.hero-bg');
    expect(slides.length).toBe(1);
    expect(slides[0].getAttribute('fetchpriority')).toBe('high');
    expect(slides[0].getAttribute('loading')).toBe('eager');
  });

  it('prepara las demás imágenes con prioridad baja después de cargar la primera', async () => {
    const { fixture, raiz } = await crear();
    raiz.querySelector('.hero-bg')!.dispatchEvent(new Event('load'));
    await fixture.whenStable();
    const slides = raiz.querySelectorAll<HTMLImageElement>('.hero-bg');
    expect(slides.length).toBe(3);
    expect(slides[1].getAttribute('fetchpriority')).toBe('low');
    expect(slides[2].getAttribute('fetchpriority')).toBe('low');
  });

  it('mantiene la imagen actual si la siguiente todavía no está lista', async () => {
    const { fixture, raiz } = await crear();
    raiz.querySelector('.hero-bg')!.dispatchEvent(new Event('load'));
    await fixture.whenStable();
    await vi.advanceTimersByTimeAsync(7000);
    await fixture.whenStable();
    expect(raiz.querySelector('.hero-bg.active')?.getAttribute('alt')).toBe('Primera imagen');
  });

  it('avanza a la siguiente imagen cuando ya ha cargado', async () => {
    const { fixture, raiz } = await crear();
    raiz.querySelector('.hero-bg')!.dispatchEvent(new Event('load'));
    await fixture.whenStable();
    raiz.querySelectorAll('.hero-bg')[1].dispatchEvent(new Event('load'));
    await vi.advanceTimersByTimeAsync(3500);
    await fixture.whenStable();
    expect(raiz.querySelector('.hero-bg.active')?.getAttribute('alt')).toBe('Segunda imagen');
  });

  it('no bloquea el resto del carrusel si falla la primera imagen', async () => {
    const { fixture, raiz } = await crear();
    raiz.querySelector('.hero-bg')!.dispatchEvent(new Event('error'));
    await fixture.whenStable();
    expect(raiz.querySelectorAll('.hero-bg').length).toBe(3);
    raiz.querySelectorAll('.hero-bg')[1].dispatchEvent(new Event('load'));
    await vi.advanceTimersByTimeAsync(3500);
    await fixture.whenStable();
    expect(raiz.querySelector('.hero-bg.active')?.getAttribute('alt')).toBe('Segunda imagen');
  });

  it('omite una imagen fallida en vez de mostrar un hueco', async () => {
    const { fixture, raiz } = await crear();
    raiz.querySelector('.hero-bg')!.dispatchEvent(new Event('load'));
    await fixture.whenStable();
    const slides = raiz.querySelectorAll('.hero-bg');
    slides[1].dispatchEvent(new Event('error'));
    slides[2].dispatchEvent(new Event('load'));
    await vi.advanceTimersByTimeAsync(3500);
    await fixture.whenStable();
    expect(raiz.querySelector('.hero-bg.active')?.getAttribute('alt')).toBe('Tercera imagen');
  });

  it('respeta la preferencia de movimiento reducido', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const { fixture, raiz } = await crear();
    raiz.querySelector('.hero-bg')!.dispatchEvent(new Event('load'));
    await fixture.whenStable();
    raiz.querySelectorAll('.hero-bg')[1].dispatchEvent(new Event('load'));
    await vi.advanceTimersByTimeAsync(7000);
    await fixture.whenStable();
    expect(raiz.querySelector('.hero-bg.active')?.getAttribute('alt')).toBe('Primera imagen');
  });

  it('vuelve a la primera imagen si el CMS cambia el carrusel', async () => {
    const { fixture, store, raiz } = await crear();
    raiz.querySelector('.hero-bg')!.dispatchEvent(new Event('load'));
    await fixture.whenStable();
    raiz.querySelectorAll('.hero-bg')[1].dispatchEvent(new Event('load'));
    await vi.advanceTimersByTimeAsync(3500);
    await fixture.whenStable();
    store.inicio.set({ ...INICIO_COPY, heroImages: [images[2]] });
    await fixture.whenStable();
    expect(raiz.querySelector('.hero-bg.active')?.getAttribute('alt')).toBe('Tercera imagen');
  });
});
