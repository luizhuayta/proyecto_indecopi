<?php
declare(strict_types=1);

/**
 * Controladores HTTP del módulo de medios.
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
 * POST /medios — multipart con el campo 'file'.
 */
function controladorSubirMedio(): void
{
    exigirCsrf();
    $usuario = exigirSesion();
    if (empty($_FILES['file'])) {
        solicitudInvalida('No se recibió ningún archivo en el campo "file".');
    }
    json_out(guardarMedio($_FILES['file'], (int) $usuario['id']), 201);
}

/**
 * GET /medios — listado de la biblioteca.
 */
function controladorListarMedios(): void
{
    json_out(listarMedios(), 200);
}

/**
 * GET /medios/{id} — sirve el binario por id (única puerta, sin exponer ruta).
 */
function controladorServirMedio(int $id): void
{
    $medio = medioPorId($id);
    if ($medio === null) {
        noEncontrado('Archivo no encontrado.');
    }
    $ruta = rutaAlmacen() . '/' . (string) $medio['nombre_guardado'];
    if (!is_file($ruta)) {
        noEncontrado('El archivo ya no está disponible.');
    }
    $mime = (string) $medio['mime'];
    $nombre = (string) $medio['nombre_original'];
    header('Content-Type: ' . $mime);
    header('Content-Disposition: inline; filename="' . rawurlencode($nombre) . '"');
    header('Cache-Control: public, max-age=31536000, immutable');
    header('Content-Length: ' . (string) filesize($ruta));
    readfile($ruta);
    exit;
}

/**
 * DELETE /medios/{id}
 */
function controladorEliminarMedio(int $id): void
{
    exigirCsrf();
    eliminarMedio($id);
    json_out(['ok' => true], 200);
}

/**
 * POST /medios/recortar
 */
function controladorRecortarMedio(): void
{
    exigirCsrf();
    json_out(recortarMedio((string) (cuerpoJson()['url'] ?? ''), cuerpoJson()), 200);
}

/**
 * GET /medios/{id}/versiones
 */
function controladorVersionesDeMedio(int $id): void
{
    json_out(versionesDeMedio($id), 200);
}

/**
 * POST /medios/{id}/restaurar
 */
function controladorRestaurarVersionMedio(int $id): void
{
    exigirCsrf();
    $versionId = cuerpoJson()['versionId'] ?? null;
    json_out(restaurarVersionMedio($id, $versionId !== null ? (int) $versionId : null), 200);
}
