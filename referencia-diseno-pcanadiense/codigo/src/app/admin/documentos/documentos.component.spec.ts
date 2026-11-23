import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { PortalApi } from '../../core/api/portal.api';
import type { DocumentoInstitucional } from '../../core/models/documento.model';
import { DocumentosStore } from '../../core/store/documentos.store';
import { AdminDocumentosComponent } from './documentos.component';

describe('AdminDocumentosComponent', () => {
  const documento: DocumentoInstitucional = {
    id: 'documento-quill',
    modulo: 'admision',
    seccion: 'documentos',
    titulo: 'Reglamento',
    descripcion: '<p>Proceso&nbsp;de admisión &amp; matrícula.</p>',
    tipo: 'pdf',
    url: '/docs/reglamento.pdf',
    orden: 1,
    estado: 'publicado',
    actualizadoEn: '2026-08-23T00:00:00Z',
  };

  afterEach(() => TestBed.resetTestingModule());

  it('muestra la descripción Quill como texto sin modificar el documento', async () => {
    await TestBed.configureTestingModule({
      imports: [AdminDocumentosComponent],
      providers: [
        provideHttpClient(),
        provideRouter([]),
        { provide: PortalApi, useValue: { documentos: async () => [documento] } },
      ],
    }).compileComponents();
    const store = TestBed.inject(DocumentosStore);
    await store.hidratar(false);
    const fixture = TestBed.createComponent(AdminDocumentosComponent);
    await fixture.whenStable();
    const raiz = fixture.nativeElement as HTMLElement;
    expect(raiz.querySelector('tbody .form-hint')?.textContent).toBe(
      'Proceso de admisión & matrícula.',
    );
    expect(store.lista()[0].descripcion).toBe(
      '<p>Proceso&nbsp;de admisión &amp; matrícula.</p>',
    );
  });
});
