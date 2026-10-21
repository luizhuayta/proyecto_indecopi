<?php
declare(strict_types=1);

/**
 * Lectura de JSON. Una sola implementación para todo el API.
 *
 * Antes cada módulo traía su propia copia (decodificarJsonColumna,
 * decodificarJsonIdentidad). Aquí hay una sola, y el valor devuelto es
 * siempre un array o null: nunca un JSON inválido.
 */

/**
 * Decodifica una columna JSON (JSON nativo o texto) en un array, o null si
 * está vacía o no contiene un objeto o un arreglo JSON.
 */
function decodificarJson(mixed $valor): ?array
{
    if ($valor === null || $valor === '') {
        return null;
    }
    if (is_array($valor)) {
        return $valor;
    }
    if (is_string($valor)) {
        $decodificado = json_decode($valor, true);
        return is_array($decodificado) ? $decodificado : null;
    }
    return null;
}
