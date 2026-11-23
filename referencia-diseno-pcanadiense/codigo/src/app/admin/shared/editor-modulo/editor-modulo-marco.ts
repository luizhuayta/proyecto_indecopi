import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MODULO_META } from '../../../core/models/documento.model';
import { DialogComponent } from '../../../shared/ui';
import { AvisoCambios } from '../aviso-cambios/aviso-cambios';
import type { EditorModuloVista } from './editor-modulo-base';

export interface MarcoTab {
  id: string;
  label: string;
}

/**
 * Marco visual de un editor de módulo a medida: cabecera, pestañas, barra de
 * guardado con feedback, aviso de salida y diálogo de confirmación. El cuerpo
 * de la pestaña activa va proyectado. Toda la lógica vive en `editor`
 * (una instancia de `EditorModuloBase`).
 */
@Component({
  selector: 'app-editor-modulo-marco',
  standalone: true,
  imports: [RouterLink, AvisoCambios, DialogComponent],
  template: `
    <div class="admin-page">
      <header class="page-header">
        <div class="portal-header-identity">
          <div class="portal-header-copy">
            <h1 class="page-title"><i class="fa-solid {{ icono() }} portal-title-icon" aria-hidden="true"></i>{{ titulo() }}</h1>
            <p class="page-sub">{{ sub() }}</p>
          </div>
        </div>
        <div class="page-header-actions">
          @if (editor().modificado()) {
            <span class="badge badge-modificado">Con cambios publicados</span>
          }
          <a class="btn-ghost" [routerLink]="publicPath()" target="_blank" rel="noopener">
            <i class="fa fa-arrow-up-right-from-square" aria-hidden="true"></i> Ver página pública
          </a>
          <button
            type="button"
            class="btn-ghost"
            (click)="editor().restaurar()"
            [disabled]="editor().restaurando()"
          >
            {{ editor().restaurando() ? 'Restaurando…' : 'Restaurar original' }}
          </button>
        </div>
      </header>

      <nav class="admin-tabs" role="tablist" [attr.aria-label]="'Secciones de ' + titulo()">
        @for (tab of tabs(); track tab.id) {
          <button
            type="button"
            role="tab"
            class="admin-tab"
            [attr.id]="'portal-tab-' + tab.id"
            [attr.aria-controls]="'portal-panel-' + tab.id"
            [attr.aria-selected]="activa() === tab.id"
            [class.active]="activa() === tab.id"
            [attr.aria-current]="activa() === tab.id ? 'true' : null"
            (click)="activa.set(tab.id)"
          >
            {{ tab.label }}
          </button>
        }
      </nav>

      <div class="marco-lienzo" role="tabpanel" [attr.id]="'portal-panel-' + activa()" [attr.aria-labelledby]="'portal-tab-' + activa()">
        <ng-content />
      </div>

      <div class="marco-extra">
        <ng-content select="[extra]" />
      </div>

      <div class="save-bar">
        @if (editor().guardado() && !editor().dirty()) {
          <span class="save-ok" role="status">
            <i class="fa fa-circle-check" aria-hidden="true"></i> Cambios publicados
          </span>
        }
        <button
          type="button"
          class="btn-cancel"
          (click)="editor().cancelar()"
          [disabled]="!editor().dirty()"
        >
          Descartar cambios
        </button>
        <button
          type="button"
          class="btn-save"
          (click)="editor().guardar()"
          [disabled]="!editor().dirty() || editor().guardando()"
        >
          @if (editor().guardando()) {
            <i class="fa fa-spinner fa-spin" aria-hidden="true"></i> Guardando…
          } @else {
            <i class="fa fa-cloud-arrow-up" aria-hidden="true"></i> Guardar cambios
          }
        </button>
      </div>
    </div>

    <app-aviso-cambios
      [abierto]="editor().aviso()"
      (guardar)="editor().onGuardarAviso()"
      (descartar)="editor().onDescartarAviso()"
      (seguir)="editor().onSeguirAviso()"
    />

    <app-dialog
      [open]="!!editor().confirmacion()"
      [title]="''"
      variant="danger"
      (openChange)="$event || editor().cancelarConfirmacion()"
    >
      <div class="confirmacion-contenido">
        <h3 class="confirmacion-titulo">¿{{ editor().confirmacion()?.titulo }}?</h3>
        <p class="confirmacion-detalle">{{ editor().confirmacion()?.detalle }}</p>
        @if (editor().confirmacion()?.titulo === 'Quitar cuenta institucional') {
          <p class="confirmacion-nota">La cuenta dejará de mostrarse en el portal institucional al guardar los cambios.</p>
        }
      </div>
      <div dialog-footer class="confirmacion-acciones">
        <button type="button" class="btn-cancel" (click)="editor().cancelarConfirmacion()">
          Cancelar
        </button>
        <button type="button" class="btn-danger" (click)="editor().ejecutarConfirmacion()">
          {{ editor().confirmacion()?.titulo === 'Quitar cuenta institucional' ? 'Sí, quitar' : 'Sí, eliminar' }}
        </button>
      </div>
    </app-dialog>
  `,
  styles: `
    :host {
      display: block;
    }

    .page-header {
      flex-wrap: nowrap;
      align-items: center;
      padding: 18px 24px;
      border: 1px solid var(--adm-brand-border);
      border-radius: 18px;
      background: linear-gradient(115deg, color-mix(in srgb, var(--adm-brand-soft) 45%, var(--adm-surface)), var(--adm-surface) 70%);
      box-shadow: 0 4px 20px rgba(42, 52, 72, .03);
    }
    .page-header > div:first-child { flex: 1 1 auto; min-width: 0; }
    .portal-header-identity { display: flex; align-items: center; flex: 1 1 auto; min-width: 0; }
    .portal-header-copy { min-width: 0; }
    .portal-title-icon { display: inline-block; margin-right: 10px; color: var(--adm-brand); font-size: .72em; vertical-align: .08em; }
    .portal-header-copy .page-title { display: flex; align-items: center; gap: 0; margin: 0 0 3px; line-height: 1.22; }
    .portal-header-copy .page-sub { margin: 0; }
    @media (max-width: 600px) { .portal-title-icon { margin-right: 8px; } }
    .page-header .page-title { font-size: clamp(1.35rem, 1.8vw, 1.65rem); letter-spacing: -.025em; }
    .page-header .page-sub { max-width: 75ch; font-size: .83rem; line-height: 1.45; }
    .page-header-actions { align-self: center; flex: 0 0 auto; min-width: 0; justify-content: flex-end; flex-wrap: nowrap; gap: 8px; }
    .page-header-actions .btn-ghost { white-space: nowrap; padding-inline: 12px; font-size: .78rem; }
    .page-header-actions .badge { white-space: nowrap; }
    @media (max-width: 720px) { .page-header { padding: 20px; } .page-header-actions { width: auto; } }
    @media (max-width: 900px) { .page-header { gap: 12px; } .page-header-actions { flex-wrap: nowrap; } }
    @media (max-width: 760px) { .page-header { flex-wrap: wrap; } .page-header-actions { width: 100%; flex-wrap: wrap; justify-content: flex-start; } }

    .marco-lienzo {
      min-width: 0;
      padding: 24px;
      border: 1px solid var(--adm-line);
      border-radius: var(--adm-radius);
      background: linear-gradient(180deg, color-mix(in srgb, var(--adm-brand-soft) 35%, var(--adm-surface)) 0, var(--adm-bg) 130px);
      box-shadow: var(--adm-shadow);
    }

    .marco-extra:not(:empty) {
      margin-top: 22px;
    }

    .admin-tabs { scroll-padding-inline: 12px; }
    .admin-tab[aria-selected="true"] { color: var(--adm-brand); }
    .marco-lienzo :focus-visible { outline-color: var(--adm-brand); }
    .page-header-actions .fa {
      font-size: 0.72rem;
    }

    .save-bar {
      align-items: center;
    }

    .save-ok {
      margin-right: auto;
      display: inline-flex;
      align-items: center;
      gap: 7px;
      color: var(--adm-ok);
      font-size: 0.83rem;
      font-weight: 600;
    }

    .btn-save .fa,
    .btn-danger .fa {
      font-size: 0.8rem;
    }

    .confirmacion-contenido { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 12px; padding: 4px 8px 6px; }
    .confirmacion-titulo { margin: 0; font-size: 1.2rem; line-height: 1.4; font-weight: 750; color: var(--adm-ink); }
    .confirmacion-detalle { margin: 0; font-size: .95rem; line-height: 1.65; color: var(--adm-ink-soft); }
    .confirmacion-nota { margin: 0; font-size: .8rem; color: var(--adm-ink-soft); }
    .confirmacion-acciones { display: flex; width: 100%; gap: 12px; }
    .confirmacion-acciones button { flex: 1 1 0; min-width: 0; min-height: 44px; border-radius: 10px; }
    @media (max-width: 620px) {
      .marco-lienzo {
        padding: 16px;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditorModuloMarco {
  readonly icono = computed(() => MODULO_META.find((modulo) => modulo.path === this.publicPath())?.icon ?? 'fa-file-lines');
  readonly editor = input.required<EditorModuloVista>();
  readonly titulo = input.required<string>();
  readonly sub = input.required<string>();
  readonly publicPath = input.required<string>();
  readonly tabs = input.required<readonly MarcoTab[]>();
  readonly activa = model.required<string>();
}
