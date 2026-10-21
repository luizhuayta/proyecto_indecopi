<?php
declare(strict_types=1);

/**
 * Rutas del módulo de medios.
 *
 *   POST   /medios                    -> sube un medio (multipart 'file')
 *   GET    /medios                    -> listado de la biblioteca
 *   GET    /medios/{id}               -> sirve el binario (única puerta)
 *   DELETE /medios/{id}               -> elimina
 *   POST   /medios/recortar           -> recorta una imagen
 *   GET    /medios/{id}/versiones     -> historial de recortes
 *   POST   /medios/{id}/restaurar     -> restaura una versión
 */

require_once __DIR__ . '/../../http/errores.php';
require_once __DIR__ . '/controlador.php';

/**
 * Despacha una petición del módulo. Lanza noEncontrado() si no coincide.
 */
function manejarRutasMedios(string $metodo, string $ruta): void
{
    if ($metodo === 'POST' && $ruta === '/medios') {
        controladorSubirMedio();
        return;
    }
    if ($metodo === 'GET' && $ruta === '/medios') {
        controladorListarMedios();
        return;
    }
    if ($metodo === 'POST' && $ruta === '/medios/recortar') {
        controladorRecortarMedio();
        return;
    }
    if ($metodo === 'GET' && preg_match('#^/medios/(\d+)/versiones$#', $ruta, $m) === 1) {
        controladorVersionesDeMedio((int) $m[1]);
        return;
    }
    if ($metodo === 'POST' && preg_match('#^/medios/(\d+)/restaurar$#', $ruta, $m) === 1) {
        controladorRestaurarVersionMedio((int) $m[1]);
        return;
    }
    if ($metodo === 'GET' && preg_match('#^/medios/(\d+)$#', $ruta, $m) === 1) {
        controladorServirMedio((int) $m[1]);
        return;
    }
    if ($metodo === 'DELETE' && preg_match('#^/medios/(\d+)$#', $ruta, $m) === 1) {
        controladorEliminarMedio((int) $m[1]);
        return;
    }

    noEncontrado('Ruta no encontrada.');
}
