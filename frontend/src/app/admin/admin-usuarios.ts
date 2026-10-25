import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../cms/auth.service';
import { CmsApiService, UsuarioItem } from '../cms/cms-api.service';
import { EstadoVacio } from './estado-vacio';

/** Mensaje del servidor cuando rechaza una operación; si no hay, el genérico. */
function mensajeDeError(err: unknown, porDefecto: string): string {
  const mensaje = (err as { error?: { message?: string } } | null)?.error?.message;
  return typeof mensaje === 'string' && mensaje ? mensaje : porDefecto;
}

/**
 * Cuentas del panel: lista, alta de usuarios y cambio de rol o de estado.
 * Solo un administrador puede entrar aquí. Un usuario no puede desactivar su
 * propia cuenta ni cambiarse el rol, igual que exige el servidor.
 */
@Component({
  selector: 'app-admin-usuarios',
  standalone: true,
  imports: [FormsModule, DatePipe, EstadoVacio],
  template: `
    <header>
      <h1 class="admin-titulo">Usuarios</h1>
      <p class="admin-subtitulo">
        Las cuentas que pueden entrar al panel. Solo un administrador puede crear cuentas y
        cambiar roles o estados.
      </p>
    </header>

    @if (error()) {
      <p class="admin-banner admin-banner--error" role="alert">{{ error() }}</p>
    }
    @if (status()) {
      <p class="admin-banner admin-banner--ok" role="status">{{ status() }}</p>
    }

    <section class="admin-alta" aria-labelledby="titulo-alta">
      <h2 id="titulo-alta" class="admin-titulo admin-titulo--chico">Nueva cuenta</h2>
      <form class="admin-form-alta" (ngSubmit)="crear()">
        <div class="admin-campo">
          <label for="nuevo-usuario">Usuario</label>
          <input
            id="nuevo-usuario"
            class="admin-control"
            name="usuario"
            autocomplete="off"
            [(ngModel)]="nuevoUsuario"
          />
          <p class="admin-ayuda">De 3 a 80 caracteres: letras, números, punto o guion.</p>
        </div>
        <div class="admin-campo">
          <label for="nuevo-contrasena">Contraseña inicial</label>
          <input
            id="nuevo-contrasena"
            class="admin-control"
            type="password"
            name="contrasena"
            autocomplete="new-password"
            [(ngModel)]="nuevaContrasena"
          />
          <p class="admin-ayuda">Mínimo 8 caracteres. La persona puede cambiarla después.</p>
        </div>
        <div class="admin-campo">
          <label for="nuevo-rol">Rol</label>
          <select id="nuevo-rol" class="admin-control" name="rol" [(ngModel)]="nuevoRol">
            <option value="editor">Editor</option>
            <option value="admin">Administrador</option>
          </select>
        </div>
        <button type="submit" class="admin-btn admin-btn--primario" [disabled]="creando()">
          {{ creando() ? 'Creando…' : 'Crear usuario' }}
        </button>
      </form>
    </section>

    @if (cargando()) {
      <p class="admin-vacio">Cargando usuarios…</p>
    } @else if (usuarios().length === 0) {
      <app-estado-vacio
        icono="usuarios"
        titulo="Todavía no hay usuarios"
        mensaje="Crea la primera cuenta para que alguien pueda entrar al panel y administrar el sitio."
      />
    } @else {
      <table class="admin-tabla">
        <caption class="sr-only">Cuentas del panel</caption>
        <thead>
          <tr>
            <th scope="col">Usuario</th>
            <th scope="col">Rol</th>
            <th scope="col">Estado</th>
            <th scope="col">Creada</th>
            <th scope="col"><span class="sr-only">Acciones</span></th>
          </tr>
        </thead>
        <tbody>
          @for (u of usuarios(); track u.id) {
            <tr>
              <th scope="row">
                {{ u.usuario }}
                @if (esPropio(u)) {
                  <span class="admin-etiqueta">Tú</span>
                }
              </th>
              <td>
                <label class="sr-only" [for]="'rol-' + u.id">Rol de {{ u.usuario }}</label>
                <select
                  [id]="'rol-' + u.id"
                  class="admin-control admin-control--chico"
                  [value]="u.rol"
                  [disabled]="esPropio(u) || actualizando() !== null"
                  (change)="cambiarRol(u, $any($event.target).value)"
                >
                  <option value="editor">Editor</option>
                  <option value="admin">Administrador</option>
                </select>
              </td>
              <td>
                <span class="admin-etiqueta" [class.admin-etiqueta--ok]="u.activo">
                  {{ u.activo ? 'Activa' : 'Desactivada' }}
                </span>
              </td>
              <td>{{ u.creado_en | date: 'dd/MM/yyyy' }}</td>
              <td>
                <button
                  type="button"
                  [id]="'activar-' + u.id"
                  class="admin-btn admin-btn--chico"
                  [disabled]="esPropio(u) || actualizando() !== null"
                  [attr.title]="esPropio(u) ? 'No puedes desactivar tu propia cuenta.' : null"
                  (click)="cambiarActivo(u)"
                >
                  {{ u.activo ? 'Desactivar' : 'Activar' }}
                </button>
              </td>
            </tr>
          }
        </tbody>
      </table>
      <p class="admin-ayuda">No puedes desactivar tu propia cuenta ni cambiarte el rol.</p>
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
      .admin-titulo--chico {
        font-size: 1.25rem;
      }
      .admin-subtitulo {
        margin: 0;
        color: var(--color-texto-suave);
      }
      .admin-vacio {
        color: var(--color-texto-suave);
        margin: 0;
      }
      .admin-alta {
        padding: 1.25rem;
        border: 1px solid var(--color-borde);
        border-radius: var(--radio-tarjeta);
        background: var(--color-superficie);
        box-shadow: var(--shadow-sm);
      }
      .admin-form-alta {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr)) auto;
        align-items: start;
        gap: 1rem;
      }
      .admin-ayuda {
        margin: 0;
        font-size: var(--texto-xs, 0.75rem);
        color: var(--color-texto-suave);
      }
      .admin-control--chico {
        width: auto;
        min-width: 9rem;
      }
      .admin-etiqueta {
        display: inline-block;
        margin-left: 0.35rem;
        padding: 0.15rem 0.5rem;
        border: 1px solid var(--color-borde);
        border-radius: var(--radio-campo);
        font-size: 0.875rem;
        font-weight: 400;
      }
      .admin-etiqueta--ok {
        border-color: var(--color-primario);
        color: var(--color-primario);
      }
      .admin-btn--chico {
        padding: 0.35rem 0.75rem;
        font-size: 0.875rem;
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
      @media (max-width: 900px) {
        .admin-form-alta {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class AdminUsuarios implements OnInit {
  private readonly api = inject(CmsApiService);
  private readonly auth = inject(AuthService);

  readonly usuarios = signal<UsuarioItem[]>([]);
  readonly cargando = signal(false);
  readonly creando = signal(false);
  readonly actualizando = signal<number | null>(null);
  readonly error = signal('');
  readonly status = signal('');

  nuevoUsuario = '';
  nuevaContrasena = '';
  nuevoRol: 'admin' | 'editor' = 'editor';

  ngOnInit(): void {
    void this.cargar();
  }

  esPropio(u: UsuarioItem): boolean {
    return this.auth.username() === u.usuario;
  }

  async cargar(): Promise<void> {
    this.cargando.set(true);
    this.error.set('');
    try {
      this.usuarios.set(await this.api.listarUsuarios());
    } catch {
      this.error.set(
        'No se pudo cargar la lista de usuarios. Revisa tu conexión e inténtalo de nuevo.',
      );
    } finally {
      this.cargando.set(false);
    }
  }

  async crear(): Promise<void> {
    const usuario = this.nuevoUsuario.trim().toLowerCase();
    const contrasena = this.nuevaContrasena;
    this.error.set('');
    this.status.set('');

    if (!/^[a-z0-9._-]{3,80}$/.test(usuario)) {
      this.error.set('Usa un usuario de 3 a 80 caracteres: letras, números, punto o guion.');
      return;
    }
    if (contrasena.length < 8) {
      this.error.set('La contraseña inicial debe tener al menos 8 caracteres.');
      return;
    }

    this.creando.set(true);
    try {
      const item = await this.api.crearUsuario({ usuario, contrasena, rol: this.nuevoRol });
      this.usuarios.update((lista) => [...lista, item]);
      this.nuevoUsuario = '';
      this.nuevaContrasena = '';
      this.nuevoRol = 'editor';
      this.status.set(`Usuario ${item.usuario} creado.`);
    } catch (err: unknown) {
      this.error.set(mensajeDeError(err, 'No se pudo crear el usuario. Revisa tu conexión.'));
    } finally {
      this.creando.set(false);
    }
  }

  async cambiarRol(u: UsuarioItem, rol: string): Promise<void> {
    if (rol !== 'admin' && rol !== 'editor') {
      return;
    }
    if (this.esPropio(u) && rol !== 'admin') {
      this.error.set('No puedes quitarte el rol de administrador.');
      return;
    }
    if (rol === u.rol) {
      return;
    }
    this.actualizando.set(u.id);
    this.error.set('');
    this.status.set('');
    try {
      const item = await this.api.actualizarUsuario(u.id, { rol });
      this.reemplazar(item);
      this.status.set(`Rol de ${u.usuario} actualizado a ${this.nombreRol(item.rol)}.`);
    } catch (err: unknown) {
      this.error.set(mensajeDeError(err, 'No se pudo cambiar el rol. Revisa tu conexión.'));
    } finally {
      this.actualizando.set(null);
    }
  }

  async cambiarActivo(u: UsuarioItem): Promise<void> {
    if (this.esPropio(u)) {
      this.error.set('No puedes desactivar tu propia cuenta.');
      return;
    }
    const activo = !u.activo;
    this.actualizando.set(u.id);
    this.error.set('');
    this.status.set('');
    try {
      const item = await this.api.actualizarUsuario(u.id, { activo });
      this.reemplazar(item);
      this.status.set(`Cuenta ${item.usuario} ${item.activo ? 'activada' : 'desactivada'}.`);
    } catch (err: unknown) {
      this.error.set(mensajeDeError(err, 'No se pudo cambiar la cuenta. Revisa tu conexión.'));
    } finally {
      this.actualizando.set(null);
    }
  }

  nombreRol(rol: string): string {
    return rol === 'admin' ? 'Administrador' : 'Editor';
  }

  private reemplazar(item: UsuarioItem): void {
    this.usuarios.update((lista) => lista.map((u) => (u.id === item.id ? { ...u, ...item } : u)));
  }
}
