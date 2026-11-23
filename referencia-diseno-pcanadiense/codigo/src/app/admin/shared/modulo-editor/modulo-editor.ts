import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { MODULO_META } from '../../../core/models/documento.model';
import { environment } from '../../../../environments/environment';
import { PortalApi } from '../../../core/api/portal.api';
import type { ContenidoVersion } from '../../../core/api/api.types';
import { ContenidoStore } from '../../../core/store/contenido.store';
import { DocumentosStore } from '../../../core/store/documentos.store';
import type { ModuloId } from '../../../core/models/documento.model';
import { AvisoCambios } from '../aviso-cambios/aviso-cambios';
import type { PuedeSalirConCambios } from '../aviso-cambios/salir-con-cambios';
import { EditorContenido } from '../editor-contenido/editor-contenido';
import type { CampoSchema } from '../editor-contenido/schema';
import { TablaDocumentos } from '../tabla-documentos/tabla-documentos';
import { ToastService } from '../toast/toast';
import { DialogComponent } from '../../../shared/ui';

@Component({
  selector: 'app-modulo-editor',
  standalone: true,
  imports: [RouterLink, AvisoCambios, EditorContenido, TablaDocumentos, DialogComponent],
  template: `
    <div class="admin-page">
      <header class="page-header">
        <div class="portal-header-identity">
          <div class="portal-header-copy">
            <h1 class="page-title"><i class="fa-solid {{ icono() }} portal-title-icon" aria-hidden="true"></i>{{ titulo() }}</h1>
            <p class="page-sub">
            {{ descripcion() }}
          </p>
          </div>
        </div>
        <div class="page-header-actions">
          @if (modificado()) {
            <span class="badge badge-modificado">Modificado</span>
          }
          <a class="btn-ghost" [routerLink]="publicPath()" target="_blank" rel="noopener">
            Ver página pública
          </a>
          @if (remoto) {
            <button type="button" class="btn-ghost" (click)="abrirHistorial()">Historial</button>
          }
          <button type="button" class="btn-ghost" (click)="restaurar()">Restaurar original</button>
        </div>
      </header>

      <nav class="admin-tabs" role="tablist" [attr.aria-label]="'Secciones de ' + titulo()">
        @for (tab of tabs(); track tab.id) {
          <button
            type="button"
            role="tab"
            class="admin-tab"
            [attr.aria-selected]="active() === tab.id"
            [class.active]="active() === tab.id"
            [attr.aria-current]="active() === tab.id ? 'true' : null"
            (click)="active.set(tab.id)"
          >
            {{ tab.label }}
          </button>
        }
      </nav>

      <div class="admin-card seccion-card" role="tabpanel" [attr.aria-label]="tabActivaLabel()">
        <header class="seccion-head">
          <span class="seccion-icono" aria-hidden="true"><i class="fa-solid" [class]="iconoSeccion()"></i></span>
          <div class="seccion-head-texto">
            <h2 class="seccion-titulo">{{ tabActivaLabel() }}</h2>
            <p class="seccion-sub">
              @if (campos().length) {
                {{ campos().length }} {{ campos().length === 1 ? 'campo' : 'campos' }} en esta sección
                · los cambios se guardan al pulsar «Guardar».
              } @else {
                Esta sección no tiene campos de texto; use «Documentos de esta sección».
              }
            </p>
          </div>
        </header>
        @if (campos().length) {
          <div class="admin-card-body seccion-cuerpo">
            <app-editor-contenido
              [schema]="campos()"
              [valor]="draft()"
              (valorChange)="draft.set($event)"
            />
          </div>
        }
      </div>

      @if (mostrarDocumentos()) {
        <div class="seccion-docs">
          <app-tabla-documentos [modulo]="modulo()" [seccion]="active()" />
        </div>
      }

      <div class="save-bar">
        <button type="button" class="btn-cancel" (click)="cancelar()" [disabled]="!dirty()">
          Cancelar
        </button>
        <button type="button" class="btn-save" (click)="guardar()" [disabled]="!dirty() || guardando()">
          {{ guardando() ? 'Guardando…' : 'Guardar cambios' }}
        </button>
      </div>
    </div>

    <app-aviso-cambios
      [abierto]="aviso()"
      (guardar)="onGuardarAviso()"
      (descartar)="onDescartarAviso()"
      (seguir)="onSeguirAviso()"
    />

    <app-dialog
      [open]="historialAbierto()"
      title="Historial de versiones"
      (openChange)="historialAbierto.set($event)"
    >
      @if (historialCargando()) {
        <p class="form-hint">Cargando versiones…</p>
      } @else if (versiones().length === 0) {
        <p>Aún no hay versiones archivadas. Se crean cada vez que guarda.</p>
      } @else {
        <div class="historial-lista">
          @for (v of versiones(); track v.id) {
            <button
              type="button"
              class="historial-item"
              [class.active]="versionActiva()?.id === v.id"
              (click)="verVersion(v)"
            >
              <span>{{ v.autor }} · {{ fechaCorta(v.fecha) }}</span>
              <span class="form-hint">#{{ v.id }}</span>
            </button>
          }
        </div>
        @if (versionActiva(); as ver) {
          <pre class="historial-json">{{ previewJson() }}</pre>
          <div dialog-footer>
            <button type="button" class="btn-cancel" (click)="historialAbierto.set(false)">
              Cerrar
            </button>
            <button
              type="button"
              class="btn-save"
              [disabled]="restaurandoVersion()"
              (click)="restaurarVersion()"
            >
              {{ restaurandoVersion() ? 'Restaurando…' : 'Volver a esta versión' }}
            </button>
          </div>
        }
      }
    </app-dialog>
  `,
  styles: `
    :host { display: block; min-width: 0; }
    .admin-page { display: flex; flex-direction: column; gap: 20px; }
    .page-header {
      padding: 14px 22px;
      border: 1px solid var(--adm-brand-border);
      border-radius: 16px;
      background: linear-gradient(115deg, color-mix(in srgb, var(--adm-brand-soft) 45%, var(--adm-surface)), var(--adm-surface) 70%);
      box-shadow: 0 4px 20px rgba(42, 52, 72, .03);
    }
    .page-header { align-items: center; padding: 18px 24px; border-radius: 18px; }
    .portal-header-identity { display: flex; align-items: center; flex: 1 1 auto; min-width: 0; }
    .portal-header-copy { min-width: 0; }
    .portal-title-icon { display: inline-block; margin-right: 10px; color: var(--adm-brand); font-size: .72em; vertical-align: .08em; }
    .portal-header-copy .page-title { display: flex; align-items: center; gap: 0; margin: 0 0 3px; line-height: 1.22; }
    .portal-header-copy .page-sub { margin: 0; }
    @media (max-width: 600px) { .portal-title-icon { margin-right: 8px; } }
    .page-header .page-title { font-size: clamp(1.4rem, 2vw, 1.75rem); }
    .page-header .page-sub { font-size: .85rem; }
    @media (max-width: 720px) { .page-header { padding: 20px; } .page-header-actions { width: 100%; } }
    .page-header .page-title { letter-spacing: -.025em; }
    .page-header .page-sub { line-height: 1.6; max-width: 70ch; }
    .page-header-actions { gap: 10px; }
    .admin-tabs { margin-bottom: 0; }
    .seccion-card { overflow: visible; border-radius: 16px; }
    .seccion-head {
      padding: 22px 28px;
      border-bottom: 1px solid var(--adm-line);
      border-radius: 16px 16px 0 0;
      background: linear-gradient(110deg, color-mix(in srgb, var(--adm-brand-soft) 45%, var(--adm-surface)), var(--adm-surface) 75%);
    }
    .seccion-head {
      display:flex;
      align-items:center;
      gap:13px;
      border-bottom-color:color-mix(in srgb,var(--adm-brand) 24%,var(--adm-line));
    }
    .seccion-head-texto { min-width:0; }
    .seccion-icono {
      display:inline-flex;
      align-items:center;
      justify-content:center;
      flex:0 0 44px;
      width:44px;
      height:44px;
      border:1px solid color-mix(in srgb,var(--adm-brand) 38%,var(--adm-line));
      border-radius:12px;
      background:color-mix(in srgb,var(--adm-brand) 9%,var(--adm-surface));
      color:var(--adm-brand);
      font-size:1.05rem;
    }
    .seccion-titulo {
      margin: 0;
      font-size: 1.18rem;
      font-weight: 750;
      color: var(--adm-ink);
      letter-spacing: -.018em;
    }
    .seccion-sub {
      margin: 8px 0 0;
      font-size: .84rem;
      line-height: 1.55;
      color: var(--adm-ink-soft);
    }
    .seccion-cuerpo { padding: 26px 28px 30px; background: var(--adm-bg); }
    .seccion-docs { margin-top: 16px; min-width: 0; }
    .admin-tab[aria-selected="true"] { color: var(--adm-brand); }
    .seccion-card { min-width: 0; }
    .seccion-cuerpo { min-width: 0; }
    .save-bar { align-items: center; }
    @media (max-width: 600px) { .save-bar > button { flex: 1 1 auto; } }
    @media (max-width: 720px) {
      .page-header { padding: 18px; }
      .seccion-head { padding: 18px; }
      .seccion-cuerpo { padding: 18px; }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModuloEditor implements PuedeSalirConCambios {
  private readonly contenido = inject(ContenidoStore);
  private readonly documentos = inject(DocumentosStore);
  private readonly toast = inject(ToastService);
  private readonly api = inject(PortalApi);

  readonly icono = computed(() => MODULO_META.find((modulo) => modulo.path === this.publicPath())?.icon ?? 'fa-file-lines');
  readonly modulo = input.required<ModuloId>();
  readonly titulo = input.required<string>();
  readonly publicPath = input.required<string>();
  readonly schema = input.required<CampoSchema[]>();
  readonly tabs = input.required<readonly { id: string; label: string }[]>();
  readonly mostrarDocumentos = input(true);
  readonly descripcion = input('Edita la información y los documentos de esta página pública.');

  readonly remoto = environment.useRemoteApi;
  readonly draft = signal<unknown>({});
  readonly active = signal('');
  readonly aviso = signal(false);
  readonly historialAbierto = signal(false);
  readonly historialCargando = signal(false);
  readonly versiones = signal<ContenidoVersion[]>([]);
  readonly versionActiva = signal<ContenidoVersion | null>(null);
  readonly restaurandoVersion = signal(false);
  readonly guardando = signal(false);

  private snapshot = '';
  private loadedFor: ModuloId | null = null;
  private resolverAviso: ((value: boolean) => void) | null = null;

  readonly campos = computed(() => this.schema().filter((c) => c.seccion === this.active()));
  readonly tabActivaLabel = computed(
    () => this.tabs().find((t) => t.id === this.active())?.label ?? this.titulo(),
  );
  readonly iconoSeccion = computed(() => {
    const titulo = this.tabActivaLabel().toLocaleLowerCase('es');
    if (/convocatoria|admisión|postul/.test(titulo)) return 'fa-bullhorn';
    if (/imagen|foto|galería|portada|banner/.test(titulo)) return 'fa-images';
    if (/requisito|documento|archivo/.test(titulo)) return 'fa-folder-open';
    if (/costo|monto|pago|matrícula|pensión/.test(titulo)) return 'fa-coins';
    if (/programa|carrera|estudio/.test(titulo)) return 'fa-graduation-cap';
    if (/fecha|cronograma|calendario|horario/.test(titulo)) return 'fa-calendar-days';
    if (/contacto|correo|teléfono/.test(titulo)) return 'fa-address-book';
    if (/noticia|comunicado/.test(titulo)) return 'fa-newspaper';
    if (/enlace|navegación|menú/.test(titulo)) return 'fa-link';
    if (/personal|docente|equipo/.test(titulo)) return 'fa-users';
    if (/texto|información|contenido|descripción/.test(titulo)) return 'fa-align-left';
    return 'fa-layer-group';
  });
  readonly modificado = computed(() => this.contenido.de(this.modulo()).modificado());
  readonly previewJson = computed(() => {
    const data = this.versionActiva()?.data;
    return data ? JSON.stringify(data, null, 2) : '';
  });

  constructor() {
    effect(() => {
      const modulo = this.modulo();
      const value = this.contenido.de(modulo).value();
      const tabs = this.tabs();
      untracked(() => {
        if (this.loadedFor !== modulo) {
          this.cargar(value);
          this.loadedFor = modulo;
        }
        if (tabs.length && !tabs.some((t) => t.id === this.active())) {
          this.active.set(tabs[0].id);
        }
      });
    });
  }

  dirty(): boolean {
    return JSON.stringify(this.draft()) !== this.snapshot;
  }

  confirmarSalida(): Promise<boolean> {
    this.aviso.set(true);
    return new Promise((resolve) => {
      this.resolverAviso = resolve;
    });
  }

  async guardar(): Promise<void> {
    if (!this.dirty() || this.guardando()) return;
    this.guardando.set(true);
    try {
      const enviado = structuredClone(this.draft());
      await this.contenido.publicar(this.modulo(), enviado as never);
      this.snapshot = JSON.stringify(enviado);
      this.toast.success(this.dirty() ? 'Cambios anteriores publicados. Quedan ediciones pendientes.' : 'Contenido guardado.');
    } catch {
      this.toast.error('No se pudo guardar. Revise la conexión; el borrador sigue aquí.');
    } finally {
      this.guardando.set(false);
    }
  }

  cancelar(): void {
    if (this.dirty() && !window.confirm('¿Descartar los cambios sin guardar de esta sección?')) return;
    this.cargar(this.contenido.de(this.modulo()).value());
  }

  async restaurar(): Promise<void> {
    if (!window.confirm('¿Restaurar el contenido y los documentos originales de este módulo?')) return;
    try {
      await this.contenido.restaurar(this.modulo());
      await this.documentos.restaurarModulo(this.modulo());
      this.cargar(this.contenido.de(this.modulo()).value());
      this.toast.success('Se restauró el original de este módulo.');
    } catch {
      this.toast.error('No se pudo restaurar el original.');
    }
  }

  async abrirHistorial(): Promise<void> {
    this.historialAbierto.set(true);
    this.versionActiva.set(null);
    this.historialCargando.set(true);
    try {
      this.versiones.set(await this.api.versionesContenido(this.modulo()));
    } catch {
      this.toast.error('No se pudo cargar el historial.');
      this.historialAbierto.set(false);
    } finally {
      this.historialCargando.set(false);
    }
  }

  async verVersion(item: ContenidoVersion): Promise<void> {
    try {
      const completa = await this.api.versionContenido(this.modulo(), item.id);
      this.versionActiva.set(completa);
    } catch {
      this.toast.error('No se pudo leer esa versión.');
    }
  }

  async restaurarVersion(): Promise<void> {
    const ver = this.versionActiva();
    if (!ver || !window.confirm('¿Restaurar esta versión del contenido?')) return;
    this.restaurandoVersion.set(true);
    try {
      const data = await this.api.restaurarVersionContenido(this.modulo(), ver.id);
      this.contenido.aplicar(this.modulo(), data);
      this.cargar(data);
      this.historialAbierto.set(false);
      this.toast.success('Se restauró esa versión. El cambio anterior quedó en el historial.');
    } catch {
      this.toast.error('No se pudo restaurar esa versión.');
    } finally {
      this.restaurandoVersion.set(false);
    }
  }

  fechaCorta(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString('es-PE');
  }

  async onGuardarAviso(): Promise<void> {
    await this.guardar();
    this.cerrarAviso(!this.dirty());
  }

  onDescartarAviso(): void {
    this.cerrarAviso(true);
  }

  onSeguirAviso(): void {
    this.cerrarAviso(false);
  }

  private cargar(value: unknown): void {
    const cloned = structuredClone(value);
    this.draft.set(cloned);
    this.snapshot = JSON.stringify(cloned);
  }

  private cerrarAviso(salir: boolean): void {
    this.aviso.set(false);
    this.resolverAviso?.(salir);
    this.resolverAviso = null;
  }
}
