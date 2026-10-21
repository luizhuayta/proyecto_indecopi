import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../cms/auth.service';

/**
 * Acceso al panel. Comprueba si ya hay sesión y, si no, muestra el formulario
 * de usuario y contraseña.
 */
@Component({
  selector: 'app-admin-login',
  standalone: true,
  template: `
    <div class="login">
      <div class="login__tarjeta">
        <h1 class="login__titulo">Acceso al panel</h1>
        <p class="admin-subtitulo">Entra con tu usuario para administrar el sitio.</p>

        @if (error()) {
          <p class="admin-banner admin-banner--error" role="alert">{{ error() }}</p>
        }

        <form (ngSubmit)="submit()">
          <div class="admin-campo">
            <label for="usuario">Usuario</label>
            <input
              id="usuario"
              class="admin-control"
              type="text"
              autocomplete="username"
              [value]="usuario()"
              (input)="usuario.set($any($event.target).value)"
            />
          </div>
          <div class="admin-campo">
            <label for="contrasena">Contraseña</label>
            <input
              id="contrasena"
              class="admin-control"
              type="password"
              autocomplete="current-password"
              [value]="contrasena()"
              (input)="contrasena.set($any($event.target).value)"
            />
          </div>
          <button type="submit" class="admin-btn admin-btn--primario" [disabled]="busy()">
            {{ busy() ? 'Entrando…' : 'Entrar' }}
          </button>
        </form>
      </div>
    </div>
  `,
  styles: [
    `
      .admin-subtitulo {
        margin: 0;
        color: var(--color-texto-suave);
      }
    `,
  ],
})
export class AdminLogin implements OnInit {
  private auth = inject(AuthService);
  private router = inject(Router);

  readonly usuario = signal('');
  readonly contrasena = signal('');
  readonly error = signal('');
  readonly busy = signal(false);

  async ngOnInit(): Promise<void> {
    if (await this.auth.ensureSession()) {
      await this.router.navigateByUrl('/admin');
    }
  }

  async submit(): Promise<void> {
    if (!this.usuario().trim() || !this.contrasena()) {
      this.error.set('Escribe tu usuario y tu contraseña.');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    const error = await this.auth.login(this.usuario().trim(), this.contrasena());
    this.busy.set(false);
    if (error) {
      this.error.set(error);
      return;
    }
    await this.router.navigateByUrl('/admin');
  }
}
