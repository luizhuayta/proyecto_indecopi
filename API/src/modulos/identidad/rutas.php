<?php
declare(strict_types=1);

/**
 * Rutas del módulo de identidad y apariencia.
 *
 *   GET  /identidad                        -> identidad de la institución
 *   PUT  /identidad                        -> actualiza la identidad
 *   GET  /configuracion/apariencia         -> apariencia del sitio
 *   PUT  /configuracion/apariencia         -> guarda el borrador de apariencia
 *   POST /configuracion/apariencia/publicar-> publica la apariencia
 */

require_once __DIR__ . '/../../http/errores.php';
require_once __DIR__ . '/controlador.php';

/**
 * Despacha una petición del módulo. Lanza noEncontrado() si no coincide.
 */
function manejarRutasIdentidad(string $metodo, string $ruta): void
{
    if ($metodo === 'GET' && $ruta === '/identidad') {
        controladorVerIdentidad();
        return;
    }
    if ($metodo === 'PUT' && $ruta === '/identidad') {
        controladorGuardarIdentidad();
        return;
    }
    if ($metodo === 'GET' && $ruta === '/configuracion/apariencia') {
        controladorVerApariencia();
        return;
    }
    if ($metodo === 'PUT' && $ruta === '/configuracion/apariencia') {
        controladorGuardarApariencia();
        return;
    }
    if ($metodo === 'POST' && $ruta === '/configuracion/apariencia/publicar') {
        controladorPublicarApariencia();
        return;
    }

    noEncontrado('Ruta no encontrada.');
}
