import { GestionPreview } from '../shared/gestion-preview/gestion-preview';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { PortalApi } from '../../core/api/portal.api';
import { AuthService } from '../../core/auth/auth.service';
import { DialogComponent } from '../../shared/ui';
import { ToastService } from '../shared/toast/toast';
import type { UsuarioAdmin, UsuarioBody } from '../../core/api/api.types';

interface UsuarioForm {
  nombre: string;
  username: string;
  email: string;
  rol: 'admin' | 'editor';
  activo: boolean;
  password: string;
}

const VACIO: UsuarioForm = {
  nombre: '',
  username: '',
  email: '',
  rol: 'editor',
  activo: true,
  password: '',
};

@Component({
  selector: 'app-admin-usuarios',
  standalone: true,
  imports: [GestionPreview, DialogComponent],
  templateUrl: './usuarios.component.html',
  styleUrl: './usuarios.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminUsuariosComponent {
  private readonly api = inject(PortalApi);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly items = signal<UsuarioAdmin[]>([]);
  readonly busqueda = signal('');
  readonly pagina = signal(1);
  readonly porPagina = 10;
  readonly filtrados = computed(() => {
    const q = this.busqueda().trim().toLocaleLowerCase('es');
    const datos = this.items();
    return q ? datos.filter(item => [item.nombre, item.username, item.email, item.rol].some(v => String(v ?? '').toLocaleLowerCase('es').includes(q))) : datos;
  });
  readonly totalPaginas = computed(() => Math.max(1, Math.ceil(this.filtrados().length / this.porPagina)));
  readonly paginaActual = computed(() => Math.min(this.pagina(), this.totalPaginas()));
  readonly paginados = computed(() => this.filtrados().slice((this.paginaActual() - 1) * this.porPagina, this.paginaActual() * this.porPagina));
  buscar(valor: string): void { this.busqueda.set(valor); this.pagina.set(1); }
  cambiarPagina(delta: number): void { this.pagina.set(Math.max(1, Math.min(this.totalPaginas(), this.paginaActual() + delta))); }

  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly formAbierto = signal(false);
  readonly editandoId = signal<string | null>(null);
  readonly form = signal<UsuarioForm>({ ...VACIO });
  private formularioInicial = '';
  readonly hayCambios = computed(() => this.formAbierto() && JSON.stringify(this.form()) !== this.formularioInicial);
  cerrarFormulario(): void {
    if (this.guardando()) return;
    if (this.hayCambios() && !window.confirm('Hay cambios sin guardar. ¿Desea descartarlos?')) return;
    this.formAbierto.set(false);
  }
  alCambiarDialogo(abierto: boolean): void {
    if (!abierto) this.cerrarFormulario();
  }
  readonly confirmar = signal<UsuarioAdmin | null>(null);
  readonly guardando = signal(false);
  readonly eliminando = signal(false);
  private solicitudCarga = 0;
  readonly yo = this.auth.usuario;

  constructor() {
    void this.cargar();
  }

  async cargar(): Promise<void> {
    const solicitud = ++this.solicitudCarga;
    this.cargando.set(true);
    this.error.set(null);
    try {
      const datos = await this.api.usuarios();
      if (solicitud === this.solicitudCarga) this.items.set(datos);
    } catch {
      if (solicitud === this.solicitudCarga) this.error.set('No se pudieron cargar las cuentas. Compruebe sus permisos y la conexión.');
    } finally {
      if (solicitud === this.solicitudCarga) this.cargando.set(false);
    }
  }

  abrirNuevo(): void {
    this.editandoId.set(null);
    this.form.set({ ...VACIO });
    this.formularioInicial = JSON.stringify(this.form());
    this.formAbierto.set(true);
  }

  abrirEditar(usuario: UsuarioAdmin): void {
    this.editandoId.set(usuario.id);
    this.form.set({
      nombre: usuario.nombre,
      username: usuario.username,
      email: usuario.email ?? '',
      rol: usuario.rol,
      activo: usuario.activo,
      password: '',
    });
    this.formularioInicial = JSON.stringify(this.form());
    this.formAbierto.set(true);
  }

  patch<K extends keyof UsuarioForm>(clave: K, valor: UsuarioForm[K]): void {
    this.form.update((actual) => ({ ...actual, [clave]: valor }));
  }

  async guardar(): Promise<void> {
    const datos = this.form();
    if (!datos.nombre.trim() || !datos.username.trim()) {
      this.toast.error('Nombre y usuario son obligatorios.');
      return;
    }
    if (!/^[a-zA-Z0-9._-]+$/.test(datos.username.trim())) {
      this.toast.error('El usuario solo admite letras, números, punto, guion y guion bajo.');
      return;
    }
    if (datos.email.trim() && (!datos.email.includes('@') || !datos.email.split('@')[1]?.includes('.'))) {
      this.toast.error('Ingrese un correo electrónico válido.');
      return;
    }
    const id = this.editandoId();
    if (!id && datos.password.length < 8) {
      this.toast.error('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (id && datos.password && datos.password.length < 8) {
      this.toast.error('La contraseña nueva debe tener al menos 8 caracteres.');
      return;
    }

    const cuerpo: UsuarioBody = {
      nombre: datos.nombre.trim(),
      username: datos.username.trim(),
      email: datos.email.trim() || null,
      rol: datos.rol,
      activo: datos.activo,
    };
    if (datos.password) cuerpo.password = datos.password;

    if (this.guardando()) return;
    this.guardando.set(true);
    try {
      if (id) {
        await this.api.actualizarUsuario(id, cuerpo);
        this.toast.success('Cuenta actualizada.');
      } else {
        await this.api.crearUsuario(cuerpo);
        this.toast.success('Cuenta creada.');
      }
      this.formAbierto.set(false);
      await this.cargar();
    } catch (error) {
      this.toast.error(this.mensaje(error, 'No se pudo guardar la cuenta.'));
    } finally {
      this.guardando.set(false);
    }
  }

  async eliminar(): Promise<void> {
    const usuario = this.confirmar();
    if (!usuario || this.eliminando()) return;
    this.eliminando.set(true);
    try {
      await this.api.eliminarUsuario(usuario.id);
      this.confirmar.set(null);
      this.toast.success('Cuenta eliminada.');
      await this.cargar();
    } catch (error) {
      this.toast.error(this.mensaje(error, 'No se pudo eliminar la cuenta.'));
    } finally {
      this.eliminando.set(false);
    }
  }

  fecha(iso: string | null): string {
    if (!iso) return 'Nunca';
    return new Date(iso).toLocaleString('es-PE', { dateStyle: 'medium', timeStyle: 'short' });
  }

  /** El backend explica por qué rechaza (último admin, usuario repetido): se muestra tal cual. */
  private mensaje(error: unknown, porDefecto: string): string {
    const cuerpo = (error as { error?: { message?: string } } | null)?.error;
    return cuerpo?.message || porDefecto;
  }
}
