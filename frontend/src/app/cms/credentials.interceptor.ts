import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

/**
 * True cuando un 401/403 responde con un mensaje de token/sesión inválido
 * (no un simple "credenciales incorrectas" del login).
 */
function esTokenInvalido(err: HttpErrorResponse): boolean {
  const cuerpo = err.error as { message?: string; error?: string } | null;
  const texto = `${cuerpo?.message ?? ''} ${cuerpo?.error ?? ''}`.toLowerCase();
  return /token|csrf|sesi[oó]n|session|expirad/i.test(texto);
}

export const credentialsInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const csrf = auth.csrfToken();
  const mutating = !['GET', 'HEAD', 'OPTIONS'].includes(req.method.toUpperCase());
  let headers = req.headers;
  if (mutating && csrf) {
    headers = headers.set('X-CSRF-Token', csrf);
  }
  return next(req.clone({ withCredentials: true, headers })).pipe(
    catchError((err: HttpErrorResponse) => {
      if ((err.status === 401 || err.status === 403) && esTokenInvalido(err)) {
        auth.username.set(null);
        auth.role.set('');
        auth.csrfToken.set('');
        void router.navigateByUrl('/admin/login');
      }
      return throwError(() => err);
    })
  );
};
