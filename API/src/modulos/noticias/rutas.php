<?php
declare(strict_types=1);

/**
 * Rutas del módulo de noticias (panel).
 *
 *   GET    /noticias       -> listado completo (sesión)
 *   POST   /noticias       -> alta (editor o administrador)
 *   PUT    /noticias/{id}  -> edición (editor o administrador; publicar exige admin)
 *   DELETE /noticias/{id}  -> baja (administrador)
 */

require_once __DIR__ . '/../../http/errores.php';
require_once __DIR__ . '/controlador.php';

function manejarRutasNoticias(string $metodo, string $ruta): void
{
    if ($ruta === '/noticias') {
        match ($metodo) {
            'GET' => controladorListarNoticias(),
            'POST' => controladorCrearNoticia(),
            default => noEncontrado('Ruta no encontrada.'),
        };
        return;
    }
    if (preg_match('#^/noticias/(\d+)$#', $ruta, $m) === 1) {
        match ($metodo) {
            'PUT' => controladorActualizarNoticia((int) $m[1]),
            'DELETE' => controladorEliminarNoticia((int) $m[1]),
            default => noEncontrado('Ruta no encontrada.'),
        };
        return;
    }
    noEncontrado('Ruta no encontrada.');
}
