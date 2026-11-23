<?php
declare(strict_types=1);

/**
 * Esquemas de validación del módulo de sesión y usuarios.
 */

/**
 * Devuelve los esquemas de validación del módulo.
 */
function esquemasSesionUsuarios(): array
{
    return [
        'login' => [
            'usuario' => ['requerido', 'longitud_min', 3],
            'contrasena' => ['requerido', 'longitud_min', 8],
        ],
        'usuario_nuevo' => [
            'usuario' => ['requerido'],
            'contrasena' => ['requerido', 'longitud_min', 8],
            'rol' => ['enum', ['admin', 'editor', 'secretaria']],
        ],
        'cambio_contrasena' => [
            'contrasena_actual' => ['requerido'],
            'contrasena' => ['requerido', 'longitud_min', 8],
        ],
    ];
}
