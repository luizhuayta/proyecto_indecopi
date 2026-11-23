import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../cms/auth.service';
import { PALETAS_PANEL, PreferenciasPanel } from './preferencias-panel';

/**
 * El usuario en sesión cambia su propia contraseña. La API invalida todas
 * las sesiones al cambiarla, así que al terminar se vuelve al login.
 */
@Component({
  selector: 'app-admin-cuenta',
  standalone: true,
  imports: [FormsModule],
  template: `
    <header class="admin-encabezado">
      <div>
        <h2 class="admin-encabezado__titulo">Mi cuenta</h2>
        <p class="admin-subtitulo admin-encabezado__texto">
          Cambia la contraseña de <strong>{{ auth.username() }}</strong
          >. Al hacerlo se cerrarán todas las sesiones abiertas, incluida esta.
        </p>
      </div>
    </header>

    @if (error()) {
      <p class="admin-banner admin-banner--error" role="alert">{{ error() }}</p>
    }

    <section class="admin-alta admin-tarjeta" aria-labelledby="titulo-clave">
      <h2 id="titulo-clave" class="admin-titulo admin-titulo--chico">Cambiar contraseña</h2>
      <form class="admin-form-alta" (ngSubmit)="submit()">
        <div class="admin-campo">
          <label for="actual">Contraseña actual</label>
          <input
            id="actual"
            class="admin-control"
            type="password"
            autocomplete="current-password"
            [(ngModel)]="actual"
            name="actual"
            [disabled]="busy()"
          />
        </div>
        <div class="admin-campo">
          <label for="nueva">Contraseña nueva</label>
          <input
            id="nueva"
            class="admin-control"
            type="password"
            autocomplete="new-password"
            [(ngModel)]="nueva"
            name="nueva"
            [disabled]="busy()"
          />
        </div>
        <div class="admin-campo">
          <label for="confirmacion">Repite la contraseña nueva</label>
          <input
            id="confirmacion"
            class="admin-control"
            type="password"
            autocomplete="new-password"
            [(ngModel)]="confirmacion"
            name="confirmacion"
            [disabled]="busy()"
          />
        </div>
        <button type="submit" class="admin-btn admin-btn--primario" [disabled]="busy()">
          {{ busy() ? 'Cambiando…' : 'Cambiar contraseña' }}
        </button>
      </form>
    </section>

    <section class="admin-tarjeta cuenta-paleta" aria-labelledby="titulo-paleta">
      <h2 id="titulo-paleta">Paleta de colores</h2>
      <p class="admin-encabezado__texto">
        Elige el color de los botones, iconos y elementos activos del panel. Se guarda en
        este navegador y no cambia los colores del sitio público.
      </p>
      <fieldset class="paletas">
        <legend class="sr-only">Paleta del panel</legend>
        @for (p of paletas; track p.id) {
          <label class="paleta" [style.--muestra]="p.color">
            <input
              type="radio"
              name="paleta-panel"
              [value]="p.id"
              [checked]="prefs.paleta() === p.id"
              (change)="prefs.elegirPaleta(p.id)"
            />
            <span class="paleta__muestra" aria-hidden="true"><span></span><span></span><span></span></span>
            <span class="paleta__nombre">{{ p.nombre }}</span>
          </label>
        }
      </fieldset>
    </section>
  `,  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        gap: var(--space-16, 1rem);
      }
      .admin-subtitulo {
        margin: 0 0 1rem;
        color: var(--color-texto-suave);
      }
      .admin-alta h2 {
        margin: 0 0 1rem;
        font-size: var(--texto-lg, 1.125rem);
      }
      .admin-form-alta {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr)) auto;
        align-items: end;
        gap: 1rem;
      }
      @media (max-width: 900px) {
        .admin-form-alta {
          grid-template-columns: 1fr;
        }
      }
      .cuenta-paleta h2 {
        margin: 0 0 0.4rem;
      }
      .paletas {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(9.5rem, 1fr));
        gap: 0.75rem;
        margin: 1rem 0 0;
        padding: 0;
        border: 0;
      }
      .paleta {
        position: relative;
        display: grid;
        gap: 0.6rem;
        padding: 0.75rem;
        border: 1px solid var(--color-borde);
        border-radius: 12px;
        cursor: pointer;
      }
      .paleta:has(input:checked) {
        border-color: var(--muestra);
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--muestra) 18%, transparent);
      }
      .paleta:has(input:focus-visible) {
        outline: 2px solid var(--muestra);
        outline-offset: 2px;
      }
      .paleta input {
        position: absolute;
        opacity: 0;
      }
      .paleta__muestra {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        padding: 0.55rem;
        border-radius: 8px;
        background: var(--color-superficie);
      }
      .paleta__muestra span:first-child {
        width: 1.4rem;
        height: 1.4rem;
        border-radius: 6px;
        background: var(--muestra);
      }
      .paleta__muestra span:nth-child(2) {
        flex: 1;
        height: 0.4rem;
        border-radius: 999px;
        background: color-mix(in srgb, var(--muestra) 25%, var(--color-borde));
      }
      .paleta__muestra span:last-child {
        width: 0.9rem;
        height: 0.9rem;
        border-radius: 4px;
        background: color-mix(in srgb, var(--muestra) 45%, #fff);
      }
      .paleta__nombre {
        font-size: 0.8rem;
        font-weight: 600;
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
export class AdminCuenta {
  auth = inject(AuthService);
  private router = inject(Router);

  readonly prefs = inject(PreferenciasPanel);
  readonly paletas = PALETAS_PANEL;

  actual = '';
  nueva = '';
  confirmacion = '';
  readonly error = signal('');
  readonly busy = signal(false);

  async submit(): Promise<void> {
    if (this.busy()) {
      return;
    }
    if (!this.actual || !this.nueva) {
      this.error.set('Escribe tu contraseña actual y la nueva.');
      return;
    }
    if (this.nueva.length < 8) {
      this.error.set('La contraseña nueva debe tener al menos 8 caracteres.');
      return;
    }
    if (this.nueva !== this.confirmacion) {
      this.error.set('La confirmación no coincide con la contraseña nueva.');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    const error = await this.auth.cambiarContrasena(this.actual, this.nueva);
    this.busy.set(false);
    if (error) {
      this.error.set(error);
      return;
    }
    // La sesión quedó invalidada por el backend.
    this.auth.username.set(null);
    this.auth.role.set('');
    this.auth.csrfToken.set('');
    await this.router.navigateByUrl('/admin/login');
  }
}
