import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { NgStyle } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../cms/auth.service';
import { SitioPublicoService } from '../core/sitio-publico.service';

/**
 * Acceso al panel, en dos paneles: a un lado la marca (nombre, logo y ciudad
 * de la institución sobre el color elegido), al otro el formulario de usuario
 * y contraseña. Comprueba si ya hay sesión antes de mostrarse.
 */
@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [FormsModule, NgStyle],
  template: `
    <div class="login" [ngStyle]="sitio.tema()">
      <aside class="login__marca">
        <div class="login__sello">
          @if (logo(); as logo) {
            <img
              [src]="logo"
              [alt]="sitio.texto('logo_alt') || sitio.nombre()"
              width="60"
              height="60"
            />
          } @else {
            <span aria-hidden="true">{{ sitio.nombre().slice(0, 1) }}</span>
          }
          <p><strong>Panel administrativo</strong><span>Gestión del portal institucional</span></p>
        </div>
        <div class="login__lema">
          <p class="login__nombre">{{ sitio.nombre() }}</p>
          @if (sitio.identidad()?.ciudad; as ciudad) {
            <p class="login__ciudad">{{ ciudad }}</p>
          }
        </div>
      </aside>
      <main class="login__principal">
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
            <button
              type="submit"
              class="admin-btn admin-btn--primario login__entrar"
              [disabled]="busy()"
            >
              {{ busy() ? 'Entrando…' : 'Entrar' }}
            </button>
          </form>
          <p class="login__pie">Acceso exclusivo para personal autorizado.</p>
        </div>
      </main>
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
  /** El panel de marca se pinta con los colores y el logo publicados. */
  readonly sitio = inject(SitioPublicoService);
  readonly logo = computed(() => this.sitio.urlSegura(this.sitio.texto('logo_url')));

  readonly usuario = signal('');
  readonly contrasena = signal('');
  readonly error = signal('');
  readonly busy = signal(false);

  async ngOnInit(): Promise<void> {
    void this.sitio.cargar();
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
