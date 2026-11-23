<?php
declare(strict_types=1);

/**
 * Rutas del módulo de mensajes.
 *
 *   POST /mensajes                -> alta desde el formulario público
 *   GET  /mensajes                -> bandeja del panel
 *   POST /mensajes/{id}/responder -> respuesta a un mensaje
 *   POST /mensajes/{id}/archivar  -> saca un mensaje del flujo de la bandeja
 */

require_once __DIR__ . '/../../http/errores.php';
require_once __DIR__ . '/controlador.php';

function manejarRutasMensajes(string $metodo, string $ruta): void
{
    if ($metodo === 'POST' && $ruta === '/mensajes') {
        controladorCrearMensaje();
        return;
    }
    if ($metodo === 'GET' && $ruta === '/mensajes') {
        controladorListarMensajes();
        return;
    }
    if ($metodo === 'POST' && preg_match('#^/mensajes/(\d+)/responder$#', $ruta, $coincidencia) === 1) {
        controladorResponderMensaje((int) $coincidencia[1]);
        return;
    }
    if ($metodo === 'POST' && preg_match('#^/mensajes/(\d+)/archivar$#', $ruta, $coincidencia) === 1) {
        controladorArchivarMensaje((int) $coincidencia[1]);
        return;
    }

    noEncontrado('Ruta no encontrada.');
}
