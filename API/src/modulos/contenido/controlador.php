<?php
declare(strict_types=1);

/**
 * Controladores HTTP del módulo de contenido (configuración del sitio).
 */

require_once __DIR__ . '/../../http/respuesta.php';
require_once __DIR__ . '/../../nucleo/csr.php';
require_once __DIR__ . '/../../nucleo/documento.php';
require_once __DIR__ . '/servicio.php';

/**
 * GET /configuracion
 */
function controladorVerConfiguracion(): void
{
    json_out(verContenidoDelSitio(localeDePeticion()), 200);
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
    json_out(guardarContenidoDelSitio($contenido, $version, localeDePeticion()), 200);
}

/**
 * POST /configuracion/publicar
 */
function controladorPublicarConfiguracion(): void
{
    exigirCsrf();
    $version = (int) (cuerpoJson()['version'] ?? 0);
    json_out(publicarDocumento(CLAVE_CONTENIDO, localeDePeticion(), $version, 'prepararContenidoDelSitio'), 200);
}
