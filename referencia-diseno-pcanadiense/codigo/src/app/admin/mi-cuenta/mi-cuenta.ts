import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { PortalApi } from '../../core/api/portal.api';
import { ToastService } from '../shared/toast/toast';
import { AdminPaletaService, PALETAS_INSTITUCIONALES, type PaletaInstitucional } from '../shared/admin-paleta.service';

/**
 * La cuenta de quien está usando el panel. Existe porque gestionar cuentas vive
 * en /admin/usuarios y eso es solo para administradores: sin esta pantalla, una
 * persona con rol editor nunca podría cambiar la contraseña que le dieron.
 */
@Component({
  selector: 'app-admin-mi-cuenta',
  standalone: true,
  styles: `
    :host { display:block; min-width:0; }
    .admin-page { width:100%; max-width:1080px; margin-inline:auto; display:grid; gap:18px; }
    .page-header { display:flex; justify-content:flex-start; align-items:center; gap:12px; padding:17px 22px; border:1px solid var(--adm-brand-border); border-radius:16px; background:var(--adm-surface); }
    .account-icon { display:inline-flex; align-items:center; justify-content:center; flex:0 0 54px; width:54px; height:54px; border:1px solid color-mix(in srgb,var(--adm-brand) 43%,var(--adm-line)); border-radius:14px; background:color-mix(in srgb,var(--adm-brand) 5%,var(--adm-surface)); color:var(--adm-brand); font-size:1.12rem; box-sizing:border-box; }
    .page-header .account-heading { display:flex; flex-direction:column; flex:1 1 auto; min-width:0; text-align:left; }
    .page-header .page-title { margin:0 0 3px; font-size:clamp(1.4rem,2vw,1.7rem); }
    .page-header .page-sub { line-height:1.45; margin:0; }
    .admin-card { padding:22px 26px; }
    .card-heading { display:flex; align-items:center; gap:10px; margin:0 0 17px; font-size:1.08rem; font-weight:750; color:var(--adm-ink); }
    .card-heading i { color:var(--adm-brand); font-size:.9rem; }
    .identity-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:16px; }
    .identity-field { padding:13px 16px; border:1px solid var(--adm-line); border-radius:11px; background:var(--adm-bg); min-width:0; }
    .identity-label { display:block; margin-bottom:5px; font-size:.77rem; font-weight:650; color:var(--adm-muted); }
    .identity-value { display:block; font-weight:700; overflow-wrap:anywhere; }
    .role-note { margin:14px 0 0; line-height:1.5; }
    .security-note { display:flex; gap:9px; align-items:flex-start; padding:11px 13px; margin:0 0 20px; background:var(--adm-bg); border:1px solid var(--adm-line); border-radius:10px; font-size:.82rem; line-height:1.5; color:var(--adm-muted); }
    .security-note i { margin-top:3px; color:var(--adm-brand); }
    .form-grid { gap:16px 18px; }
    .form-row { min-width:0; margin-bottom:0; }
    .password-wrap { position:relative; }
    .password-wrap input { padding-right:48px !important; }
    .visibility-button { position:absolute; right:5px; top:50%; transform:translateY(-50%); width:38px; height:36px; border:0; border-radius:8px; background:transparent; color:var(--adm-muted); cursor:pointer; }
    .visibility-button:hover { background:var(--adm-bg); color:var(--adm-brand); }
    .visibility-button:focus-visible { outline:2px solid var(--adm-brand); }
    .form-hint { margin:5px 0 0; }
    .password-error { margin:5px 0 0; font-size:.78rem; color:var(--adm-danger); }
    .palette-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:10px; }
    .palette-option { display:flex; flex-direction:column; align-items:stretch; gap:10px; padding:13px; border:1px solid var(--adm-line); border-radius:12px; background:var(--adm-surface); color:var(--adm-ink); text-align:left; cursor:pointer; font:inherit; transition:border-color .18s ease,box-shadow .18s ease; }
    .palette-option:hover { border-color:#b7c3d1; box-shadow:0 3px 12px rgba(30,41,59,.06); }
    .palette-option.is-selected { border-color:var(--adm-brand); box-shadow:0 0 0 1px var(--adm-brand); }
    .palette-option:focus-visible { outline:2px solid var(--adm-brand); outline-offset:3px; }
    .palette-preview { display:flex; align-items:center; gap:7px; padding:10px; border-radius:9px; background:var(--adm-bg); border:1px solid var(--adm-line); }
    .palette-preview-mark { width:32px; height:32px; flex:0 0 32px; border-radius:8px; background:var(--preview-primary); }
    .palette-preview-lines { display:flex; flex-direction:column; gap:5px; flex:1; min-width:0; }
    .palette-preview-lines::before { content:''; display:block; width:82%; height:6px; border-radius:5px; background:var(--adm-ink-soft); opacity:.5; }
    .palette-preview-lines::after { content:''; display:block; width:56%; height:5px; border-radius:5px; background:var(--adm-line); }
    .palette-preview-action { width:18px; height:18px; border-radius:5px; background:var(--preview-primary); opacity:.8; }
    .palette-option-bottom { display:flex; align-items:center; justify-content:space-between; gap:6px; }
    .palette-name { font-weight:700; font-size:.85rem; }
    .palette-selected { color:var(--adm-brand); font-size:.9rem; }
    .palette-note { margin:12px 0 0; font-size:.8rem; color:var(--adm-muted); }
    .palette-actions { display:flex; justify-content:flex-end; margin-top:14px; }
    .save-bar { margin-top:19px; padding:15px 0 0; border-top:1px solid var(--adm-line); background:none; }
    @media(max-width:600px) { .account-icon { flex-basis:44px; width:44px; height:44px; border-radius:12px; } }
    @media(max-width:720px) { .palette-grid { grid-template-columns:repeat(auto-fit,minmax(145px,1fr)); } .admin-page { gap:14px; } .page-header,.admin-card { padding:16px; } .identity-grid,.form-grid { grid-template-columns:1fr; } .form-grid .span-2 { grid-column:auto; } .save-bar .btn-save { width:100%; } }
  `,
  template: `
    <div class="admin-page">
      <header class="page-header">
        <span class="account-icon" aria-hidden="true"><i class="fa-solid fa-user-gear"></i></span>
        <div class="account-heading">
          <h1 class="page-title">Mi cuenta</h1>
          <p class="page-sub">Consulta tus datos y administra la seguridad de tu acceso.</p>
        </div>
      </header>

      <section class="admin-card" aria-labelledby="account-data-title">
        <h2 id="account-data-title" class="card-heading"><i class="fa-solid fa-id-card" aria-hidden="true"></i> Información de la cuenta</h2>
        <div class="identity-grid">
          <div class="identity-field">
            <span class="identity-label">Nombre</span>
            <span class="identity-value">{{ usuario()?.nombre || '—' }}</span>
          </div>
          <div class="identity-field">
            <span class="identity-label">Rol</span>
            <span class="identity-value">{{ usuario()?.rol === 'admin' ? 'Administrador' : 'Editor' }}</span>
          </div>
        </div>
        @if (usuario()?.rol === 'editor') {
          <p class="form-hint role-note">Puedes gestionar el contenido del portal. La administración de cuentas está reservada a los administradores.</p>
        }
      </section>

      <section class="admin-card" aria-labelledby="account-password-title">
        <h2 id="account-password-title" class="card-heading"><i class="fa-solid fa-lock" aria-hidden="true"></i> Cambiar contraseña</h2>
        <p class="security-note"><i class="fa-solid fa-shield-halved" aria-hidden="true"></i><span>Al cambiar tu contraseña se cerrarán las sesiones abiertas y tendrás que iniciar sesión nuevamente.</span></p>
        <form (submit)="$event.preventDefault(); cambiar()">
          <div class="form-grid">
            <div class="form-row span-2">
              <label for="pw-actual">Contraseña actual</label>
              <div class="password-wrap">
                <input id="pw-actual" [type]="verActual() ? 'text' : 'password'" autocomplete="current-password" [value]="actual()" (input)="actual.set($any($event.target).value)" />
                <button type="button" class="visibility-button" [attr.aria-label]="verActual() ? 'Ocultar contraseña actual' : 'Mostrar contraseña actual'" [attr.aria-pressed]="verActual()" (click)="verActual.set(!verActual())"><i class="fa-solid" [class.fa-eye]="!verActual()" [class.fa-eye-slash]="verActual()"></i></button>
              </div>
            </div>
            <div class="form-row">
              <label for="pw-nueva">Nueva contraseña</label>
              <div class="password-wrap">
                <input id="pw-nueva" [type]="verNueva() ? 'text' : 'password'" autocomplete="new-password" [value]="nueva()" (input)="nueva.set($any($event.target).value)" />
                <button type="button" class="visibility-button" [attr.aria-label]="verNueva() ? 'Ocultar nueva contraseña' : 'Mostrar nueva contraseña'" [attr.aria-pressed]="verNueva()" (click)="verNueva.set(!verNueva())"><i class="fa-solid" [class.fa-eye]="!verNueva()" [class.fa-eye-slash]="verNueva()"></i></button>
              </div>
              <p class="form-hint">Mínimo 8 caracteres.</p>
            </div>
            <div class="form-row">
              <label for="pw-repetir">Confirmar nueva contraseña</label>
              <div class="password-wrap">
                <input id="pw-repetir" [type]="verRepetir() ? 'text' : 'password'" autocomplete="new-password" [value]="repetir()" (input)="repetir.set($any($event.target).value)" [attr.aria-invalid]="repetir() && !coinciden() ? true : null" [attr.aria-describedby]="repetir() && !coinciden() ? 'pw-error' : null" />
                <button type="button" class="visibility-button" [attr.aria-label]="verRepetir() ? 'Ocultar confirmación' : 'Mostrar confirmación'" [attr.aria-pressed]="verRepetir()" (click)="verRepetir.set(!verRepetir())"><i class="fa-solid" [class.fa-eye]="!verRepetir()" [class.fa-eye-slash]="verRepetir()"></i></button>
              </div>
              @if (repetir() && !coinciden()) {
                <p id="pw-error" class="password-error">Las contraseñas no coinciden.</p>
              }
            </div>
          </div>
          <div class="save-bar">
            <button type="submit" class="btn-save" [disabled]="!puedeGuardar() || guardando()"><i class="fa-solid fa-key" aria-hidden="true"></i> {{ guardando() ? 'Actualizando…' : 'Actualizar contraseña' }}</button>
          </div>
        </form>
      </section>

      <section class="admin-card" aria-labelledby="account-palette-title">
        <h2 id="account-palette-title" class="card-heading"><i class="fa-solid fa-palette" aria-hidden="true"></i> Paleta de colores</h2>
        <p class="form-hint" style="margin:0 0 16px">Elige un color para los botones, iconos y elementos activos. Los fondos y las tarjetas conservarán su aspecto original.</p>
        <div class="palette-grid" role="group" aria-label="Paleta institucional">
          @for (opcion of paletas; track opcion.id) {
            <button type="button" class="palette-option" [class.is-selected]="seleccionada() === opcion.id" [attr.aria-pressed]="seleccionada() === opcion.id" [style.--preview-primary]="opcion.principal" (click)="seleccionada.set(opcion.id)">
              <span class="palette-preview" aria-hidden="true">
                <span class="palette-preview-mark"></span>
                <span class="palette-preview-lines"></span>
                <span class="palette-preview-action"></span>
              </span>
              <span class="palette-option-bottom">
                <span class="palette-name">{{ opcion.nombre }}</span>
                @if (seleccionada() === opcion.id) { <i class="fa-solid fa-circle-check palette-selected" aria-label="Seleccionado"></i> }
              </span>
            </button>
          }
        </div>
        <div class="palette-actions">
          <button type="button" class="btn-save" [disabled]="seleccionada() === paleta.actual()" (click)="guardarPaleta()">
            <i class="fa-solid fa-check" aria-hidden="true"></i> Aplicar colores
          </button>
        </div>
        <p class="palette-note">Esta preferencia se conserva en este navegador. No modifica los colores de la página pública.</p>
      </section>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminMiCuenta {
  private readonly auth = inject(AuthService);
  private readonly api = inject(PortalApi);
  private readonly toast = inject(ToastService);
  readonly paleta = inject(AdminPaletaService);
  readonly paletas = PALETAS_INSTITUCIONALES;
  readonly seleccionada = signal<PaletaInstitucional>(this.paleta.actual());

  readonly usuario = this.auth.usuario;

  readonly actual = signal('');
  readonly nueva = signal('');
  readonly repetir = signal('');
  readonly guardando = signal(false);
  readonly verActual = signal(false);
  readonly verNueva = signal(false);
  readonly verRepetir = signal(false);

  readonly coinciden = computed(() => this.nueva() === this.repetir());

  readonly puedeGuardar = computed(
    () => !!this.actual() && this.nueva().length >= 8 && this.coinciden(),
  );

  guardarPaleta(): void {
    this.paleta.guardar(this.seleccionada());
    this.toast.success('Colores del panel actualizados.');
  }

  async cambiar(): Promise<void> {
    if (!this.puedeGuardar()) return;
    this.guardando.set(true);
    try {
      await this.api.cambiarPassword({ actual: this.actual(), nueva: this.nueva() });
      this.toast.success('Contraseña cambiada. Vuelva a iniciar sesión.');
      // El token en curso ya no vale: quedarse en el panel solo daría 401 en la
      // siguiente acción. Se sale de forma ordenada.
      this.auth.logout();
    } catch (error: unknown) {
      const respuesta = error as { status?: number; error?: { message?: string } };
      this.toast.error(
        respuesta.status === 401
          ? 'La contraseña actual no es correcta.'
          : respuesta.error?.message || 'No se pudo cambiar la contraseña.',
      );
    } finally {
      this.guardando.set(false);
    }
  }
}
