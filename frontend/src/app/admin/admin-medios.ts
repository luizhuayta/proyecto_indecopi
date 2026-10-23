import { Component, ElementRef, OnDestroy, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { MediosService } from '../core/medios.service';
import { CmsContentService } from '../cms/cms-content.service';
import { MedioItem } from '../cms/cms-api.service';

interface CropCaja {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface VistaPrevia {
  file: File;
  url: string;
  peso: string;
}

const CROP_INICIAL: CropCaja = { x: 0.25, y: 0.25, w: 0.5, h: 0.5 };

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/**
 * Convierte la caja de recorte, que el usuario maneja en fracciones de la
 * imagen (0..1), a píxeles enteros de la imagen original: el servidor recorta
 * sobre el binario real y exige enteros. La caja nunca sale de los límites.
 */
export function cajaRecorteEnPixeles(
  caja: CropCaja,
  ancho: number,
  alto: number,
): { x: number; y: number; w: number; h: number } {
  const anchoReal = Math.max(1, Math.round(ancho));
  const altoReal = Math.max(1, Math.round(alto));
  const x = clamp(Math.round(caja.x * anchoReal), 0, anchoReal - 1);
  const y = clamp(Math.round(caja.y * altoReal), 0, altoReal - 1);
  return {
    x,
    y,
    w: clamp(Math.round(caja.w * anchoReal), 1, anchoReal - x),
    h: clamp(Math.round(caja.h * altoReal), 1, altoReal - y),
  };
}

/**
 * Biblioteca de imágenes: subida (arrastrar o botón) con vista previa antes de
 * subir, cuadrícula de miniaturas y ficha con datos, URL para copiar, recorte
 * (el original se conserva) y eliminación. El texto alternativo se edita aquí
 * mismo y, si está vacío, se marca como pendiente.
 */
@Component({
  selector: 'app-admin-medios',
  standalone: true,
  template: `
    <header>
      <h1 class="admin-titulo">Medios</h1>
      <p class="admin-subtitulo">
        Las imágenes del sitio. Sube, recorta y describe las que se usan en las páginas.
      </p>
    </header>

    <div class="medios">
      <section class="medios__biblioteca" aria-label="Biblioteca de imágenes">
        <div
          class="zona-subida"
          [class.zona-subida--activa]="arrastrando()"
          (dragover)="onDragover($event)"
          (dragleave)="arrastrando.set(false)"
          (drop)="onSoltar($event)"
        >
          <input
            #entradaArchivo
            type="file"
            accept="image/*"
            hidden
            (change)="elegirArchivo($any($event.target).files?.[0])"
          />
          <p class="zona-subida__texto">Arrastra una imagen aquí o usa el botón.</p>
          <button type="button" class="admin-btn admin-btn--primario" (click)="entradaArchivo.click()">
            Elegir imagen
          </button>

          @if (preview(); as p) {
            <div class="vista-previa">
              <img [src]="p.url" alt="Vista previa de " + p.file.name />
              <div class="vista-previa__datos">
                <span class="vista-previa__nombre">{{ p.file.name }}</span>
                <span class="vista-previa__peso">{{ p.peso }}</span>
              </div>
              <div class="vista-previa__acciones">
                <button type="button" class="admin-btn admin-btn--primario" (click)="subir()" [disabled]="medios.uploading()">
                  {{ medios.uploading() ? 'Subiendo…' : 'Subir' }}
                </button>
                <button type="button" class="admin-btn" (click)="preview.set(null)" [disabled]="medios.uploading()">
                  Cancelar
                </button>
              </div>
            </div>
          }
        </div>

        @if (medios.loading()) {
          <p class="admin-vacio">Cargando los medios…</p>
        } @else if (medios.items().length === 0) {
          <p class="admin-vacio">Aún no hay imágenes. Sube la primera para empezar.</p>
        } @else {
          <ul class="miniaturas">
            @for (item of medios.items(); track item.id) {
              <li>
                <button
                  type="button"
                  class="miniatura"
                  [class.miniatura--seleccionada]="item.id === seleccionadoId()"
                  [attr.aria-label]="'Abrir ' + item.nombre_original"
                  (click)="abrir(item.id)"
                >
                  <img [src]="item.url" alt="" />
                  <span class="miniatura__nombre">{{ item.nombre_original }}</span>
                  @if (esPendiente(item)) {
                    <span class="miniatura__pendiente">Alt pendiente</span>
                  }
                </button>
              </li>
            }
          </ul>
        }
      </section>

      <aside class="medios__ficha" aria-label="Ficha del medio">
        @if (seleccionado(); as item) {
          <img class="ficha__imagen" [src]="item.url" [alt]="medios.altDe(item) || item.nombre_original" />

          <dl class="ficha__datos">
            <div><dt>Nombre</dt><dd>{{ item.nombre_original }}</dd></div>
            <div><dt>Tipo</dt><dd>{{ item.mime }}</dd></div>
            <div><dt>Peso</dt><dd>{{ peso(item.tamano) }}</dd></div>
            @if (item.ancho && item.alto) {
              <div><dt>Dimensiones</dt><dd>{{ item.ancho }} × {{ item.alto }}</dd></div>
            }
            @if (item.creado_en) {
              <div><dt>Subido</dt><dd>{{ fecha(item.creado_en) }}</dd></div>
            }
          </dl>

          <div class="admin-campo">
            <label [for]="'url-' + item.id">Enlace</label>
            <div class="ficha__url">
              <input [id]="'url-' + item.id" class="admin-control" type="text" readonly [value]="item.url" />
              <button type="button" class="admin-btn" (click)="copiarUrl()">
                {{ copiado() ? 'Copiado' : 'Copiar' }}
              </button>
            </div>
          </div>

          <div class="admin-campo">
            <label [for]="'alt-' + item.id">Texto alternativo</label>
            <input
              [id]="'alt-' + item.id"
              class="admin-control"
              type="text"
              [value]="medios.altDe(item)"
              (input)="medios.setAlt(item.id, $any($event.target).value)"
            />
            @if (esPendiente(item)) {
              <p class="admin-error">Sin texto alternativo. El servidor lo exige para imágenes con contenido.</p>
            }
          </div>

          @if (cropMode()) {
            <div
              class="crop-escena"
              #cropEscena
              (pointermove)="arrastrar($event)"
              (pointerup)="soltar($event)"
              (pointercancel)="soltar($event)"
            >
              <img [src]="item.url" alt="" />
              <div
                class="crop-caja"
                [style.left.%]="crop().x * 100"
                [style.top.%]="crop().y * 100"
                [style.width.%]="crop().w * 100"
                [style.height.%]="crop().h * 100"
                role="region"
                tabindex="0"
                aria-label="Área de recorte. Usa las flechas para moverla."
                (pointerdown)="iniciarArrastre($event)"
                (keydown)="cropTeclado($event)"
              >
                <span class="crop-manija" aria-hidden="true"></span>
              </div>
            </div>

            <p class="crop-lectura" aria-live="polite">
              x {{ crop().x.toFixed(2) }} · y {{ crop().y.toFixed(2) }} · w {{ crop().w.toFixed(2) }} · h {{ crop().h.toFixed(2) }}
            </p>

            <div class="crop-valores">
              <label>X <input type="number" step="0.01" min="0" max="1" [value]="crop().x" (input)="setCrop('x', $any($event.target).value)" /></label>
              <label>Y <input type="number" step="0.01" min="0" max="1" [value]="crop().y" (input)="setCrop('y', $any($event.target).value)" /></label>
              <label>W <input type="number" step="0.01" min="0.01" max="1" [value]="crop().w" (input)="setCrop('w', $any($event.target).value)" /></label>
              <label>H <input type="number" step="0.01" min="0.01" max="1" [value]="crop().h" (input)="setCrop('h', $any($event.target).value)" /></label>
            </div>

            <div class="ficha__acciones">
              <button type="button" class="admin-btn admin-btn--primario" (click)="aplicarRecorte()">
                Aplicar recorte
              </button>
              <button type="button" class="admin-btn" (click)="cropMode.set(false)">Cancelar</button>
            </div>
          } @else {
            <div class="ficha__acciones">
              <button type="button" class="admin-btn" (click)="cropMode.set(true)">Recortar</button>
              <button type="button" class="admin-btn admin-btn--peligro" (click)="eliminar()">Eliminar</button>
            </div>
          }
        } @else {
          <p class="admin-vacio">Selecciona una imagen para ver sus datos y acciones.</p>
        }
      </aside>
    </div>

    @if (medios.error()) {
      <p class="admin-banner admin-banner--error" role="alert">{{ medios.error() }}</p>
    }
    @if (status()) {
      <p class="admin-banner admin-banner--ok" role="status">{{ status() }}</p>
    }
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        gap: var(--space-16, 1rem);
      }
      .admin-titulo {
        margin: 0;
        font-family: var(--font-titulos, serif);
        font-weight: 600;
      }
      .admin-subtitulo {
        margin: 0;
        color: var(--color-texto-suave);
      }
      .medios {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(18rem, 22rem);
        gap: var(--space-24, 1.5rem);
        align-items: start;
      }
      @media (max-width: 900px) {
        .medios {
          grid-template-columns: 1fr;
        }
      }
      .medios__biblioteca {
        display: flex;
        flex-direction: column;
        gap: var(--space-16, 1rem);
      }
      .admin-vacio {
        color: var(--color-texto-suave);
        margin: 0;
      }
      .zona-subida {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--space-8, 0.5rem);
        padding: var(--space-24, 1.5rem);
        border: 2px dashed var(--color-borde);
        border-radius: var(--radio-tarjeta, 6px);
        text-align: center;
      }
      .zona-subida--activa {
        border-color: var(--color-primario);
        background: var(--color-superficie);
      }
      .zona-subida__texto {
        margin: 0;
        color: var(--color-texto-suave);
      }
      .vista-previa {
        display: flex;
        flex-direction: column;
        gap: var(--space-8, 0.5rem);
        align-items: center;
        margin-top: var(--space-8, 0.5rem);
      }
      .vista-previa img {
        max-height: 10rem;
        border: 1px solid var(--color-borde);
        border-radius: var(--radio-campo, 4px);
      }
      .vista-previa__datos {
        display: flex;
        gap: var(--space-8, 0.5rem);
        font-size: var(--texto-sm, 0.875rem);
        color: var(--color-texto-suave);
      }
      .vista-previa__acciones {
        display: flex;
        gap: var(--space-8, 0.5rem);
      }
      .miniaturas {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr));
        gap: var(--space-12, 0.75rem);
      }
      .miniatura {
        display: flex;
        flex-direction: column;
        gap: var(--space-4, 0.25rem);
        padding: var(--space-8, 0.5rem);
        border: 1px solid var(--color-borde);
        border-radius: var(--radio-tarjeta, 6px);
        background: var(--color-fondo);
        cursor: pointer;
        text-align: left;
        font: inherit;
        color: var(--color-texto);
        width: 100%;
      }
      .miniatura:hover {
        border-color: var(--color-secundario);
      }
      .miniatura--seleccionada {
        outline: 2px solid var(--color-primario);
        outline-offset: 2px;
      }
      .miniatura img {
        width: 100%;
        aspect-ratio: 4 / 3;
        object-fit: cover;
        border-radius: var(--radio-campo, 4px);
      }
      .miniatura__nombre {
        font-size: var(--texto-sm, 0.875rem);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .miniatura__pendiente {
        font-size: var(--texto-xs, 0.75rem);
        color: var(--color-acento);
      }
      .medios__ficha {
        display: flex;
        flex-direction: column;
        gap: var(--space-12, 0.75rem);
        border: 1px solid var(--color-borde);
        border-radius: var(--radio-tarjeta, 6px);
        padding: var(--space-16, 1rem);
        background: var(--color-superficie);
      }
      .ficha__imagen {
        border-radius: var(--radio-campo, 4px);
        border: 1px solid var(--color-borde);
      }
      .ficha__datos {
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: var(--space-4, 0.25rem);
        font-size: var(--texto-sm, 0.875rem);
      }
      .ficha__datos div {
        display: flex;
        gap: var(--space-8, 0.5rem);
      }
      .ficha__datos dt {
        color: var(--color-texto-suave);
        flex: none;
      }
      .ficha__datos dd {
        margin: 0;
        overflow-wrap: anywhere;
      }
      .ficha__url {
        display: flex;
        gap: var(--space-8, 0.5rem);
      }
      .ficha__acciones {
        display: flex;
        gap: var(--space-8, 0.5rem);
      }
      .admin-error {
        margin: 0;
        font-size: var(--texto-sm, 0.875rem);
        color: var(--color-acento);
      }
      .crop-escena {
        position: relative;
        border: 1px solid var(--color-borde);
        border-radius: var(--radio-campo, 4px);
        overflow: hidden;
        user-select: none;
        touch-action: none;
      }
      .crop-escena img {
        display: block;
        width: 100%;
        pointer-events: none;
      }
      .crop-caja {
        position: absolute;
        border: 1px dashed #fff;
        box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.4);
        cursor: move;
      }
      .crop-manija {
        position: absolute;
        right: -6px;
        bottom: -6px;
        width: 12px;
        height: 12px;
        background: #fff;
        border: 1px solid rgba(0, 0, 0, 0.4);
        cursor: nwse-resize;
      }
      .crop-lectura {
        margin: 0;
        font-size: var(--texto-sm, 0.875rem);
        font-variant-numeric: tabular-nums;
        color: var(--color-texto-suave);
      }
      .crop-valores {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: var(--space-8, 0.5rem);
      }
      .crop-valores label {
        display: flex;
        flex-direction: column;
        gap: var(--space-4, 0.25rem);
        font-size: var(--texto-xs, 0.75rem);
        color: var(--color-texto-suave);
      }
      .crop-valores input {
        width: 100%;
        padding: 0.3rem 0.4rem;
        border: 1px solid var(--color-borde);
        border-radius: var(--radio-campo, 4px);
        background: var(--color-fondo);
        color: var(--color-texto);
        font: inherit;
      }
      @media (prefers-reduced-motion: reduce) {
        .crop-caja {
          transition: none !important;
        }
      }
    `,
  ],
})
export class AdminMedios implements OnInit, OnDestroy {
  medios = inject(MediosService);
  private cms = inject(CmsContentService);

  readonly seleccionadoId = signal<number | null>(null);
  readonly cropMode = signal(false);
  readonly crop = signal<CropCaja>({ ...CROP_INICIAL });
  readonly arrastrando = signal(false);
  readonly preview = signal<VistaPrevia | null>(null);
  readonly copiado = signal(false);
  readonly status = signal('');

  readonly seleccionado = computed<MedioItem | null>(
    () => this.medios.items().find((m) => m.id === this.seleccionadoId()) ?? null,
  );

  @ViewChild('cropEscena') private escena?: ElementRef<HTMLElement>;

  private drag: {
    modo: 'move' | 'resize';
    inicioX: number;
    inicioY: number;
    cropInicial: CropCaja;
    rect: DOMRect;
  } | null = null;

  private urlObjeto?: string;

  ngOnInit(): void {
    if (!this.medios.loaded()) {
      void this.medios.listar();
    }
  }

  ngOnDestroy(): void {
    if (this.urlObjeto && typeof URL.revokeObjectURL === 'function') {
      URL.revokeObjectURL(this.urlObjeto);
    }
  }

  onDragover(event: DragEvent): void {
    event.preventDefault();
    this.arrastrando.set(true);
  }

  onSoltar(event: DragEvent): void {
    event.preventDefault();
    this.arrastrando.set(false);
    this.elegirArchivo(event.dataTransfer?.files?.[0]);
  }

  elegirArchivo(file: File | undefined | null): void {
    if (!file) {
      return;
    }
    if (!file.type.startsWith('image/')) {
      this.medios.error.set('Elige un archivo de imagen.');
      return;
    }
    if (this.urlObjeto) {
      URL.revokeObjectURL(this.urlObjeto);
    }
    this.urlObjeto =
      typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : '';
    this.preview.set({ file, url: this.urlObjeto, peso: this.peso(file.size) });
  }

  async subir(): Promise<void> {
    const p = this.preview();
    if (!p) {
      return;
    }
    try {
      const item = await this.medios.subir(p.file);
      this.preview.set(null);
      this.seleccionadoId.set(item.id);
      this.status.set('Imagen subida.');
    } catch {
      /* el error ya está en el servicio */
    }
  }

  abrir(id: number): void {
    this.seleccionadoId.set(id);
    this.cropMode.set(false);
    this.crop.set({ ...CROP_INICIAL });
    this.copiado.set(false);
  }

  esPendiente(item: MedioItem): boolean {
    return this.medios.altDe(item).length === 0;
  }

  async copiarUrl(): Promise<void> {
    const item = this.seleccionado();
    if (!item) {
      return;
    }
    try {
      await navigator.clipboard.writeText(item.url);
      this.copiado.set(true);
      window.setTimeout(() => this.copiado.set(false), 1500);
    } catch {
      this.medios.error.set('No se pudo copiar el enlace.');
    }
  }

  async eliminar(): Promise<void> {
    const item = this.seleccionado();
    if (!item) {
      return;
    }
    const enUso = this.estaEnUso(item);
    const mensaje = enUso
      ? `Este archivo se usa en alguna página. ¿Eliminarlo de todos modos?`
      : `¿Eliminar «${item.nombre_original}»? Esta acción no se puede deshacer.`;
    if (!window.confirm(mensaje)) {
      return;
    }
    try {
      await this.medios.eliminar(item.id);
      this.seleccionadoId.set(null);
      this.status.set('Archivo eliminado.');
    } catch {
      /* el error ya está en el servicio */
    }
  }

  async aplicarRecorte(): Promise<void> {
    const item = this.seleccionado();
    if (!item) {
      return;
    }
    const c = this.crop();
    // Las dimensiones reales de la imagen: la caja del usuario es 0..1.
    const imagen = this.escena?.nativeElement.querySelector('img');
    const ancho = imagen?.naturalWidth || item.ancho || 1;
    const alto = imagen?.naturalHeight || item.alto || 1;
    const pixeles = cajaRecorteEnPixeles(c, ancho, alto);
    try {
      const recortado = await this.medios.recortar(item, {
        url: item.url,
        x: pixeles.x,
        y: pixeles.y,
        w: pixeles.w,
        h: pixeles.h,
      });
      this.cropMode.set(false);
      this.crop.set({ ...CROP_INICIAL });
      this.seleccionadoId.set(recortado.id);
      this.status.set('Recorte aplicado. La versión original se conserva.');
    } catch {
      /* el error ya está en el servicio */
    }
  }

  iniciarArrastre(event: PointerEvent): void {
    event.preventDefault();
    const objetivo = event.target as HTMLElement;
    const modo = objetivo.classList.contains('crop-manija') ? 'resize' : 'move';
    const escena = this.escena?.nativeElement;
    if (!escena) {
      return;
    }
    escena.setPointerCapture?.(event.pointerId);
    this.drag = {
      modo,
      inicioX: event.clientX,
      inicioY: event.clientY,
      cropInicial: { ...this.crop() },
      rect: escena.getBoundingClientRect(),
    };
  }

  arrastrar(event: PointerEvent): void {
    if (!this.drag) {
      return;
    }
    const rect = this.drag.rect;
    const dx = (event.clientX - this.drag.inicioX) / (rect.width || 1);
    const dy = (event.clientY - this.drag.inicioY) / (rect.height || 1);
    const c = { ...this.drag.cropInicial };
    if (this.drag.modo === 'move') {
      c.x = clamp(c.x + dx, 0, 1 - c.w);
      c.y = clamp(c.y + dy, 0, 1 - c.h);
    } else {
      c.w = clamp(c.w + dx, 0.02, 1 - c.x);
      c.h = clamp(c.h + dy, 0.02, 1 - c.y);
    }
    this.crop.set(c);
  }

  soltar(_event: PointerEvent): void {
    this.drag = null;
  }

  cropTeclado(event: KeyboardEvent): void {
    const delta = event.shiftKey ? 0.05 : 0.01;
    const c = { ...this.crop() };
    switch (event.key) {
      case 'ArrowLeft':
        c.x = clamp(c.x - delta, 0, 1 - c.w);
        break;
      case 'ArrowRight':
        c.x = clamp(c.x + delta, 0, 1 - c.w);
        break;
      case 'ArrowUp':
        c.y = clamp(c.y - delta, 0, 1 - c.h);
        break;
      case 'ArrowDown':
        c.y = clamp(c.y + delta, 0, 1 - c.h);
        break;
      default:
        return;
    }
    event.preventDefault();
    this.crop.set(c);
  }

  setCrop(campo: keyof CropCaja, valor: string): void {
    const n = Number(valor);
    if (Number.isNaN(n)) {
      return;
    }
    const c = { ...this.crop() };
    if (campo === 'w' || campo === 'h') {
      c[campo] = clamp(n, 0.01, 1);
    } else {
      c[campo] = clamp(n, 0, 1);
    }
    this.crop.set(c);
  }

  estaEnUso(item: MedioItem): boolean {
    if (!item.url) {
      return false;
    }
    const bloques: unknown[] = [this.cms.site(), ...Object.values(this.cms.pages())];
    return bloques.some((b) => JSON.stringify(b).includes(item.url));
  }

  peso(bytes: number): string {
    if (!bytes) {
      return '0 KB';
    }
    if (bytes < 1024) {
      return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  fecha(iso: string | null | undefined): string {
    if (!iso) {
      return '—';
    }
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-PE');
  }
}
