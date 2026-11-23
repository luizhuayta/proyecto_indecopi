import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { API_BASE } from './cms.models';

export type AdminRole = 'admin' | 'editor' | 'secretaria' | '';

/**
 * Secciones del panel que se pueden proteger por rol. La autorización real
 * la hace siempre la API; aquí solo se decide qué enseñar y adónde entrar.
 */
export type SeccionAdmin =
  | 'paginas'
  | 'noticias'
  | 'medios'
  | 'mensajes'
  | 'identidad'
  | 'apariencia'
  | 'usuarios'
  | 'cuenta';

/**
 * Secciones que cada rol puede abrir, en el orden del menú lateral. La
 * secretaria atiende la bandeja y la agenda editorial: no toca páginas,
 * identidad, apariencia ni usuarios.
 */
const SECCIONES_POR_ROL: Record<string, SeccionAdmin[]> = {
  admin: [
    'paginas',
    'noticias',
    'medios',
    'mensajes',
    'identidad',
    'apariencia',
    'usuarios',
    'cuenta',
  ],
  editor: ['paginas', 'noticias', 'medios', 'mensajes', 'cuenta'],
  secretaria: ['noticias', 'medios', 'mensajes', 'cuenta'],
};

/** Etiqueta visible de cada rol. */
const ROTULOS_ROL: Record<AdminRole, string> = {
  admin: 'Administrador',
  editor: 'Editor',
  secretaria: 'Secretaría',
  '': '',
};

interface AuthMeResponse {
  autenticado: boolean;
  usuario?: string;
  rol?: string;
  csrfToken?: string;
}

interface AuthLoginResponse {
  ok?: boolean;
  usuario: string;
  rol?: string;
  csrfToken?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  readonly username = signal<string | null>(null);
  readonly role = signal<AdminRole>('');
  readonly csrfToken = signal('');
  readonly ready = signal(false);

  isAdmin(): boolean {
    return this.role() === 'admin';
  }

  isSecretaria(): boolean {
    return this.role() === 'secretaria';
  }

  /**
   * ¿Puede el rol actual entrar a la sección del panel? El menú y los guards
   * lo usan para filtrar; la API vuelve a comprobarlo en cada petición.
   */
  puede(seccion: SeccionAdmin): boolean {
    return (SECCIONES_POR_ROL[this.role()] ?? []).includes(seccion);
  }

  /**
   * Adónde se manda a quien intenta abrir una pantalla que no le toca: el
   * tablero, que es la portada del panel y cada rol lo ve solo con sus
   * métricas y accesos permitidos. Antes era la primera sección del rol;
   * desde que existe el dashboard es el destino coherente para todos.
   */
  primeraSeccion(): string {
    return '/admin';
  }

  /** Etiqueta del rol para mostrar junto al nombre de usuario. */
  rotuloRol(): string {
    return ROTULOS_ROL[this.role()];
  }

  async ensureSession(): Promise<boolean> {
    try {
      const res = await firstValueFrom(
        this.http.get<AuthMeResponse>(`${API_BASE}/auth/me`)
      );
      this.username.set(res.autenticado ? (res.usuario ?? null) : null);
      this.role.set(res.autenticado ? ((res.rol as AdminRole) || 'editor') : '');
      this.csrfToken.set(res.csrfToken ?? '');
      this.ready.set(true);
      return res.autenticado;
    } catch {
      this.username.set(null);
      this.role.set('');
      this.csrfToken.set('');
      this.ready.set(true);
      return false;
    }
  }

  async login(usuario: string, contrasena: string): Promise<string | null> {
    try {
      const res = await firstValueFrom(
        this.http.post<AuthLoginResponse>(`${API_BASE}/auth/login`, { usuario, contrasena })
      );
      this.username.set(res.usuario);
      this.role.set((res.rol as AdminRole) || 'editor');
      this.csrfToken.set(res.csrfToken ?? '');
      return null;
    } catch (err: unknown) {
      const message = (err as { error?: { message?: string } })?.error?.message;
      return message || 'No se pudo iniciar sesión';
    }
  }

  /**
   * El propio usuario cambia su contraseña. Devuelve un mensaje de error o
   * null si todo fue bien. La API invalida la sesión al cambiarla, así que
   * el llamador debe limpiar el estado local y volver al login.
   */
  async cambiarContrasena(actual: string, nueva: string): Promise<string | null> {
    try {
      await firstValueFrom(
        this.http.put(`${API_BASE}/auth/password`, {
          contrasena_actual: actual,
          contrasena: nueva,
        })
      );
      return null;
    } catch (err: unknown) {
      const message = (err as { error?: { message?: string } })?.error?.message;
      return message || 'No se pudo cambiar la contraseña. Revisa tu conexión.';
    }
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.http.post(`${API_BASE}/auth/logout`, {}));
    } catch {
      /* igual salimos */
    }
    this.username.set(null);
    this.role.set('');
    this.csrfToken.set('');
    await this.router.navigateByUrl('/admin/login');
  }
}
