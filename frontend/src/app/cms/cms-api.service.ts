import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  API_BASE,
  LOCALE,
  CmsDocResponse,
  CmsMediaItem,
  CmsMenuItem,
  CmsPageSummary,
  CmsRevision,
  JsonMap,
} from './cms.models';
import { BLOCK_TYPES, PAGE_TEMPLATES } from './block-registry';
import type { BlockTypeDef, PageTemplateDef } from './block-registry';

export interface CrearPaginaBody {
  titulo: string;
  slug?: string;
  plantilla?: string;
  ruta?: string;
  mostrar_en_menu?: boolean;
}

export interface ActualizarMetaBody {
  titulo?: string;
  slug?: string;
  ruta?: string;
  mostrar_en_menu?: boolean;
  orden_menu?: number;
}

export interface RecortarMedioBody {
  url: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SubirMedioResult {
  url: string;
  ancho?: number | null;
  alto?: number | null;
  variantes?: CmsMediaItem['variantes'];
}

@Injectable({ providedIn: 'root' })
export class CmsApiService {
  private readonly http = inject(HttpClient);

  private locParams(): { locale: string } {
    return { locale: LOCALE };
  }

  /** Catálogo de bloques y plantillas, empaquetado localmente (bloques.json). */
  getCatalog(): { blocks: BlockTypeDef[]; templates: PageTemplateDef[] } {
    return { blocks: BLOCK_TYPES, templates: PAGE_TEMPLATES };
  }

  getPaginas(): Promise<{ paginas: CmsPageSummary[]; menu: CmsMenuItem[] }> {
    return firstValueFrom(
      this.http.get<{ paginas: CmsPageSummary[]; menu?: CmsMenuItem[] }>(`${API_BASE}/paginas`, {
        params: this.locParams(),
      })
    ).then((res) => ({ paginas: res.paginas ?? [], menu: res.menu ?? [] }));
  }

  getPagina(slug: string): Promise<CmsDocResponse> {
    return firstValueFrom(
      this.http.get<CmsDocResponse>(`${API_BASE}/paginas/${slug}`, { params: this.locParams() })
    );
  }

  guardarPagina(slug: string, contenido: JsonMap, version: number): Promise<CmsDocResponse> {
    return firstValueFrom(
      this.http.put<CmsDocResponse>(
        `${API_BASE}/paginas/${slug}`,
        { contenido, version },
        { params: this.locParams() }
      )
    );
  }

  publicarPagina(slug: string, version: number): Promise<CmsDocResponse> {
    return firstValueFrom(
      this.http.post<CmsDocResponse>(`${API_BASE}/paginas/${slug}/publicar`, { version })
    );
  }

  crearPagina(body: CrearPaginaBody): Promise<{
    pagina: CmsPageSummary;
    contenido: JsonMap;
    version: number;
  }> {
    return firstValueFrom(
      this.http.post<{ pagina: CmsPageSummary; contenido: JsonMap; version: number }>(
        `${API_BASE}/paginas`,
        body,
        { params: this.locParams() }
      )
    );
  }

  actualizarMeta(slug: string, body: ActualizarMetaBody): Promise<{ pagina: CmsPageSummary }> {
    return firstValueFrom(
      this.http.patch<{ pagina: CmsPageSummary }>(`${API_BASE}/paginas/${slug}/meta`, body, {
        params: this.locParams(),
      })
    );
  }

  eliminarPagina(slug: string): Promise<void> {
    return firstValueFrom(this.http.delete(`${API_BASE}/paginas/${slug}`)).then(() => undefined);
  }

  listarRevisiones(slug: string): Promise<CmsRevision[]> {
    return firstValueFrom(
      this.http.get<{ items: CmsRevision[] }>(`${API_BASE}/paginas/${slug}/revisiones`)
    ).then((res) => res.items ?? []);
  }

  restaurarRevision(slug: string, id: number, version: number): Promise<CmsDocResponse> {
    return firstValueFrom(
      this.http.post<CmsDocResponse>(
        `${API_BASE}/paginas/${slug}/revisiones/${id}/restaurar`,
        { version },
        { params: this.locParams() }
      )
    );
  }

  getConfiguracion(): Promise<CmsDocResponse> {
    return firstValueFrom(
      this.http.get<CmsDocResponse>(`${API_BASE}/configuracion`, { params: this.locParams() })
    );
  }

  guardarConfiguracion(contenido: JsonMap, version: number): Promise<CmsDocResponse> {
    return firstValueFrom(
      this.http.put<CmsDocResponse>(
        `${API_BASE}/configuracion`,
        { contenido, version },
        { params: this.locParams() }
      )
    );
  }

  publicarConfiguracion(version: number): Promise<CmsDocResponse> {
    return firstValueFrom(
      this.http.post<CmsDocResponse>(`${API_BASE}/configuracion/publicar`, { version })
    );
  }

  subirMedio(file: File): Promise<SubirMedioResult> {
    const body = new FormData();
    body.append('file', file);
    return firstValueFrom(this.http.post<SubirMedioResult>(`${API_BASE}/medios`, body));
  }

  eliminarMedio(id: number): Promise<void> {
    return firstValueFrom(this.http.delete(`${API_BASE}/medios/${id}`)).then(() => undefined);
  }

  recortarMedio(body: RecortarMedioBody): Promise<{ url: string; ancho?: number | null; alto?: number | null }> {
    return firstValueFrom(
      this.http.post<{ url: string; ancho?: number | null; alto?: number | null }>(
        `${API_BASE}/medios/recortar`,
        body
      )
    );
  }
}
