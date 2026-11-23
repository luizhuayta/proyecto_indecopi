// @vitest-environment jsdom
import '@angular/compiler';
import { getTestBed, TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CmsPageBlocks } from './cms-page-blocks';
import { CmsContentService } from '../cms-content.service';
import { CmsEditorService } from '../cms-editor.service';
import { makeBlock } from '../block-registry';
import type { CmsBlock } from '../block-registry';

getTestBed().initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

describe('CmsPageBlocks', () => {
  let fixture: ComponentFixture<CmsPageBlocks>;
  let cms: CmsContentService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [CmsPageBlocks],
      providers: [CmsContentService, CmsEditorService],
    });
    cms = TestBed.inject(CmsContentService);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  function sembrar(bloques: CmsBlock[]): void {
    cms.useSlug('inicio');
    cms.pages.set({ inicio: { blocks: bloques } });
    fixture = TestBed.createComponent(CmsPageBlocks);
    fixture.componentRef.setInput('slug', 'inicio');
    fixture.detectChanges();
  }

  it('renderiza todos los bloques visibles de la pagina', () => {
    sembrar([makeBlock('cta'), makeBlock('stats')]);
    const secciones = fixture.nativeElement.querySelectorAll('.bloque');
    expect(secciones.length).toBe(2);
  });

  it('en lectura cada bloque aparece al desplazar; en el editor no', () => {
    fixture = TestBed.createComponent(CmsPageBlocks);
    fixture.componentRef.setInput('documento', {
      blocks: [makeBlock('cta'), makeBlock('stats')],
    });
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelectorAll('.bloque-host.public-reveal'),
    ).toHaveLength(2);

    TestBed.inject(CmsEditorService).editMode.set(true);
    sembrar([makeBlock('cta')]);
    expect(
      fixture.nativeElement.querySelector('.bloque-host.public-reveal'),
    ).toBeNull();
  });

  it('los bloques ocultos no se renderizan', () => {
    sembrar([makeBlock('cta'), makeBlock('stats', undefined, true)]);
    const secciones = fixture.nativeElement.querySelectorAll('.bloque');
    expect(secciones.length).toBe(1);
    expect(fixture.nativeElement.textContent).not.toContain('Años');
  });

  it('el documento publico no usa el borrador ni activa controles editoriales', () => {
    sembrar([makeBlock('richText', { body: '<p>Borrador privado</p>' })]);
    TestBed.inject(CmsEditorService).enable();
    fixture.componentRef.setInput('documento', { blocks: [makeBlock('richText', { body: '<p>Publicado</p>' })] });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Publicado');
    expect(fixture.nativeElement.textContent).not.toContain('Borrador privado');
    expect(fixture.nativeElement.querySelector('[role="button"]')).toBeNull();
    fixture.componentRef.setInput('documento', { blocks: [makeBlock('richText', { body: '<p>Otra página</p>' })] });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Otra página');
    expect(fixture.nativeElement.textContent).not.toContain('Publicado');
  });

  const heroDoble = () => makeBlock('hero', { slides: [
    { badge: 'A', title: 'Uno', image: '/m/1.webp' }, { badge: 'B', title: 'Dos', image: '/m/2.webp' },
  ] });

  it('en lectura engancha el carrusel del banner', () => {
    vi.useFakeTimers();
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia;
    fixture = TestBed.createComponent(CmsPageBlocks);
    fixture.componentRef.setInput('documento', { blocks: [heroDoble()] });
    fixture.detectChanges();
    vi.advanceTimersByTime(6000);
    const slides = fixture.nativeElement.querySelectorAll('.hero__slide');
    expect(slides[1].classList).toContain('hero__slide--activa');
    vi.useRealTimers();
  });

  it('en el editor el banner no se mueve', () => {
    vi.useFakeTimers();
    TestBed.inject(CmsEditorService).editMode.set(true);
    sembrar([heroDoble()]);
    vi.advanceTimersByTime(6000);
    const slides = fixture.nativeElement.querySelectorAll('.hero__slide');
    expect(slides[0].classList).toContain('hero__slide--activa');
    vi.useRealTimers();
  });
});
