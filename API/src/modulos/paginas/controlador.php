<?php
declare(strict_types=1);

/**
 * Controladores HTTP del módulo de páginas.
 */

require_once __DIR__ . '/../../http/respuesta.php';
require_once __DIR__ . '/../../nucleo/csr.php';
require_once __DIR__ . '/../../nucleo/sesion.php';
require_once __DIR__ . '/servicio.php';

/**
 * GET /paginas
 */
function controladorListarPaginas(): void
{
    json_out(listarPaginas(localeDePeticion()), 200);
}

/**
 * GET /paginas/{slug}
 */
function controladorVerPagina(string $slug): void
{
    $locale = localeDePeticion();
    $documento = usuarioActual() !== null
        ? documentoPagina($slug, $locale, true)
        : paginaPublicada($slug, $locale);
    if ($documento === null) {
        noEncontrado('Página no encontrada.');
    }
    json_out($documento, 200);
}

/**
 * POST /paginas
 */
function controladorCrearPagina(): void
{
    exigirCsrf();
    $usuario = exigirRol('admin');
    json_out(crearPagina(cuerpoJson(), (int) $usuario['id']), 201);
}

/**
 * PUT /paginas/{slug}
 */
function controladorGuardarBorrador(string $slug): void
{
    exigirCsrf();
    $cuerpo = cuerpoJson();
    $contenido = is_array($cuerpo['contenido'] ?? null) ? $cuerpo['contenido'] : [];
    $version = (int) ($cuerpo['version'] ?? 0);
    json_out(guardarBorrador($slug, localeDePeticion(), $contenido, $version), 200);
}

/**
 * POST /paginas/{slug}/publicar
 */
function controladorPublicarPagina(string $slug): void
{
    exigirCsrf();
    $version = (int) (cuerpoJson()['version'] ?? 0);
    json_out(publicarPagina($slug, localeDePeticion(), $version), 200);
}

/**
 * DELETE /paginas/{slug}
 */
function controladorEliminarPagina(string $slug): void
{
    exigirCsrf();
    eliminarPagina($slug);
    json_out(['ok' => true], 200);
}

/**
 * PATCH /paginas/{slug}/meta
 */
function controladorActualizarMeta(string $slug): void
{
    exigirCsrf();
    json_out(actualizarMetaPagina($slug, cuerpoJson()), 200);
}

/**
 * GET /paginas/{slug}/revisiones
 */
function controladorListarRevisiones(string $slug): void
{
    json_out(listarRevisiones($slug, localeDePeticion()), 200);
}

/**
 * POST /paginas/{slug}/revisiones/{id}/restaurar
 */
function controladorRestaurarRevision(string $slug, int $id): void
{
    exigirCsrf();
    $version = (int) (cuerpoJson()['version'] ?? 0);
    json_out(restaurarRevision($slug, localeDePeticion(), $id, $version), 200);
}
