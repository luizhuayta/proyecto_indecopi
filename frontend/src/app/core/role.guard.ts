import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService, SeccionAdmin } from '../cms/auth.service';

/** Asegura que la sesión está resuelta antes de mirar el rol. */
async function resolverSesion(auth: AuthService): Promise<void> {
  if (!auth.ready()) {
    await auth.ensureSession();
  }
}

/**
 * Protege las pantallas que solo puede ver un administrador. La sesión ya la
 * comprobó `authGuard` en la ruta padre; aquí solo se decide el rol. Quien
 * no es administrador va a la primera sección que su rol sí puede abrir.
 */
export const adminGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  await resolverSesion(auth);
  if (!auth.username()) {
    return router.createUrlTree(['/admin/login']);
  }
  return auth.isAdmin() ? true : router.createUrlTree([auth.primeraSeccion()]);
};

/**
 * Guard por sección: deja pasar solo a los roles que la pueden usar (la API
 * vuelve a exigir el rol en cada petición; esto es la parte visible). Al
 * resto se le redirige a su primera sección permitida.
 */
export function seccionGuard(seccion: SeccionAdmin): CanActivateFn {
  return async () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    await resolverSesion(auth);
    if (!auth.username()) {
      return router.createUrlTree(['/admin/login']);
    }
    return auth.puede(seccion) ? true : router.createUrlTree([auth.primeraSeccion()]);
  };
}
