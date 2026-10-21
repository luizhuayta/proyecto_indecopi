// @vitest-environment jsdom
import '@angular/compiler';
import { getTestBed, TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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

  it('los bloques ocultos no se renderizan', () => {
    sembrar([makeBlock('cta'), makeBlock('stats', undefined, true)]);
    const secciones = fixture.nativeElement.querySelectorAll('.bloque');
    expect(secciones.length).toBe(1);
    expect(fixture.nativeElement.textContent).not.toContain('Años');
  });
});
