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
