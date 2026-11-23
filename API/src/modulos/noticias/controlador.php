<?php
declare(strict_types=1);

/**
 * Controladores HTTP del módulo de noticias.
 */

require_once __DIR__ . '/../../http/respuesta.php';
require_once __DIR__ . '/../../nucleo/csr.php';
require_once __DIR__ . '/servicio.php';

/**
 * GET /noticias — listado completo del panel.
 */
function controladorListarNoticias(): void
{
    json_out(['items' => listarNoticiasAdmin()]);
}

/**
 * POST /noticias — alta (editor o administrador).
 */
function controladorCrearNoticia(): void
{
    exigirCsrf();
    json_out(crearNoticia(cuerpoJson()), 201);
}

/**
 * PUT /noticias/{id} — edición (editor o administrador; publicar exige admin).
 */
function controladorActualizarNoticia(int $id): void
{
    exigirCsrf();
    json_out(actualizarNoticia($id, cuerpoJson()));
}

/**
 * DELETE /noticias/{id} — baja (solo administrador).
 */
function controladorEliminarNoticia(int $id): void
{
    exigirCsrf();
    json_out(eliminarNoticia($id));
}
