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
 * Elemento de la biblioteca de medios. El texto alternativo se edita en cada
 * bloque de imagen, donde se conoce el contexto de uso.
 */
export interface MedioItem extends CmsMediaItem {
  creado_en?: string | null;
}

export interface ListarMediosResponse {
  items: MedioItem[];
}

/** Versión archivada de un medio (cada recorte o restauración guarda la anterior). */
export interface MedioVersionItem {
  id: number;
  url: string;
  mime: string;
  tamano: number;
  ancho: number | null;
  alto: number | null;
  motivo: string;
  creado_en?: string | null;
}

export interface RestaurarMedioResult {
  url: string;
  id: number;
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
  documento?: string;
  mensaje: string;
  /** Página del sitio desde la que se reportó (solo en reportes de accesibilidad). */
  ruta?: string;
}

/** Resultado de responder un mensaje. */
export interface MensajeRespondido {
  id: number;
  estado: string;
  respuesta: string;
  notificado: boolean;
  correo: string;
}

/** Rol de una cuenta del panel. */
export type RolUsuario = 'admin' | 'editor' | 'secretaria';

/** Cuenta del panel (contrato GET /auth/usuarios). */
export interface UsuarioItem {
  id: number;
  usuario: string;
  rol: RolUsuario;
  activo: boolean;
  creado_en?: string | null;
}

/** Datos para crear una cuenta (POST /auth/usuarios). */
export interface CrearUsuarioBody {
  usuario: string;
  contrasena: string;
  rol: RolUsuario;
}

/** Cambios de una cuenta (PATCH /auth/usuarios/{id}). */
export interface ActualizarUsuarioBody {
  rol?: RolUsuario;
  activo?: boolean;
  contrasena?: string;
}

/** Noticia o comunicado tal como lo devuelve el panel (GET /noticias). */
export interface NoticiaAdmin {
  id: number;
  tipo: 'noticia' | 'comunicado';
  titulo: string;
  slug: string;
  ruta: string;
  categoria: string;
  resumen: string;
  cuerpo: string;
  imagen_url: string;
  imagen_alt: string;
  destacada: boolean;
  estado: 'borrador' | 'publicado';
  publicado_en: string | null;
  autor: string;
  actualizado_en: string | null;
}

/** Campos que se pueden enviar al crear o editar una noticia. */
export type NoticiaEntrada = Partial<
  Omit<NoticiaAdmin, 'id' | 'ruta' | 'autor' | 'actualizado_en'>
>;

/**
 * Un documento vacío llega del API como `[]` (un array PHP vacío). El panel
 * necesita un objeto para escribir rutas como `color_primario`; si se queda
 * como array, `JSON.stringify` descarta esas claves y el guardado miente.
 */
function contenidoComoMapa(valor: unknown): JsonMap {
  return valor !== null && typeof valor === 'object' && !Array.isArray(valor)
    ? (valor as JsonMap)
    : {};
}

function normalizarDocumento<T extends { contenido: JsonMap }>(
  documento: T,
): T {
  return { ...documento, contenido: contenidoComoMapa(documento.contenido) };
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
      this.http.get<{ paginas: CmsPageSummary[]; menu?: CmsMenuItem[] }>(
        `${API_BASE}/paginas`,
        {
          params: this.locParams(),
        },
      ),
    ).then((res) => ({ paginas: res.paginas ?? [], menu: res.menu ?? [] }));
  }

  getPagina(slug: string): Promise<CmsDocResponse> {
    return firstValueFrom(
      this.http.get<CmsDocResponse>(`${API_BASE}/paginas/${slug}`, {
        params: this.locParams(),
      }),
    ).then(normalizarDocumento);
  }

  guardarPagina(
    slug: string,
    contenido: JsonMap,
    version: number,
  ): Promise<CmsDocResponse> {
    return firstValueFrom(
      this.http.put<CmsDocResponse>(
        `${API_BASE}/paginas/${slug}`,
        { contenido, version },
        { params: this.locParams() },
      ),
    ).then(normalizarDocumento);
  }

  publicarPagina(slug: string, version: number): Promise<CmsDocResponse> {
    return firstValueFrom(
      this.http.post<CmsDocResponse>(`${API_BASE}/paginas/${slug}/publicar`, {
        version,
      }),
    ).then(normalizarDocumento);
  }

  crearPagina(body: CrearPaginaBody): Promise<{
    pagina: CmsPageSummary;
    contenido: JsonMap;
    version: number;
  }> {
    return firstValueFrom(
      this.http.post<{
        pagina: CmsPageSummary;
        contenido: JsonMap;
        version: number;
      }>(`${API_BASE}/paginas`, body, { params: this.locParams() }),
    ).then(normalizarDocumento);
  }

  actualizarMeta(
    slug: string,
    body: ActualizarMetaBody,
  ): Promise<{ pagina: CmsPageSummary }> {
    return firstValueFrom(
      this.http.patch<{ pagina: CmsPageSummary }>(
        `${API_BASE}/paginas/${slug}/meta`,
        body,
        {
          params: this.locParams(),
        },
      ),
    );
  }

  eliminarPagina(slug: string): Promise<void> {
    return firstValueFrom(this.http.delete(`${API_BASE}/paginas/${slug}`)).then(
      () => undefined,
    );
  }

  listarRevisiones(slug: string): Promise<CmsRevision[]> {
    return firstValueFrom(
      this.http.get<{ items: CmsRevision[] }>(
        `${API_BASE}/paginas/${slug}/revisiones`,
      ),
    ).then((res) => res.items ?? []);
  }

  restaurarRevision(
    slug: string,
    id: number,
    version: number,
  ): Promise<CmsDocResponse> {
    return firstValueFrom(
      this.http.post<CmsDocResponse>(
        `${API_BASE}/paginas/${slug}/revisiones/${id}/restaurar`,
        { version },
        { params: this.locParams() },
      ),
    ).then(normalizarDocumento);
  }

  getConfiguracion(): Promise<CmsDocResponse> {
    return firstValueFrom(
      this.http.get<CmsDocResponse>(`${API_BASE}/configuracion`, {
        params: this.locParams(),
      }),
    ).then(normalizarDocumento);
  }

  guardarConfiguracion(
    contenido: JsonMap,
    version: number,
  ): Promise<CmsDocResponse> {
    return firstValueFrom(
      this.http.put<CmsDocResponse>(
        `${API_BASE}/configuracion`,
        { contenido, version },
        { params: this.locParams() },
      ),
    ).then(normalizarDocumento);
  }

  publicarConfiguracion(version: number): Promise<CmsDocResponse> {
    return firstValueFrom(
      this.http.post<CmsDocResponse>(`${API_BASE}/configuracion/publicar`, {
        version,
      }),
    ).then(normalizarDocumento);
  }

  // ---- Identidad ----

  getIdentidad(): Promise<Identidad> {
    return firstValueFrom(this.http.get<Identidad>(`${API_BASE}/identidad`));
  }

  guardarIdentidad(body: Partial<Identidad>): Promise<Identidad> {
    return firstValueFrom(
      this.http.put<Identidad>(`${API_BASE}/identidad`, body),
    );
  }

  // ---- Apariencia ----

  getApariencia(): Promise<AparienciaResponse> {
    return firstValueFrom(
      this.http.get<AparienciaResponse>(`${API_BASE}/configuracion/apariencia`),
    ).then(normalizarDocumento);
  }

  guardarApariencia(
    contenido: JsonMap,
    version: number,
  ): Promise<AparienciaResponse> {
    return firstValueFrom(
      this.http.put<AparienciaResponse>(
        `${API_BASE}/configuracion/apariencia`,
        { contenido, version },
      ),
    ).then(normalizarDocumento);
  }

  publicarApariencia(version: number): Promise<AparienciaResponse> {
    return firstValueFrom(
      this.http.post<AparienciaResponse>(
        `${API_BASE}/configuracion/apariencia/publicar`,
        { version },
      ),
    ).then(normalizarDocumento);
  }

  // ---- Mensajes ----

  listarMensajes(
    filtros: { tipo?: string; estado?: string } = {},
  ): Promise<MensajeItem[]> {
    const params: Record<string, string> = { locale: LOCALE };
    if (filtros.tipo) params['tipo'] = filtros.tipo;
    if (filtros.estado) params['estado'] = filtros.estado;
    return firstValueFrom(
      this.http.get<{ items: MensajeItem[] }>(`${API_BASE}/mensajes`, {
        params,
      }),
    ).then((res) => res.items ?? []);
  }

  responderMensaje(
    id: number,
    respuesta: string,
    notificar: boolean,
  ): Promise<MensajeRespondido> {
    return firstValueFrom(
      this.http.post<MensajeRespondido>(
        `${API_BASE}/mensajes/${id}/responder`,
        { respuesta, notificar },
      ),
    );
  }

  archivarMensaje(id: number): Promise<{ id: number; estado: string }> {
    return firstValueFrom(
      this.http.post<{ id: number; estado: string }>(
        `${API_BASE}/mensajes/${id}/archivar`,
        {},
      ),
    );
  }

  // ---- Noticias ----

  listarNoticias(): Promise<NoticiaAdmin[]> {
    return firstValueFrom(
      this.http.get<{ items: NoticiaAdmin[] }>(`${API_BASE}/noticias`),
    ).then((r) => r.items ?? []);
  }

  crearNoticia(body: NoticiaEntrada): Promise<NoticiaAdmin> {
    return firstValueFrom(
      this.http.post<NoticiaAdmin>(`${API_BASE}/noticias`, body),
    );
  }

  actualizarNoticia(id: number, body: NoticiaEntrada): Promise<NoticiaAdmin> {
    return firstValueFrom(
      this.http.put<NoticiaAdmin>(`${API_BASE}/noticias/${id}`, body),
    );
  }

  eliminarNoticia(id: number): Promise<{ id: number }> {
    return firstValueFrom(
      this.http.delete<{ id: number }>(`${API_BASE}/noticias/${id}`),
    );
  }

  // ---- Usuarios ----

  listarUsuarios(): Promise<UsuarioItem[]> {
    return firstValueFrom(
      this.http.get<{ items: UsuarioItem[] }>(`${API_BASE}/auth/usuarios`),
    ).then((res) => res.items ?? []);
  }

  crearUsuario(body: CrearUsuarioBody): Promise<UsuarioItem> {
    return firstValueFrom(
      this.http.post<{ ok: boolean; item: UsuarioItem }>(
        `${API_BASE}/auth/usuarios`,
        body,
      ),
    ).then((res) => res.item);
  }

  actualizarUsuario(
    id: number,
    body: ActualizarUsuarioBody,
  ): Promise<UsuarioItem> {
    return firstValueFrom(
      this.http.patch<{ ok: boolean; item: UsuarioItem }>(
        `${API_BASE}/auth/usuarios/${id}`,
        body,
      ),
    ).then((res) => res.item);
  }

  // ---- Medios ----

  subirMedio(file: File): Promise<MedioItem> {
    const body = new FormData();
    body.append('file', file);
    return firstValueFrom(
      this.http.post<MedioItem>(`${API_BASE}/medios`, body),
    );
  }

  listarMedios(): Promise<MedioItem[]> {
    return firstValueFrom(
      this.http.get<ListarMediosResponse>(`${API_BASE}/medios`),
    ).then((res) => res.items ?? []);
  }

  eliminarMedio(id: number): Promise<void> {
    return firstValueFrom(this.http.delete(`${API_BASE}/medios/${id}`)).then(
      () => undefined,
    );
  }

  recortarMedio(body: RecortarMedioBody): Promise<RecortarMedioResult> {
    return firstValueFrom(
      this.http.post<RecortarMedioResult>(`${API_BASE}/medios/recortar`, body),
    );
  }

  listarVersionesMedio(id: number): Promise<MedioVersionItem[]> {
    return firstValueFrom(
      this.http.get<{ items: MedioVersionItem[] }>(
        `${API_BASE}/medios/${id}/versiones`,
      ),
    ).then((res) => res.items ?? []);
  }

  /**
   * Restaura una versión de un medio. Sin `versionId` restaura el original.
   * El archivo actual queda archivado como una versión más.
   */
  restaurarVersionMedio(
    id: number,
    versionId: number | null,
  ): Promise<RestaurarMedioResult> {
    return firstValueFrom(
      this.http.post<RestaurarMedioResult>(
        `${API_BASE}/medios/${id}/restaurar`,
        {
          versionId,
        },
      ),
    );
  }
}
