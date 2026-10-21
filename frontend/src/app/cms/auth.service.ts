import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { API_BASE } from './cms.models';

export type AdminRole = 'admin' | 'editor' | '';

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
