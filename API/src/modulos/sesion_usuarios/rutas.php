<?php
declare(strict_types=1);

/**
 * Rutas del módulo de sesión y usuarios.
 *
 *   POST   /auth/login          -> login (límite de intentos por IP)
 *   POST   /auth/logout         -> cierra la sesión
 *   GET    /auth/me             -> estado de la sesión
 *   GET    /auth/usuarios       -> lista de usuarios (admin)
 *   POST   /auth/usuarios       -> crea usuario (admin)
 *   PATCH  /auth/usuarios/{id}  -> cambia rol, estado o contraseña (admin)
 *   PUT    /auth/password       -> el propio usuario cambia su contraseña
 */

require_once __DIR__ . '/../../http/errores.php';
require_once __DIR__ . '/controlador.php';

/**
 * Despacha una petición del módulo. Lanza noEncontrado() si no coincide.
 */
function manejarRutasSesionUsuarios(string $metodo, string $ruta): void
{
    if ($metodo === 'POST' && $ruta === '/auth/login') {
        controladorLogin();
        return;
    }
    if ($metodo === 'POST' && $ruta === '/auth/logout') {
        controladorLogout();
        return;
    }
    if ($metodo === 'GET' && $ruta === '/auth/me') {
        controladorMe();
        return;
    }
    if ($metodo === 'GET' && $ruta === '/auth/usuarios') {
        controladorListarUsuarios();
        return;
    }
    if ($metodo === 'POST' && $ruta === '/auth/usuarios') {
        controladorCrearUsuario();
        return;
    }
    if ($metodo === 'PATCH' && preg_match('#^/auth/usuarios/(\d+)$#', $ruta, $m) === 1) {
        controladorActualizarUsuario((int) $m[1]);
        return;
    }
    if ($metodo === 'PUT' && $ruta === '/auth/password') {
        controladorCambiarContrasena();
        return;
    }

    noEncontrado('Ruta no encontrada.');
}
