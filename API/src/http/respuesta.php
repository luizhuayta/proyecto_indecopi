<?php
declare(strict_types=1);

/**
 * Respuestas JSON.
 */

/**
 * Envía una respuesta JSON y termina la ejecución.
 */
function json_out(array $datos, int $codigo = 200): never
{
    http_response_code($codigo);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($datos, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

/**
 * Cuerpo JSON de la petición como array (vacío si no lo hay o no es JSON).
 * Vive aquí porque es parte de la lectura de HTTP, no de un módulo.
 */
function cuerpoJson(): array
{
    $bruto = file_get_contents('php://input') ?: '';
    $datos = json_decode($bruto, true);
    return is_array($datos) ? $datos : [];
}
