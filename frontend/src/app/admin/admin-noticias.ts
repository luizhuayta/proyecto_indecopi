import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { NgStyle } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import {
  CmsApiService,
  NoticiaAdmin,
  NoticiaEntrada,
} from '../cms/cms-api.service';
import { AuthService } from '../cms/auth.service';
import { SitioPublicoService } from '../core/sitio-publico.service';
import { DialogoService } from './dialogo.service';
import { EstadoVacio } from './estado-vacio';

/** Mensaje del servidor cuando rechaza la operación; si no hay, el genérico. */
function mensajeDeError(err: unknown, porDefecto: string): string {
  const mensaje =
    (err as { error?: { message?: string; error?: string } } | null)?.error
      ?.message ?? (err as { error?: { error?: string } } | null)?.error?.error;
  return typeof mensaje === 'string' && mensaje ? mensaje : porDefecto;
}

/** Borrador de formulario: lo que se envía, más el id cuando se edita. */
type NoticiaForm = NoticiaEntrada & { id?: number };

const FORM_VACIO: NoticiaForm = {
  titulo: '',
  tipo: 'noticia',
  categoria: '',
  resumen: '',
  cuerpo: '',
  imagen_url: '',
  imagen_alt: '',
  destacada: false,
  estado: 'borrador',
  publicado_en: null,
};

/**
 * Gestión de noticias y comunicados del sitio. El editor redacta borradores;
 * publicar, editar lo publicado y eliminar es del administrador, igual que en
 * el API. Las publicadas salen en el bloque Novedades de la portada y en
 * /noticias.
 */
@Component({
  selector: 'app-admin-noticias',
  standalone: true,
  imports: [FormsModule, NgStyle, EstadoVacio],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="admin-encabezado">
      <div>
        <h2 class="admin-encabezado__titulo">Noticias</h2>
        <p class="admin-subtitulo admin-encabezado__texto">
          Las publicadas aparecen en el bloque Novedades de la portada y en la
          sección de noticias del sitio.
        </p>
      </div>
      <div class="admin-encabezado__acciones">
        <button
          type="button"
          class="admin-btn admin-btn--primario admin-noticias__nueva"
          (click)="nueva()"
        >
          Nueva noticia
        </button>
      </div>
    </header>

    @if (editando(); as form) {
      <section
        class="admin-tarjeta admin-noticias__editor"
        aria-labelledby="noticia-form-titulo"
      >
        <div class="admin-noticias__columna">
          <h2 id="noticia-form-titulo" class="admin-titulo admin-titulo--chico">
            {{ form.id ? 'Editar' : 'Nueva' }}
            {{ form.tipo === 'comunicado' ? 'comunicado' : 'noticia' }}
          </h2>
          <form class="admin-noticias__form" (ngSubmit)="guardar()">
            <div class="admin-campo">
              <label for="noticia-titulo">Título</label>
              <input
                #tituloNoticia
                id="noticia-titulo"
                class="admin-control"
                type="text"
                maxlength="200"
                required
                [ngModel]="form.titulo"
                (ngModelChange)="campo('titulo', $event)"
                name="titulo"
              />
            </div>
            <div class="admin-noticias__fila">
              <div class="admin-campo">
                <label for="noticia-tipo">Tipo</label>
                <select
                  id="noticia-tipo"
                  class="admin-control"
                  [ngModel]="form.tipo"
                  (ngModelChange)="campo('tipo', $event)"
                  name="tipo"
                >
                  <option value="noticia">Noticia</option>
                  <option value="comunicado">Comunicado</option>
                </select>
              </div>
              <div class="admin-campo">
                <label for="noticia-categoria">Categoría</label>
                <input
                  id="noticia-categoria"
                  class="admin-control"
                  type="text"
                  maxlength="60"
                  [ngModel]="form.categoria"
                  (ngModelChange)="campo('categoria', $event)"
                  name="categoria"
                  placeholder="Institucional, Admisión…"
                />
              </div>
            </div>
            <div class="admin-campo">
              <label for="noticia-resumen">Resumen</label>
              <textarea
                id="noticia-resumen"
                class="admin-control"
                rows="3"
                maxlength="400"
                [ngModel]="form.resumen"
                (ngModelChange)="campo('resumen', $event)"
                name="resumen"
              ></textarea>
              <small class="admin-noticias__contador">
                {{ (form.resumen ?? '').length }}/400
              </small>
            </div>
            <div class="admin-campo">
              <label for="noticia-cuerpo">Cuerpo</label>
              <textarea
                id="noticia-cuerpo"
                class="admin-control"
                rows="8"
                [ngModel]="form.cuerpo"
                (ngModelChange)="campo('cuerpo', $event)"
                name="cuerpo"
                aria-describedby="noticia-cuerpo-ayuda"
              ></textarea>
              <small id="noticia-cuerpo-ayuda" class="admin-noticias__contador">
                Puedes usar negrita, listas y enlaces con HTML.
              </small>
            </div>
            <div class="admin-noticias__fila">
              <div class="admin-campo">
                <label for="noticia-imagen">Imagen de portada (URL)</label>
                <input
                  id="noticia-imagen"
                  class="admin-control"
                  type="text"
                  maxlength="500"
                  [ngModel]="form.imagen_url"
                  (ngModelChange)="campo('imagen_url', $event)"
                  name="imagen_url"
                  placeholder="/almacen/… o https://…"
                />
                <input
                  id="noticia-archivo"
                  type="file"
                  accept="image/*"
                  class="sr-only"
                  (change)="subirImagen($event)"
                />
                <label
                  for="noticia-archivo"
                  class="admin-btn admin-noticias__subir"
                >
                  {{ subiendo() ? 'Subiendo…' : 'Subir imagen' }}
                </label>
              </div>
              <div class="admin-campo">
                <label for="noticia-alt">Texto alternativo</label>
                <input
                  id="noticia-alt"
                  class="admin-control"
                  type="text"
                  maxlength="200"
                  [ngModel]="form.imagen_alt"
                  (ngModelChange)="campo('imagen_alt', $event)"
                  name="imagen_alt"
                  placeholder="Qué se ve en la foto"
                />
              </div>
            </div>
            <div class="admin-noticias__fila">
              <div class="admin-campo admin-campo--check">
                <label for="noticia-destacada">
                  <input
                    id="noticia-destacada"
                    type="checkbox"
                    [ngModel]="form.destacada"
                    (ngModelChange)="campo('destacada', $event)"
                    name="destacada"
                  />
                  Destacada en la portada
                </label>
              </div>
              <div class="admin-campo">
                <label for="noticia-fecha">Fecha de publicación</label>
                <input
                  id="noticia-fecha"
                  class="admin-control"
                  type="datetime-local"
                  [ngModel]="form.publicado_en"
                  (ngModelChange)="campo('publicado_en', $event)"
                  name="publicado_en"
                />
              </div>
              <div class="admin-campo">
                <label for="noticia-estado">Estado</label>
                <select
                  id="noticia-estado"
                  class="admin-control"
                  [ngModel]="form.estado"
                  (ngModelChange)="campo('estado', $event)"
                  name="estado"
                >
                  <option value="borrador">Borrador</option>
                  @if (auth.isAdmin()) {
                    <option value="publicado">Publicado</option>
                  }
                </select>
              </div>
            </div>
            <div class="admin-noticias__acciones">
              <button
                type="submit"
                class="admin-btn admin-btn--primario"
                [disabled]="guardando()"
              >
                {{ guardando() ? 'Guardando…' : 'Guardar' }}
              </button>
              <button
                type="button"
                class="admin-btn"
                (click)="cancelar()"
                [disabled]="guardando()"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
        <!-- Vista previa con la tarjeta real de la portada: los colores son los
             del sitio porque el contenedor lleva los mismos tokens. -->
        <aside
          class="admin-noticias__vista"
          [ngStyle]="sitio.tema()"
          aria-label="Vista previa"
        >
          <p class="admin-noticias__vista-titulo">Así se verá en la portada</p>
          <article class="noticia noticia--destacada">
            <div class="noticia__media">
              @if (form.imagen_url && form.imagen_alt) {
                <img
                  [src]="form.imagen_url"
                  [alt]="form.imagen_alt"
                  loading="lazy"
                />
              }
              @if (form.categoria) {
                <span class="noticia__categoria">{{ form.categoria }}</span>
              }
            </div>
            <h3>{{ form.titulo || 'Título de la noticia' }}</h3>
            @if (form.resumen) {
              <p>{{ form.resumen }}</p>
            }
          </article>
        </aside>
      </section>
    }

    <div class="admin-filtros">
      <div class="admin-campo">
        <label for="buscar-noticias">Buscar</label>
        <input
          id="buscar-noticias"
          class="admin-control"
          type="search"
          [ngModel]="filtroTexto()"
          (ngModelChange)="filtroTexto.set($event)"
          name="buscar"
          placeholder="Título, resumen o categoría"
        />
      </div>
      <div class="admin-campo">
        <label for="filtro-tipo-noticia">Tipo</label>
        <select
          id="filtro-tipo-noticia"
          class="admin-control"
          [ngModel]="filtroTipo()"
          (ngModelChange)="filtroTipo.set($event)"
          name="filtroTipo"
        >
          <option value="">Todas</option>
          <option value="noticia">Noticias</option>
          <option value="comunicado">Comunicados</option>
        </select>
      </div>
    </div>

    @if (error()) {
      <p class="admin-banner admin-banner--error" role="alert">{{ error() }}</p>
    }
    @if (status()) {
      <p class="admin-banner admin-banner--ok" role="status">{{ status() }}</p>
    }

    @if (cargando()) {
      <p class="admin-vacio">Cargando noticias…</p>
    } @else if (filtradas().length === 0) {
      <app-estado-vacio
        icono="noticias"
        titulo="No hay noticias con estos filtros"
        mensaje="Prueba con otra búsqueda, o crea la primera noticia para que aparezca en la portada."
        textoAccion="Nueva noticia"
        (accion)="nueva()"
      />
    } @else {
      <div class="admin-tabla-scroll">
        <table class="admin-tabla">
          <thead>
            <tr>
              <th scope="col">Portada</th>
              <th scope="col">Título</th>
              <th scope="col">Tipo</th>
              <th scope="col">Estado</th>
              <th scope="col">Fecha</th>
              <th scope="col"><span class="sr-only">Acciones</span></th>
            </tr>
          </thead>
          <tbody>
            @for (n of filtradas(); track n.id) {
              <tr>
                <td>
                  @if (n.imagen_url) {
                    <img
                      class="admin-noticias__mini"
                      [src]="n.imagen_url"
                      alt=""
                      loading="lazy"
                    />
                  } @else {
                    <span
                      class="admin-noticias__mini admin-noticias__mini--vacia"
                      aria-hidden="true"
                    ></span>
                  }
                </td>
                <td>
                  <strong>{{ n.titulo }}</strong>
                  @if (n.resumen) {
                    <br /><small>{{ recortar(n.resumen) }}</small>
                  }
                  @if (n.destacada) {
                    <span class="admin-etiqueta">Destacada</span>
                  }
                </td>
                <td>
                  {{ n.tipo === 'comunicado' ? 'Comunicado' : 'Noticia' }}
                </td>
                <td>
                  <span
                    class="admin-etiqueta"
                    [class.admin-etiqueta--ok]="n.estado === 'publicado'"
                    [class.admin-etiqueta--borrador]="n.estado === 'borrador'"
                  >
                    {{ n.estado === 'publicado' ? 'Publicado' : 'Borrador' }}
                  </span>
                </td>
                <td>{{ fecha(n.publicado_en) }}</td>
                <td class="admin-tabla__acciones">
                  <button
                    type="button"
                    class="admin-btn admin-btn--chico admin-noticias__editar"
                    (click)="editar(n)"
                  >
                    Editar
                  </button>
                  @if (n.estado === 'publicado') {
                    <a
                      class="admin-btn admin-btn--chico"
                      [href]="n.ruta"
                      target="_blank"
                      rel="noopener"
                      >Ver</a
                    >
                  }
                  @if (auth.isAdmin()) {
                    <button
                      type="button"
                      class="admin-btn admin-btn--chico admin-btn--peligro admin-noticias__eliminar"
                      (click)="eliminar(n)"
                      [disabled]="eliminando() === n.id"
                    >
                      Eliminar
                    </button>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }
      .admin-subtitulo {
        margin: 0;
        color: var(--color-texto-suave);
      }
      .admin-filtros {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-end;
        gap: 1rem;
      }
      .admin-campo {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }
      .admin-tarjeta {
        padding: 1.5rem;
        border: 1px solid var(--color-borde);
        border-radius: var(--radio-tarjeta);
        background: var(--color-superficie);
        box-shadow: var(--shadow-sm);
      }
      .admin-noticias__editor {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        gap: 1.5rem;
      }
      @media (min-width: 1100px) {
        .admin-noticias__editor {
          grid-template-columns: minmax(0, 1.4fr) minmax(18rem, 0.8fr);
        }
      }
      .admin-noticias__form {
        display: grid;
        gap: 0.9rem;
      }
      .admin-noticias__fila {
        display: flex;
        flex-wrap: wrap;
        gap: 0.9rem;
      }
      .admin-noticias__fila .admin-campo {
        flex: 1 1 10rem;
      }
      .admin-campo--check {
        flex-direction: row;
        align-items: center;
      }
      .admin-noticias__contador {
        color: var(--color-texto-suave);
      }
      .admin-noticias__subir {
        margin-top: 0.5rem;
        width: max-content;
        cursor: pointer;
      }
      .admin-noticias__acciones {
        display: flex;
        gap: 0.5rem;
      }
      .admin-noticias__vista {
        padding: 1.25rem;
        border: 1px dashed var(--color-borde);
        border-radius: var(--radio-tarjeta);
        background: var(--color-fondo);
        align-self: start;
      }
      .admin-noticias__vista-titulo {
        margin: 0 0 0.75rem;
        color: var(--color-texto-suave);
        font-size: 0.8rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.06em;
      }
      .admin-noticias__vista .noticia__media {
        height: 9rem;
      }
      .admin-noticias__mini {
        display: block;
        width: 4.5rem;
        height: 3rem;
        border-radius: 6px;
        object-fit: cover;
        background: var(--color-lavado, var(--color-superficie));
      }
      .admin-noticias__mini--vacia {
        border: 1px dashed var(--color-borde);
      }
      .admin-btn--chico {
        padding: 0.35rem 0.75rem;
        font-size: 0.875rem;
      }
      .admin-titulo--chico {
        font-size: 1.25rem;
        margin: 0 0 0.75rem;
      }
      .admin-tabla__acciones {
        display: flex;
        gap: 0.5rem;
        justify-content: flex-end;
      }
      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
      }
    `,
  ],
})
export class AdminNoticias implements OnInit, OnDestroy {
  private readonly api = inject(CmsApiService);
  readonly auth = inject(AuthService);
  /** Tema del sitio: la vista previa pinta los mismos colores que la portada. */
  readonly sitio = inject(SitioPublicoService);
  private readonly dialogo = inject(DialogoService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private sub?: Subscription;

  /** Título del formulario: la acción «Nueva noticia» deja el foco aquí. */
  @ViewChild('tituloNoticia') private tituloNoticia?: ElementRef<HTMLInputElement>;

  readonly noticias = signal<NoticiaAdmin[]>([]);
  readonly cargando = signal(false);
  readonly guardando = signal(false);
  readonly subiendo = signal(false);
  readonly eliminando = signal<number | null>(null);
  readonly error = signal('');
  readonly status = signal('');
  readonly editando = signal<NoticiaForm | null>(null);

  readonly filtroTexto = signal('');
  readonly filtroTipo = signal('');

  readonly filtradas = computed(() => {
    const texto = this.filtroTexto().trim().toLowerCase();
    return this.noticias().filter((n) => {
      if (this.filtroTipo() && n.tipo !== this.filtroTipo()) {
        return false;
      }
      if (!texto) {
        return true;
      }
      return `${n.titulo} ${n.resumen} ${n.categoria}`
        .toLowerCase()
        .includes(texto);
    });
  });

  private readonly formatoFecha = new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'medium',
  });

  ngOnInit(): void {
    void this.cargar();
    // «Nueva noticia» de la cabecera llega como ?nueva=1: abre el formulario
    // y limpia el parámetro para que la URL quede compartible.
    this.sub = this.route.queryParams.subscribe((params) => {
      if (params['nueva'] !== '1') {
        return;
      }
      this.nueva();
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { nueva: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  async cargar(): Promise<void> {
    this.cargando.set(true);
    this.error.set('');
    try {
      this.noticias.set(await this.api.listarNoticias());
    } catch {
      this.error.set(
        'No se pudieron cargar las noticias. Revisa tu conexión e inténtalo de nuevo.',
      );
    } finally {
      this.cargando.set(false);
    }
  }

  fecha(iso: string | null): string {
    if (!iso) {
      return '—';
    }
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '—' : this.formatoFecha.format(d);
  }

  recortar(texto: string): string {
    return texto.length > 90 ? texto.slice(0, 90) + '…' : texto;
  }

  nueva(): void {
    this.editando.set({ ...FORM_VACIO });
    this.error.set('');
    this.status.set('');
    // La vista previa usa el tema publicado: se pide al abrir el formulario,
    // no en cada visita al listado.
    void this.sitio.cargar();
    // El foco va al título en cuanto el formulario existe en el DOM.
    setTimeout(() => this.tituloNoticia?.nativeElement.focus());
  }

  editar(n: NoticiaAdmin): void {
    this.editando.set({
      id: n.id,
      titulo: n.titulo,
      slug: n.slug,
      tipo: n.tipo,
      categoria: n.categoria,
      resumen: n.resumen,
      cuerpo: n.cuerpo,
      imagen_url: n.imagen_url,
      imagen_alt: n.imagen_alt,
      destacada: n.destacada,
      estado: n.estado,
      // datetime-local quiere 'YYYY-MM-DDTHH:mm' en hora local.
      publicado_en: n.publicado_en ? n.publicado_en.slice(0, 16) : null,
    });
    this.error.set('');
    this.status.set('');
    void this.sitio.cargar();
  }

  cancelar(): void {
    this.editando.set(null);
  }

  /** Escribe un campo del formulario: el objeto del estado se reemplaza, no se muta. */
  campo<K extends keyof NoticiaForm>(clave: K, valor: NoticiaForm[K]): void {
    this.editando.update((form) => (form ? { ...form, [clave]: valor } : form));
  }

  async subirImagen(evento: Event): Promise<void> {
    const archivo = (evento.target as HTMLInputElement).files?.[0];
    if (!archivo || this.subiendo()) {
      return;
    }
    this.subiendo.set(true);
    this.error.set('');
    try {
      const medio = await this.api.subirMedio(archivo);
      this.campo('imagen_url', medio.url);
    } catch {
      this.error.set(
        'No se pudo subir la imagen. Revisa tu conexión e inténtalo de nuevo.',
      );
    } finally {
      this.subiendo.set(false);
    }
  }

  async guardar(): Promise<void> {
    const form = this.editando();
    if (!form || this.guardando()) {
      return;
    }
    if (!form.titulo?.trim()) {
      this.error.set('Escribe un título para la noticia.');
      return;
    }
    if (form.imagen_url && !form.imagen_alt?.trim()) {
      this.error.set(
        'La imagen necesita un texto alternativo que la describa.',
      );
      return;
    }
    this.guardando.set(true);
    this.error.set('');
    this.status.set('');
    const body: NoticiaEntrada = {
      titulo: form.titulo.trim(),
      tipo: form.tipo,
      categoria: form.categoria,
      resumen: form.resumen,
      cuerpo: form.cuerpo,
      imagen_url: form.imagen_url,
      imagen_alt: form.imagen_alt,
      destacada: form.destacada,
      estado: form.estado,
      publicado_en: form.publicado_en || null,
    };
    if (form.slug) {
      body.slug = form.slug;
    }
    try {
      const guardada = form.id
        ? await this.api.actualizarNoticia(form.id, body)
        : await this.api.crearNoticia(body);
      this.noticias.update((lista) => {
        const resto = lista.filter((x) => x.id !== guardada.id);
        return [guardada, ...resto];
      });
      this.editando.set(null);
      this.status.set('Guardado.');
    } catch (err: unknown) {
      this.error.set(
        mensajeDeError(err, 'No se pudo guardar. Inténtalo de nuevo.'),
      );
    } finally {
      this.guardando.set(false);
    }
  }

  async eliminar(n: NoticiaAdmin): Promise<void> {
    const seguir = await this.dialogo.confirmar({
      titulo: 'Eliminar noticia',
      mensaje: `«${n.titulo}» dejará de verse en el sitio. Esta acción no se puede deshacer.`,
      textoConfirmar: 'Eliminar',
      peligro: true,
    });
    if (!seguir || this.eliminando() !== null) {
      return;
    }
    this.eliminando.set(n.id);
    this.error.set('');
    try {
      await this.api.eliminarNoticia(n.id);
      this.noticias.update((lista) => lista.filter((x) => x.id !== n.id));
    } catch {
      this.error.set('No se pudo eliminar la noticia. Inténtalo de nuevo.');
    } finally {
      this.eliminando.set(null);
    }
  }
}
