<?php
declare(strict_types=1);

/**
 * Rutas del módulo de contenido (configuración del sitio).
 *
 *   GET    /configuracion          -> configuración del sitio
 *   PUT    /configuracion          -> guarda el borrador
 *   POST   /configuracion/publicar -> publica el borrador
 */

require_once __DIR__ . '/../../http/errores.php';
require_once __DIR__ . '/controlador.php';

/**
 * Despacha una petición del módulo. Lanza noEncontrado() si no coincide.
 */
function manejarRutasContenido(string $metodo, string $ruta): void
{
    if ($metodo === 'GET' && $ruta === '/configuracion') {
        controladorVerConfiguracion();
        return;
    }
    if ($metodo === 'PUT' && $ruta === '/configuracion') {
        controladorGuardarConfiguracion();
        return;
    }
    if ($metodo === 'POST' && $ruta === '/configuracion/publicar') {
        controladorPublicarConfiguracion();
        return;
    }

    noEncontrado('Ruta no encontrada.');
}
