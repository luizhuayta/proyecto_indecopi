<?php
declare(strict_types=1);

/**
 * Rutas del módulo de páginas.
 *
 *   GET    /paginas                              -> listado y menú
 *   GET    /paginas/{slug}                       -> documento de la página
 *   POST   /paginas                              -> crea una página (admin)
 *   PUT    /paginas/{slug}                       -> guarda el borrador
 *   POST   /paginas/{slug}/publicar              -> publica
 *   DELETE /paginas/{slug}                       -> elimina (admin)
 *   PATCH  /paginas/{slug}/meta                  -> cambia metadatos (admin)
 *   GET    /paginas/{slug}/revisiones            -> historial
 *   POST   /paginas/{slug}/revisiones/{id}/restaurar -> restaura una revisión
 */

require_once __DIR__ . '/../../http/errores.php';
require_once __DIR__ . '/controlador.php';

/**
 * Despacha una petición del módulo. Lanza noEncontrado() si no coincide.
 */
function manejarRutasPaginas(string $metodo, string $ruta): void
{
    if ($metodo === 'GET' && $ruta === '/paginas') {
        controladorListarPaginas();
        return;
    }
    if ($metodo === 'POST' && $ruta === '/paginas') {
        controladorCrearPagina();
        return;
    }
    if ($metodo === 'POST' && preg_match('#^/paginas/([a-z0-9\-]+)/publicar$#', $ruta, $m) === 1) {
        controladorPublicarPagina($m[1]);
        return;
    }
    if ($metodo === 'POST' && preg_match('#^/paginas/([a-z0-9\-]+)/revisiones/(\d+)/restaurar$#', $ruta, $m) === 1) {
        controladorRestaurarRevision($m[1], (int) $m[2]);
        return;
    }
    if ($metodo === 'GET' && preg_match('#^/paginas/([a-z0-9\-]+)/revisiones$#', $ruta, $m) === 1) {
        controladorListarRevisiones($m[1]);
        return;
    }
    if ($metodo === 'PATCH' && preg_match('#^/paginas/([a-z0-9\-]+)/meta$#', $ruta, $m) === 1) {
        controladorActualizarMeta($m[1]);
        return;
    }
    if ($metodo === 'GET' && preg_match('#^/paginas/([a-z0-9\-]+)$#', $ruta, $m) === 1) {
        controladorVerPagina($m[1]);
        return;
    }
    if ($metodo === 'PUT' && preg_match('#^/paginas/([a-z0-9\-]+)$#', $ruta, $m) === 1) {
        controladorGuardarBorrador($m[1]);
        return;
    }
    if ($metodo === 'DELETE' && preg_match('#^/paginas/([a-z0-9\-]+)$#', $ruta, $m) === 1) {
        controladorEliminarPagina($m[1]);
        return;
    }

    noEncontrado('Ruta no encontrada.');
}
