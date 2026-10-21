import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../cms/auth.service';

/**
 * Protege las rutas del panel. Comprueba la sesión con `AuthService.ensureSession()`
 * y redirige a `/admin/login` si no hay sesión activa.
 */
export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const autenticado = await auth.ensureSession();
  return autenticado ? true : router.createUrlTree(['/admin/login']);
};
