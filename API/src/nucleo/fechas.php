<?php
declare(strict_types=1);

/**
 * Fechas en UTC y formato ISO 8601.
 * Portado de Backend/src/lib/fechas.js (Perucanadiense).
 * La base devuelve texto 'YYYY-MM-DD HH:MM:SS' (UTC) o 'YYYY-MM-DD' (DATE).
 */

/**
 * 'YYYY-MM-DD HH:MM:SS' (UTC) -> 'YYYY-MM-DDTHH:MM:SS+00:00'.
 */
function aIso(?string $fecha): ?string
{
    if ($fecha === null) {
        return null;
    }
    $texto = trim($fecha);
    if ($texto === '') {
        return null;
    }
    try {
        $momento = new DateTimeImmutable($texto, new DateTimeZone('UTC'));
    } catch (Exception $e) {
        return null;
    }
    return $momento->format('Y-m-d\TH:i:sP');
}

/**
 * Cualquier fecha -> 'YYYY-MM-DD'.
 */
function aFechaCorta(?string $fecha): ?string
{
    if ($fecha === null) {
        return null;
    }
    $texto = trim($fecha);
    if ($texto === '') {
        return null;
    }
    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $texto) === 1) {
        return $texto;
    }
    $iso = aIso($texto);
    return $iso === null ? null : substr($iso, 0, 10);
}
