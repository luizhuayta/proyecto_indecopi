// @vitest-environment jsdom
import '@angular/compiler';
import { getTestBed, TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CmsInspector } from './cms-inspector';
import { CmsContentService } from '../cms/cms-content.service';
import { CmsApiService } from '../cms/cms-api.service';
import { CmsHistoryService } from '../cms/cms-history.service';
import { CmsEditorService } from '../cms/cms-editor.service';
import { JsonMap } from '../cms/cms.models';

getTestBed().initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

describe('CmsInspector', () => {
  let content: CmsContentService;
  let fixture: ReturnType<typeof TestBed.createComponent<CmsInspector>>;

  /** Documento de la portada: un bloque pageHero con contenido real. */
  const documento: JsonMap = {
    titulo: 'Inicio',
    blocks: [
      {
        id: 'b1',
        type: 'pageHero',
        props: {
          badge: 'Admisión 2026',
          title: 'Formación profesional al alcance de todos',
          text: 'Programas técnicos y de formación.',
          cta: 'Ver oferta académica',
          ctaLink: '/oferta',
        },
      },
    ],
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        CmsApiService,
        CmsHistoryService,
        CmsEditorService,
        CmsContentService,
      ],
    });
    content = TestBed.inject(CmsContentService);
    content.useSlug('inicio');
    content.pages.set({ inicio: documento });
    fixture = TestBed.createComponent(CmsInspector);
    fixture.componentInstance.blockIndex = 0;
    fixture.detectChanges();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  function documentoDePrueba(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  /** Control del inspector cuya etiqueta visible coincide. */
  function controlDe(etiqueta: string): HTMLInputElement | HTMLTextAreaElement | null {
    const nodo = [...documentoDePrueba().querySelectorAll('label')].find(
      (n) => n.textContent?.trim() === etiqueta,
    );
    if (!nodo) {
      return null;
    }
    const id = nodo.getAttribute('for') ?? '';
    return documentoDePrueba().ownerDocument.getElementById(id) as
      | HTMLInputElement
      | HTMLTextAreaElement
      | null;
  }

  it('muestra el contenido real del bloque, no campos vacíos', () => {
    expect(controlDe('Título')?.value).toBe('Formación profesional al alcance de todos');
    expect(controlDe('Botón')?.value).toBe('Ver oferta académica');
    expect(controlDe('Etiqueta')?.value).toBe('Admisión 2026');
    expect(controlDe('Enlace del botón')?.value).toBe('/oferta');
  });

  it('escribe en la ruta real del bloque y no en una clave basura', () => {
    const campo = controlDe('Título');
    expect(campo).not.toBeNull();
    expect(campo!.id).toBe('campo-blocks-0-props-title');

    campo!.value = 'Nuevo titular';
    campo!.dispatchEvent(new Event('input'));

    const bloques = (content.pages()['inicio'] as JsonMap)['blocks'] as JsonMap[];
    expect(bloques[0]['props']).toMatchObject({ title: 'Nuevo titular' });
    expect(JSON.stringify(bloques[0])).not.toContain('[object Object]');
  });

  it('la ruta de cada campo apunta al bloque y a su propiedad', () => {
    const ids = [...documentoDePrueba().querySelectorAll('input, textarea')]
      .map((n) => n.getAttribute('id'))
      .filter((id): id is string => !!id);
    expect(ids.length).toBe(6);
    for (const id of ids) {
      expect(id).toMatch(/^campo-blocks-0-props-/);
    }
  });
});
