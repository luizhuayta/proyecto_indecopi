<?php
declare(strict_types=1);

/**
 * Controladores HTTP del módulo de contenido (configuración del sitio).
 */

require_once __DIR__ . '/../../http/respuesta.php';
require_once __DIR__ . '/../../nucleo/csr.php';
require_once __DIR__ . '/servicio.php';

/**
 * GET /configuracion
 */
function controladorVerConfiguracion(): void
{
    json_out(contenidoConfiguracion(localeDePeticion()), 200);
}

/**
 * PUT /configuracion
 */
function controladorGuardarConfiguracion(): void
{
    exigirCsrf();
    $cuerpo = cuerpoJson();
    $contenido = is_array($cuerpo['contenido'] ?? null) ? $cuerpo['contenido'] : [];
    $version = (int) ($cuerpo['version'] ?? 0);
    json_out(guardarConfiguracion(localeDePeticion(), $contenido, $version), 200);
}

/**
 * POST /configuracion/publicar
 */
function controladorPublicarConfiguracion(): void
{
    exigirCsrf();
    $version = (int) (cuerpoJson()['version'] ?? 0);
    json_out(publicarConfiguracion(localeDePeticion(), $version), 200);
}
