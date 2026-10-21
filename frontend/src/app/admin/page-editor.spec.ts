// @vitest-environment jsdom
import '@angular/compiler';
import { getTestBed, TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PageEditor } from './page-editor';
import { CmsContentService } from '../cms/cms-content.service';
import { CmsEditorService } from '../cms/cms-editor.service';
import { CmsHistoryService } from '../cms/cms-history.service';
import { CmsApiService } from '../cms/cms-api.service';
import { makeBlock } from '../cms/block-registry';

getTestBed().initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

describe('PageEditor', () => {
  let fixture: ComponentFixture<PageEditor>;
  let component: PageEditor;
  let cms: CmsContentService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [PageEditor],
      providers: [
        provideHttpClient(),
        CmsApiService,
        CmsHistoryService,
        CmsContentService,
        CmsEditorService,
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of({ get: () => 'inicio' }) },
        },
      ],
    });
    cms = TestBed.inject(CmsContentService);

    cms.useSlug('inicio');
    cms.pages.set({ inicio: { blocks: [makeBlock('cta'), makeBlock('stats')] } });
    cms.loaded.set(true);

    fixture = TestBed.createComponent(PageEditor);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    TestBed.resetTestingModule();
  });

  it('seleccionar un bloque lo marca en la vista previa', () => {
    const hosts = fixture.nativeElement.querySelectorAll('.bloque-host');
    hosts[0].click();
    fixture.detectChanges();

    expect(component.selectedId()).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.bloque-host--seleccionado')).toBeTruthy();
  });

  it('el inspector muestra los campos del bloque seleccionado', () => {
    const hosts = fixture.nativeElement.querySelectorAll('.bloque-host');
    hosts[0].click();
    fixture.detectChanges();

    const inspector = fixture.nativeElement.querySelector('.editor__inspector');
    expect(inspector.textContent).toContain('Título');
  });

  it('cambiar de dispositivo cambia el ancho del marco', () => {
    expect(component.deviceWidth()).toBe(1200);

    component.setDevice('mobile');
    fixture.detectChanges();

    expect(component.deviceWidth()).toBe(390);
    const inner = fixture.nativeElement.querySelector('.editor__preview-inner');
    expect(inner.style.width).toBe('390px');
  });

  it('agregar un bloque lo anade a la pagina', () => {
    const antes = component.bloques().length;

    component.newType.set('about');
    component.addBlock();
    fixture.detectChanges();

    expect(component.bloques().length).toBe(antes + 1);
  });

  it('eliminar un bloque lo quita de la pagina', () => {
    const hosts = fixture.nativeElement.querySelectorAll('.bloque-host');
    hosts[0].click();
    fixture.detectChanges();
    const antes = component.bloques().length;

    component.removeBlock();
    fixture.detectChanges();

    expect(component.bloques().length).toBe(antes - 1);
  });
});
