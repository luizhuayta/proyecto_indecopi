import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../cms/auth.service';

/**
 * El usuario en sesión cambia su propia contraseña. La API invalida todas
 * las sesiones al cambiarla, así que al terminar se vuelve al login.
 */
@Component({
  selector: 'app-admin-cuenta',
  standalone: true,
  imports: [FormsModule],
  template: `
    <header>
      <h1 class="admin-titulo">Mi cuenta</h1>
      <p class="admin-subtitulo">
        Cambia la contraseña de <strong>{{ auth.username() }}</strong
        >. Al hacerlo se cerrarán todas las sesiones abiertas, incluida esta.
      </p>
    </header>

    @if (error()) {
      <p class="admin-banner admin-banner--error" role="alert">{{ error() }}</p>
    }

    <section class="admin-alta" aria-labelledby="titulo-clave">
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
  `,  styles: [
    `
      .admin-subtitulo {
        margin: 0 0 1rem;
        color: var(--color-texto-suave);
      }
    `,
  ],
})
export class AdminCuenta {
  auth = inject(AuthService);
  private router = inject(Router);

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
