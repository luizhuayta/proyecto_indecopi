<?php
declare(strict_types=1);

/**
 * Acceso a la tabla `configuracion_sitio`. Todo el SQL del módulo vive aquí.
 * Consultas preparadas siempre.
 */

require_once __DIR__ . '/../../nucleo/base_datos.php';

/**
 * Fila de configuración del sitio para un locale, o null.
 */
function configuracionPorLocale(string $locale): ?array
{
    $stmt = conexion()->prepare(
        'SELECT locale, contenido, borrador, version, actualizado_en
           FROM configuracion_sitio WHERE locale = ? LIMIT 1'
    );
    $stmt->execute([$locale]);
    $fila = $stmt->fetch();
    return $fila === false ? null : $fila;
}

/**
 * Asegura que exista la fila del locale (con versión 1 y sin contenido), sin
 * tocar nada si ya existe.
 */
function asegurarConfiguracion(string $locale): void
{
    $stmt = conexion()->prepare(
        'INSERT IGNORE INTO configuracion_sitio (locale, contenido, borrador, version)
         VALUES (?, NULL, NULL, 1)'
    );
    $stmt->execute([$locale]);
}

/**
 * Guarda el borrador subiendo la versión, solo si la versión actual coincide
 * (control de concurrencia). Devuelve el número de filas afectadas (0 = hubo
 * conflicto).
 */
function actualizarBorradorConfiguracion(string $locale, string $json, int $versionActual, int $versionNueva): int
{
    $stmt = conexion()->prepare(
        'UPDATE configuracion_sitio SET borrador = ?, version = ? WHERE locale = ? AND version = ?'
    );
    $stmt->execute([$json, $versionNueva, $locale, $versionActual]);
    return $stmt->rowCount();
}

/**
 * Pasa el borrador a contenido publicado, lo vacía y sube la versión, solo si
 * la versión actual coincide. Devuelve el número de filas afectadas.
 */
function publicarConfiguracionBd(string $locale, string $json, int $versionActual, int $versionNueva): int
{
    $stmt = conexion()->prepare(
        'UPDATE configuracion_sitio
            SET contenido = ?, borrador = NULL, version = ?
          WHERE locale = ? AND version = ?'
    );
    $stmt->execute([$json, $versionNueva, $locale, $versionActual]);
    return $stmt->rowCount();
}
