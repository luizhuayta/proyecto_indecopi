<?php
declare(strict_types=1);

/**
 * Acceso a las tablas `institucion` y `apariencia_sitio`. Todo el SQL del
 * módulo vive aquí. Consultas preparadas siempre.
 */

require_once __DIR__ . '/../../nucleo/base_datos.php';

/**
 * Fila de la institución (id 1), o null.
 */
function institucionPorIdBd(int $id): ?array
{
    $stmt = conexion()->prepare(
        'SELECT id, nombre, ruc, direccion, telefono, correo, ciudad, actualizado_en
           FROM institucion WHERE id = ? LIMIT 1'
    );
    $stmt->execute([$id]);
    $fila = $stmt->fetch();
    return $fila === false ? null : $fila;
}

/**
 * Inserta la fila de la institución.
 */
function insertarInstitucionBd(int $id, array $datos): void
{
    $stmt = conexion()->prepare(
        'INSERT INTO institucion (id, nombre, ruc, direccion, telefono, correo, ciudad)
         VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([
        $id,
        (string) ($datos['nombre'] ?? ''),
        (string) ($datos['ruc'] ?? ''),
        (string) ($datos['direccion'] ?? ''),
        (string) ($datos['telefono'] ?? ''),
        (string) ($datos['correo'] ?? ''),
        (string) ($datos['ciudad'] ?? ''),
    ]);
}

/**
 * Actualiza la fila de la institución.
 */
function actualizarInstitucionBd(int $id, array $datos): void
{
    $stmt = conexion()->prepare(
        'UPDATE institucion SET nombre = ?, ruc = ?, direccion = ?, telefono = ?, correo = ?, ciudad = ? WHERE id = ?'
    );
    $stmt->execute([
        (string) ($datos['nombre'] ?? ''),
        (string) ($datos['ruc'] ?? ''),
        (string) ($datos['direccion'] ?? ''),
        (string) ($datos['telefono'] ?? ''),
        (string) ($datos['correo'] ?? ''),
        (string) ($datos['ciudad'] ?? ''),
        $id,
    ]);
}

/**
 * Fila de apariencia del sitio para un locale, o null.
 */
function aparienciaPorLocaleBd(string $locale): ?array
{
    $stmt = conexion()->prepare(
        'SELECT locale, contenido, borrador, version, actualizado_en
           FROM apariencia_sitio WHERE locale = ? LIMIT 1'
    );
    $stmt->execute([$locale]);
    $fila = $stmt->fetch();
    return $fila === false ? null : $fila;
}

/**
 * Asegura que exista la fila de apariencia del locale (versión 1, sin contenido).
 */
function asegurarAparienciaBd(string $locale): void
{
    $stmt = conexion()->prepare(
        'INSERT IGNORE INTO apariencia_sitio (locale, contenido, borrador, version) VALUES (?, NULL, NULL, 1)'
    );
    $stmt->execute([$locale]);
}

/**
 * Guarda el borrador de apariencia subiendo la versión, solo si la versión
 * actual coincide. Devuelve el número de filas afectadas (0 = conflicto).
 */
function actualizarBorradorAparienciaBd(string $locale, string $json, int $versionActual, int $versionNueva): int
{
    $stmt = conexion()->prepare(
        'UPDATE apariencia_sitio SET borrador = ?, version = ? WHERE locale = ? AND version = ?'
    );
    $stmt->execute([$json, $versionNueva, $locale, $versionActual]);
    return $stmt->rowCount();
}

/**
 * Pasa el borrador a contenido publicado, lo vacía y sube la versión, solo si
 * la versión actual coincide. Devuelve el número de filas afectadas.
 */
function publicarAparienciaBd(string $locale, string $json, int $versionActual, int $versionNueva): int
{
    $stmt = conexion()->prepare(
        'UPDATE apariencia_sitio SET contenido = ?, borrador = NULL, version = ? WHERE locale = ? AND version = ?'
    );
    $stmt->execute([$json, $versionNueva, $locale, $versionActual]);
    return $stmt->rowCount();
}
