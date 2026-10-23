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

export interface RecortarMedioResult {
  url: string;
  ancho?: number | null;
  alto?: number | null;
  id: number;
}

/** Identidad de la institución (contrato GET/PUT /identidad). */
export interface Identidad {
  nombre: string;
  ruc: string;
  direccion: string;
  telefono: string;
  correo: string;
  ciudad: string;
  actualizado_en?: string | null;
}

/** Respuesta de apariencia (GET/PUT /configuracion/apariencia y publicar). */
export interface AparienciaResponse {
  contenido: JsonMap;
  version: number;
  actualizado_en?: string | null;
  tiene_borrador?: boolean;
  avisos?: Array<{ campo: string; mensaje: string }>;
}

/**
 * Elemento de la biblioteca de medios. El contrato del API trae `creado_en`;
 * `alt` se gestiona en el cliente (el servidor lo exige para imágenes con
 * contenido, pero aún no lo devuelve en este contrato).
 */
export interface MedioItem extends CmsMediaItem {
  creado_en?: string | null;
  alt?: string | null;
}

export interface ListarMediosResponse {
  items: MedioItem[];
}

/** Mensaje de contacto recibido desde el sitio público. */
export interface MensajeItem {
  id: number;
  tipo: string;
  asunto: string;
  ticket: string;
  estado: 'pendiente' | 'respondido' | 'archivado';
  respuesta: string;
  notificado: boolean;
  creado_en: string | null;
  nombre: string;
  correo: string;
  telefono: string;
  mensaje: string;
}

/** Resultado de responder un mensaje. */
export interface MensajeRespondido {
  id: number;
  estado: string;
  respuesta: string;
  notificado: boolean;
  correo: string;
}

/** Cuenta del panel (contrato GET /auth/usuarios). */
export interface UsuarioItem {
  id: number;
  usuario: string;
  rol: 'admin' | 'editor';
  activo: boolean;
  creado_en?: string | null;
}

/** Datos para crear una cuenta (POST /auth/usuarios). */
export interface CrearUsuarioBody {
  usuario: string;
  contrasena: string;
  rol: 'admin' | 'editor';
}

/** Cambios de una cuenta (PATCH /auth/usuarios/{id}). */
export interface ActualizarUsuarioBody {
  rol?: 'admin' | 'editor';
  activo?: boolean;
  contrasena?: string;
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

  // ---- Identidad ----

  getIdentidad(): Promise<Identidad> {
    return firstValueFrom(this.http.get<Identidad>(`${API_BASE}/identidad`));
  }

  guardarIdentidad(body: Partial<Identidad>): Promise<Identidad> {
    return firstValueFrom(this.http.put<Identidad>(`${API_BASE}/identidad`, body));
  }

  // ---- Apariencia ----

  getApariencia(): Promise<AparienciaResponse> {
    return firstValueFrom(this.http.get<AparienciaResponse>(`${API_BASE}/configuracion/apariencia`));
  }

  guardarApariencia(contenido: JsonMap, version: number): Promise<AparienciaResponse> {
    return firstValueFrom(
      this.http.put<AparienciaResponse>(`${API_BASE}/configuracion/apariencia`, { contenido, version })
    );
  }

  publicarApariencia(version: number): Promise<AparienciaResponse> {
    return firstValueFrom(
      this.http.post<AparienciaResponse>(`${API_BASE}/configuracion/apariencia/publicar`, { version })
    );
  }

  // ---- Mensajes ----

  listarMensajes(filtros: { tipo?: string; estado?: string } = {}): Promise<MensajeItem[]> {
    const params: Record<string, string> = { locale: LOCALE };
    if (filtros.tipo) params['tipo'] = filtros.tipo;
    if (filtros.estado) params['estado'] = filtros.estado;
    return firstValueFrom(
      this.http.get<{ items: MensajeItem[] }>(`${API_BASE}/mensajes`, { params })
    ).then((res) => res.items ?? []);
  }

  responderMensaje(id: number, respuesta: string, notificar: boolean): Promise<MensajeRespondido> {
    return firstValueFrom(
      this.http.post<MensajeRespondido>(
        `${API_BASE}/mensajes/${id}/responder`,
        { respuesta, notificar }
      )
    );
  }

  // ---- Usuarios ----

  listarUsuarios(): Promise<UsuarioItem[]> {
    return firstValueFrom(
      this.http.get<{ items: UsuarioItem[] }>(`${API_BASE}/auth/usuarios`)
    ).then((res) => res.items ?? []);
  }

  crearUsuario(body: CrearUsuarioBody): Promise<UsuarioItem> {
    return firstValueFrom(
      this.http.post<{ ok: boolean; item: UsuarioItem }>(`${API_BASE}/auth/usuarios`, body)
    ).then((res) => res.item);
  }

  actualizarUsuario(id: number, body: ActualizarUsuarioBody): Promise<UsuarioItem> {
    return firstValueFrom(
      this.http.patch<{ ok: boolean; item: UsuarioItem }>(`${API_BASE}/auth/usuarios/${id}`, body)
    ).then((res) => res.item);
  }

  // ---- Medios ----

  subirMedio(file: File): Promise<MedioItem> {
    const body = new FormData();
    body.append('file', file);
    return firstValueFrom(this.http.post<MedioItem>(`${API_BASE}/medios`, body));
  }

  listarMedios(): Promise<MedioItem[]> {
    return firstValueFrom(
      this.http.get<ListarMediosResponse>(`${API_BASE}/medios`)
    ).then((res) => res.items ?? []);
  }

  eliminarMedio(id: number): Promise<void> {
    return firstValueFrom(this.http.delete(`${API_BASE}/medios/${id}`)).then(() => undefined);
  }

  recortarMedio(body: RecortarMedioBody): Promise<RecortarMedioResult> {
    return firstValueFrom(
      this.http.post<RecortarMedioResult>(`${API_BASE}/medios/recortar`, body)
    );
  }
}
