<?php
declare(strict_types=1);

/**
 * Acceso a las tablas `medios` y `versiones_medio`. Todo el SQL del módulo vive
 * aquí. Consultas preparadas siempre.
 */

require_once __DIR__ . '/../../nucleo/base_datos.php';

/**
 * Columnas que se leen de un medio (para no repetir la lista).
 */
function columnasMedio(): string
{
    return 'id, nombre_original, nombre_guardado, url, mime, tamano, ancho, alto, variantes, padre_id, tipo, original_guardado, sha256, publico, creado_en';
}

/**
 * Fila completa de un medio por id, o null.
 */
function medioPorIdBd(int $id): ?array
{
    $stmt = conexion()->prepare('SELECT ' . columnasMedio() . ' FROM medios WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $fila = $stmt->fetch();
    return $fila === false ? null : $fila;
}

/**
 * Medio con un sha256 y una visibilidad determinados, o null.
 * La deduplicación NO cruza la frontera de visibilidad: un reservado no se
 * reutiliza como público ni al revés.
 */
function medioPorSha256Bd(string $sha256, bool $publico): ?array
{
    $stmt = conexion()->prepare(
        'SELECT ' . columnasMedio() . ' FROM medios WHERE sha256 = ? AND publico = ? LIMIT 1'
    );
    $stmt->execute([$sha256, $publico ? 1 : 0]);
    $fila = $stmt->fetch();
    return $fila === false ? null : $fila;
}

/**
 * Inserta un medio y devuelve su id. `$datos` trae las columnas no autoincrementadas.
 */
function insertarMedioBd(array $datos): int
{
    $stmt = conexion()->prepare(
        'INSERT INTO medios
           (nombre_original, nombre_guardado, url, mime, tamano, ancho, alto, variantes, padre_id, tipo, original_guardado, sha256, publico)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([
        (string) ($datos['nombre_original'] ?? ''),
        (string) ($datos['nombre_guardado'] ?? ''),
        (string) ($datos['url'] ?? ''),
        (string) ($datos['mime'] ?? ''),
        (int) ($datos['tamano'] ?? 0),
        isset($datos['ancho']) && $datos['ancho'] !== null ? (int) $datos['ancho'] : null,
        isset($datos['alto']) && $datos['alto'] !== null ? (int) $datos['alto'] : null,
        isset($datos['variantes']) && $datos['variantes'] !== null ? (string) $datos['variantes'] : null,
        isset($datos['padre_id']) && $datos['padre_id'] !== null ? (int) $datos['padre_id'] : null,
        (string) ($datos['tipo'] ?? 'subida'),
        isset($datos['original_guardado']) && $datos['original_guardado'] !== null ? (string) $datos['original_guardado'] : null,
        (string) ($datos['sha256'] ?? ''),
        (int) ($datos['publico'] ?? 1),
    ]);
    return (int) conexion()->lastInsertId();
}

/**
 * Fija la URL pública de un medio recién insertado (depende de su id).
 */
function fijarUrlMedioBd(int $id, string $url): void
{
    $stmt = conexion()->prepare('UPDATE medios SET url = ? WHERE id = ?');
    $stmt->execute([$url, $id]);
}

/**
 * Actualiza la columna `variantes` (JSON) de un medio.
 */
function actualizarVariantesMedioBd(int $id, string $json): void
{
    $stmt = conexion()->prepare('UPDATE medios SET variantes = ? WHERE id = ?');
    $stmt->execute([$json, $id]);
}

/**
 * Reemplaza el archivo actual de un medio (para restaurar una versión).
 */
function actualizarArchivoMedioBd(int $id, string $nombreGuardado, string $mime, int $tamano, ?int $ancho, ?int $alto): void
{
    $stmt = conexion()->prepare(
        'UPDATE medios SET nombre_guardado = ?, mime = ?, tamano = ?, ancho = ?, alto = ? WHERE id = ?'
    );
    $stmt->execute([$nombreGuardado, $mime, $tamano, $ancho, $alto, $id]);
}

/**
 * Todos los medios, del más reciente al más antiguo.
 */
function mediosTodosBd(): array
{
    $stmt = conexion()->prepare('SELECT ' . columnasMedio() . ' FROM medios ORDER BY id DESC');
    $stmt->execute();
    return $stmt->fetchAll();
}

/**
 * Medios originales: los que no son variantes ni recortes de otro.
 *
 * La biblioteca lista solo estos. Las variantes se guardan como filas hijas
 * y se ofrecen dentro de su original, así que listarlas también hacía que
 * cada foto apareciera tres veces en la rejilla.
 */
function mediosOriginalesBd(): array
{
    $stmt = conexion()->prepare(
        'SELECT ' . columnasMedio() . ' FROM medios WHERE padre_id IS NULL ORDER BY id DESC'
    );
    $stmt->execute();
    return $stmt->fetchAll();
}

/**
 * Medios cuyo padre es `$padreId` (variantes o recortes).
 */
function mediosHijasBd(int $padreId): array
{
    $stmt = conexion()->prepare('SELECT ' . columnasMedio() . ' FROM medios WHERE padre_id = ? ORDER BY id');
    $stmt->execute([$padreId]);
    return $stmt->fetchAll();
}

/**
 * Elimina un medio.
 */
function eliminarMedioBd(int $id): void
{
    $stmt = conexion()->prepare('DELETE FROM medios WHERE id = ?');
    $stmt->execute([$id]);
}

/**
 * Inserta una versión (historial) de un medio y devuelve su id.
 */
function insertarVersionMedioBd(
    int $medioId,
    string $nombreGuardado,
    string $url,
    string $mime,
    int $tamano,
    ?int $ancho,
    ?int $alto,
    string $motivo
): int {
    $stmt = conexion()->prepare(
        'INSERT INTO versiones_medio (medio_id, nombre_guardado, url, mime, tamano, ancho, alto, motivo)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([$medioId, $nombreGuardado, $url, $mime, $tamano, $ancho, $alto, $motivo]);
    return (int) conexion()->lastInsertId();
}

/**
 * Versiones de un medio, de la más reciente a la más antigua.
 */
function versionesDeMedioBd(int $medioId): array
{
    $stmt = conexion()->prepare(
        'SELECT id, medio_id, nombre_guardado, url, mime, tamano, ancho, alto, motivo, creado_en
           FROM versiones_medio WHERE medio_id = ? ORDER BY id DESC LIMIT 40'
    );
    $stmt->execute([$medioId]);
    return $stmt->fetchAll();
}

/**
 * Una versión concreta de un medio, o null.
 */
function versionMedioPorIdBd(int $medioId, int $versionId): ?array
{
    $stmt = conexion()->prepare(
        'SELECT id, medio_id, nombre_guardado, url, mime, tamano, ancho, alto, motivo, creado_en
           FROM versiones_medio WHERE id = ? AND medio_id = ? LIMIT 1'
    );
    $stmt->execute([$versionId, $medioId]);
    $fila = $stmt->fetch();
    return $fila === false ? null : $fila;
}

/**
 * Elimina todas las versiones de un medio.
 */
function eliminarVersionesMedioBd(int $medioId): void
{
    $stmt = conexion()->prepare('DELETE FROM versiones_medio WHERE medio_id = ?');
    $stmt->execute([$medioId]);
}
