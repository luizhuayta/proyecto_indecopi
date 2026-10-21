<?php
declare(strict_types=1);

/**
 * Acceso a las tablas `paginas` y `revisiones`. Todo el SQL del módulo vive
 * aquí. Consultas preparadas siempre.
 */

require_once __DIR__ . '/../../nucleo/base_datos.php';

/**
 * Fila completa de una página por slug y locale, o null.
 */
function paginaPorSlug(string $slug, string $locale): ?array
{
    $stmt = conexion()->prepare(
        'SELECT slug, locale, titulo, contenido, borrador, version, ruta, mostrar_en_menu, orden_menu, actualizado_en
           FROM paginas WHERE slug = ? AND locale = ? LIMIT 1'
    );
    $stmt->execute([$slug, $locale]);
    $fila = $stmt->fetch();
    return $fila === false ? null : $fila;
}

/**
 * Todas las páginas de un locale, ordenadas por orden de menú y slug.
 */
function paginasTodas(string $locale): array
{
    $stmt = conexion()->prepare(
        'SELECT slug, titulo, version, ruta, mostrar_en_menu, orden_menu, actualizado_en
           FROM paginas WHERE locale = ? ORDER BY orden_menu, slug'
    );
    $stmt->execute([$locale]);
    return $stmt->fetchAll();
}

/**
 * ¿Ya existe una página con ese slug y locale?
 */
function paginaExistePorSlug(string $slug, string $locale): bool
{
    $stmt = conexion()->prepare('SELECT slug FROM paginas WHERE slug = ? AND locale = ? LIMIT 1');
    $stmt->execute([$slug, $locale]);
    return $stmt->fetch() !== false;
}

/**
 * ¿Ya existe otra página con esa ruta? `exceptoSlug` excluye una página (para
 * no chocar consigo misma al cambiar su propio slug/ruta).
 */
function paginaExistePorRuta(string $ruta, string $locale, ?string $exceptoSlug = null): bool
{
    if ($exceptoSlug === null) {
        $stmt = conexion()->prepare('SELECT slug FROM paginas WHERE ruta = ? AND locale = ? LIMIT 1');
        $stmt->execute([$ruta, $locale]);
    } else {
        $stmt = conexion()->prepare('SELECT slug FROM paginas WHERE ruta = ? AND locale = ? AND slug <> ? LIMIT 1');
        $stmt->execute([$ruta, $locale, $exceptoSlug]);
    }
    return $stmt->fetch() !== false;
}

/**
 * Crea una página con el borrador inicial y versión 1 (sin contenido publicado).
 */
function insertarPagina(string $slug, string $locale, string $titulo, string $borradorJson, string $ruta, int $mostrarEnMenu, int $ordenMenu): void
{
    $stmt = conexion()->prepare(
        'INSERT INTO paginas (slug, locale, titulo, contenido, borrador, version, ruta, mostrar_en_menu, orden_menu)
         VALUES (?, ?, ?, NULL, ?, 1, ?, ?, ?)'
    );
    $stmt->execute([$slug, $locale, $titulo, $borradorJson, $ruta, $mostrarEnMenu, $ordenMenu]);
}

/**
 * Guarda el borrador subiendo la versión, solo si la versión actual coincide.
 * Devuelve el número de filas afectadas (0 = conflicto).
 */
function actualizarBorradorPagina(string $slug, string $locale, string $json, int $versionActual, int $versionNueva): int
{
    $stmt = conexion()->prepare(
        'UPDATE paginas SET borrador = ?, version = ? WHERE slug = ? AND locale = ? AND version = ?'
    );
    $stmt->execute([$json, $versionNueva, $slug, $locale, $versionActual]);
    return $stmt->rowCount();
}

/**
 * Pasa el borrador a contenido publicado, lo vacía y sube la versión, solo si
 * la versión actual coincide. Devuelve el número de filas afectadas.
 */
function publicarPaginaBd(string $slug, string $locale, string $json, int $versionActual, int $versionNueva): int
{
    $stmt = conexion()->prepare(
        'UPDATE paginas SET contenido = ?, borrador = NULL, version = ? WHERE slug = ? AND locale = ? AND version = ?'
    );
    $stmt->execute([$json, $versionNueva, $slug, $locale, $versionActual]);
    return $stmt->rowCount();
}

/**
 * Actualiza los metadatos de una página (incluido el slug).
 */
function actualizarMetaPaginaBd(string $slug, string $locale, string $nuevoSlug, string $titulo, string $ruta, int $mostrarEnMenu, int $ordenMenu): void
{
    $stmt = conexion()->prepare(
        'UPDATE paginas SET slug = ?, titulo = ?, ruta = ?, mostrar_en_menu = ?, orden_menu = ? WHERE slug = ? AND locale = ?'
    );
    $stmt->execute([$nuevoSlug, $titulo, $ruta, $mostrarEnMenu, $ordenMenu, $slug, $locale]);
}

/**
 * Mueve las revisiones de una página a un slug nuevo (cuando cambia el slug).
 */
function actualizarSlugRevisiones(string $slugViejo, string $slugNuevo, string $locale): void
{
    $stmt = conexion()->prepare('UPDATE revisiones SET slug = ? WHERE slug = ? AND locale = ?');
    $stmt->execute([$slugNuevo, $slugViejo, $locale]);
}

/**
 * Elimina una página y sus revisiones.
 */
function eliminarPaginaBd(string $slug, string $locale): void
{
    $stmt = conexion()->prepare('DELETE FROM paginas WHERE slug = ? AND locale = ?');
    $stmt->execute([$slug, $locale]);
}

/**
 * Elimina las revisiones de una página.
 */
function eliminarRevisionesPagina(string $slug, string $locale): void
{
    $stmt = conexion()->prepare('DELETE FROM revisiones WHERE slug = ? AND locale = ?');
    $stmt->execute([$slug, $locale]);
}

/**
 * Inserta una revisión (instantánea JSON del contenido publicado).
 */
function insertarRevision(string $slug, string $locale, string $autor, string $json): void
{
    $stmt = conexion()->prepare(
        'INSERT INTO revisiones (slug, locale, autor, instantanea) VALUES (?, ?, ?, ?)'
    );
    $stmt->execute([$slug, $locale, $autor, $json]);
}

/**
 * Revisiones de una página, de la más reciente a la más antigua.
 */
function revisionesDePagina(string $slug, string $locale): array
{
    $stmt = conexion()->prepare(
        'SELECT id, autor, instantanea, creado_en FROM revisiones WHERE slug = ? AND locale = ? ORDER BY id DESC LIMIT 40'
    );
    $stmt->execute([$slug, $locale]);
    return $stmt->fetchAll();
}

/**
 * Revisión concreta de una página, o null.
 */
function revisionPorId(string $slug, string $locale, int $id): ?array
{
    $stmt = conexion()->prepare(
        'SELECT id, slug, locale, autor, instantanea, creado_en FROM revisiones WHERE id = ? AND slug = ? AND locale = ? LIMIT 1'
    );
    $stmt->execute([$id, $slug, $locale]);
    $fila = $stmt->fetch();
    return $fila === false ? null : $fila;
}
