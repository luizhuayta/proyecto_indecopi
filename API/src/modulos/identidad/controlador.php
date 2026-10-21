<?php
declare(strict_types=1);

/**
 * Controladores HTTP del módulo de identidad y apariencia.
 */

require_once __DIR__ . '/../../http/respuesta.php';
require_once __DIR__ . '/../../nucleo/csr.php';
require_once __DIR__ . '/../../nucleo/sesion.php';
require_once __DIR__ . '/servicio.php';

if (!function_exists('cuerpoJson')) {
    /**
     * Cuerpo JSON de la petición como array (vacío si no lo hay).
     */
    function cuerpoJson(): array
    {
        $bruto = file_get_contents('php://input') ?: '';
        $datos = json_decode($bruto, true);
        return is_array($datos) ? $datos : [];
    }
}

/**
 * GET /identidad — identidad de la institución (admin).
 */
function controladorVerIdentidad(): void
{
    exigirRol('admin');
    json_out(identidad(), 200);
}

/**
 * PUT /identidad — actualiza la identidad (admin).
 */
function controladorGuardarIdentidad(): void
{
    exigirCsrf();
    json_out(guardarIdentidad(cuerpoJson()), 200);
}

/**
 * GET /configuracion/apariencia — apariencia del sitio (admin).
 */
function controladorVerApariencia(): void
{
    exigirRol('admin');
    json_out(configuracionApariencia(localeDePeticion()), 200);
}

/**
 * PUT /configuracion/apariencia — guarda el borrador de apariencia (admin).
 */
function controladorGuardarApariencia(): void
{
    exigirCsrf();
    $cuerpo = cuerpoJson();
    $contenido = is_array($cuerpo['contenido'] ?? null) ? $cuerpo['contenido'] : [];
    $version = (int) ($cuerpo['version'] ?? 0);
    json_out(guardarApariencia(localeDePeticion(), $contenido, $version), 200);
}

/**
 * POST /configuracion/apariencia/publicar — publica la apariencia (admin).
 */
function controladorPublicarApariencia(): void
{
    exigirCsrf();
    $version = (int) (cuerpoJson()['version'] ?? 0);
    json_out(publicarApariencia(localeDePeticion(), $version), 200);
}
