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
