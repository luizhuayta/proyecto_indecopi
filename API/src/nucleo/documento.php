<?php
declare(strict_types=1);

/**
 * Documentos publicables por clave.
 *
 * El sitio tiene varios documentos que se editan con el mismo patrón:
 * borrador, publicación, control de versión por optimistic locking y
 * respuesta 409 ante conflicto. Antes cada uno tenía su propia tabla y su
 * propia copia de la maquinaria (`configuracion_sitio` y `apariencia_sitio`).
 * Aquí hay una sola tabla con una columna `clave` y una sola implementación.
 *
 * Las claves en uso:
 *   - `contenido`  : documento del sitio (cabecera, pie, contacto)
 *   - `apariencia` : colores, tipografías, logo y redes
 *
 * Lo que cada documento considera «preparado» (saneado, validación de
 * colores) lo decide quien llama, con un callback: este módulo no sabe de
 * bloques ni de paletas, solo de borradores y versiones.
 */

require_once __DIR__ . '/base_datos.php';
require_once __DIR__ . '/fechas.php';
require_once __DIR__ . '/json.php';
require_once __DIR__ . '/sesion.php';
require_once __DIR__ . '/auditoria.php';
require_once __DIR__ . '/../http/errores.php';

/** Clave del documento con el contenido general del sitio. */
const CLAVE_CONTENIDO = 'contenido';

/** Clave del documento con la apariencia del sitio. */
const CLAVE_APARIENCIA = 'apariencia';

/**
 * Fila de un documento publicable, o null si no existe.
 */
function documentoPorClave(string $clave, string $locale): ?array
{
    $stmt = conexion()->prepare(
        'SELECT clave, locale, contenido, borrador, version, actualizado_en
           FROM configuracion_sitio WHERE clave = ? AND locale = ? LIMIT 1'
    );
    $stmt->execute([$clave, $locale]);
    $fila = $stmt->fetch();
    return $fila === false ? null : $fila;
}

/**
 * Asegura que exista la fila del documento (versión 1, sin contenido), sin
 * tocar nada si ya existe.
 */
function asegurarDocumentoBd(string $clave, string $locale): void
{
    $stmt = conexion()->prepare(
        'INSERT IGNORE INTO configuracion_sitio (clave, locale, contenido, borrador, version)
         VALUES (?, ?, NULL, NULL, 1)'
    );
    $stmt->execute([$clave, $locale]);
}

/**
 * Guarda el borrador subiendo la versión, solo si la versión actual coincide.
 * Devuelve el número de filas afectadas (0 = hubo conflicto).
 */
function actualizarBorradorDocumentoBd(
    string $clave,
    string $locale,
    string $json,
    int $versionActual,
    int $versionNueva
): int {
    $stmt = conexion()->prepare(
        'UPDATE configuracion_sitio SET borrador = ?, version = ?
          WHERE clave = ? AND locale = ? AND version = ?'
    );
    $stmt->execute([$json, $versionNueva, $clave, $locale, $versionActual]);
    return $stmt->rowCount();
}

/**
 * Pasa el borrador a contenido publicado, lo vacía y sube la versión, solo si
 * la versión actual coincide. Devuelve el número de filas afectadas.
 */
function publicarDocumentoBd(
    string $clave,
    string $locale,
    string $json,
    int $versionActual,
    int $versionNueva
): int {
    $stmt = conexion()->prepare(
        'UPDATE configuracion_sitio
            SET contenido = ?, borrador = NULL, version = ?
          WHERE clave = ? AND locale = ? AND version = ?'
    );
    $stmt->execute([$json, $versionNueva, $clave, $locale, $versionActual]);
    return $stmt->rowCount();
}

/**
 * Prepara el contenido antes de guardarlo. El callback recibe el contenido y
 * devuelve ['contenido' => array, 'avisos' => array]. Si no se pasa, el
 * contenido se guarda tal cual.
 */
function prepararContenidoDocumento(array $contenido, ?callable $preparar): array
{
    if ($preparar === null) {
        return ['contenido' => $contenido, 'avisos' => []];
    }
    $resultado = $preparar($contenido);
    if (!is_array($resultado)) {
        return ['contenido' => $contenido, 'avisos' => []];
    }
    return [
        'contenido' => is_array($resultado['contenido'] ?? null) ? $resultado['contenido'] : $contenido,
        'avisos' => is_array($resultado['avisos'] ?? null) ? $resultado['avisos'] : [],
    ];
}

/**
 * Documento publicable: publicado para el público, borrador para quien tiene
 * sesión. Devuelve ['contenido', 'version', 'actualizado_en', 'tiene_borrador'].
 */
function leerDocumento(string $clave, string $locale, ?bool $conBorrador = null): array
{
    $fila = documentoPorClave($clave, $locale);
    $conSesion = $conBorrador ?? (usuarioActual() !== null);

    if ($fila === null) {
        $payload = ['contenido' => [], 'version' => 1, 'actualizado_en' => null];
        if ($conSesion) {
            $payload['tiene_borrador'] = false;
        }
        return $payload;
    }

    $borrador = decodificarJson($fila['borrador'] ?? null);
    $publicado = decodificarJson($fila['contenido'] ?? null);
    $tieneBorrador = $borrador !== null;
    $contenido = ($conSesion && $tieneBorrador) ? $borrador : ($publicado ?? []);

    $payload = [
        'contenido' => $contenido,
        'version' => (int) ($fila['version'] ?? 1),
        'actualizado_en' => aIso(isset($fila['actualizado_en']) ? (string) $fila['actualizado_en'] : null),
    ];
    if ($conSesion) {
        $payload['tiene_borrador'] = $tieneBorrador;
    }
    return $payload;
}

/**
 * Guarda el borrador de un documento. Exige la versión leída por el cliente;
 * si no coincide responde 409 con la versión y el contenido actuales.
 */
function guardarDocumento(
    string $clave,
    string $locale,
    array $contenido,
    int $version,
    ?callable $preparar = null
): array {
    exigirSesion();

    $preparado = prepararContenidoDocumento($contenido, $preparar);
    $json = json_encode($preparado['contenido'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false) {
        solicitudInvalida('El contenido no se puede guardar.');
    }

    $fila = documentoPorClave($clave, $locale);
    $actual = $fila === null ? 1 : (int) ($fila['version'] ?? 1);
    if ($version !== $actual) {
        lanzarConflictoDocumento($clave, $locale, $preparar);
    }

    $nueva = $actual + 1;
    $afectadas = enTransaccion(static function () use ($clave, $locale, $json, $actual, $nueva): int {
        asegurarDocumentoBd($clave, $locale);
        return actualizarBorradorDocumentoBd($clave, $locale, $json, $actual, $nueva);
    });
    if ($afectadas === 0) {
        lanzarConflictoDocumento($clave, $locale, $preparar);
    }

    $fresca = documentoPorClave($clave, $locale);
    registrarAuditoria('guardar_documento', 'configuracion_sitio', $clave . ':' . $locale, ['version' => $nueva]);

    $payload = [
        'contenido' => $preparado['contenido'],
        'version' => $nueva,
        'actualizado_en' => aIso($fresca !== null && isset($fresca['actualizado_en']) ? (string) $fresca['actualizado_en'] : null),
    ];
    if ($preparado['avisos'] !== []) {
        $payload['avisos'] = $preparado['avisos'];
    }
    return $payload;
}

/**
 * Publica un documento: pasa el borrador a contenido (o publica el contenido
 * actual si no hay borrador) y sube la versión.
 */
function publicarDocumento(
    string $clave,
    string $locale,
    int $version,
    ?callable $preparar = null
): array {
    exigirRol('admin');

    $fila = documentoPorClave($clave, $locale);
    $actual = $fila === null ? 1 : (int) ($fila['version'] ?? 1);
    if ($version !== $actual) {
        lanzarConflictoDocumento($clave, $locale, $preparar);
    }

    $borrador = $fila === null ? null : decodificarJson($fila['borrador'] ?? null);
    $publicado = $fila === null ? null : decodificarJson($fila['contenido'] ?? null);
    $aPublicar = $borrador !== null ? $borrador : ($publicado ?? []);

    $preparado = prepararContenidoDocumento($aPublicar, $preparar);
    $json = json_encode($preparado['contenido'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false) {
        solicitudInvalida('El contenido no se puede publicar.');
    }

    $nueva = $actual + 1;
    $afectadas = enTransaccion(static function () use ($clave, $locale, $json, $actual, $nueva): int {
        asegurarDocumentoBd($clave, $locale);
        return publicarDocumentoBd($clave, $locale, $json, $actual, $nueva);
    });
    if ($afectadas === 0) {
        lanzarConflictoDocumento($clave, $locale, $preparar);
    }

    registrarAuditoria('publicar_documento', 'configuracion_sitio', $clave . ':' . $locale, ['version' => $nueva]);

    $payload = [
        'contenido' => $preparado['contenido'],
        'version' => $nueva,
    ];
    if ($preparado['avisos'] !== []) {
        $payload['avisos'] = $preparado['avisos'];
    }
    return $payload;
}

/**
 * Lanza el 409 de conflicto de versión, con la versión, la fecha y el
 * contenido actuales.
 */
function lanzarConflictoDocumento(
    string $clave,
    string $locale,
    ?callable $preparar = null
): never {
    $fila = documentoPorClave($clave, $locale);
    $actual = $fila === null ? 1 : (int) ($fila['version'] ?? 1);
    $borrador = $fila === null ? null : decodificarJson($fila['borrador'] ?? null);
    $publicado = $fila === null ? null : decodificarJson($fila['contenido'] ?? null);
    $contenido = $borrador !== null ? $borrador : ($publicado ?? []);
    $preparado = prepararContenidoDocumento($contenido, $preparar);

    error_app('Alguien guardó esto antes. Recarga para no pisar cambios.', 409, [
        'version' => $actual,
        'actualizado_en' => $fila !== null && isset($fila['actualizado_en']) ? aIso((string) $fila['actualizado_en']) : null,
        'contenido' => $preparado['contenido'],
    ]);
}
