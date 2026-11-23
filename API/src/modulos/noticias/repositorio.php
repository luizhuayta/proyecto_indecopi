<?php
declare(strict_types=1);

/**
 * Acceso a la tabla `noticias`. Todo el SQL del módulo vive aquí.
 */

require_once __DIR__ . '/../../nucleo/base_datos.php';

const COLUMNAS_NOTICIA = 'id, tipo, titulo, slug, categoria, resumen, cuerpo, imagen_url, imagen_alt,
    destacada, estado, publicado_en, autor, creado_en, actualizado_en';

/**
 * Noticia por id, o null.
 */
function noticiaPorIdBd(int $id): ?array
{
    $stmt = conexion()->prepare('SELECT ' . COLUMNAS_NOTICIA . ' FROM noticias WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $fila = $stmt->fetch();
    return $fila === false ? null : $fila;
}

/**
 * ¿El slug ya lo usa otra noticia? `excepto` excluye la propia fila al editar.
 */
function slugNoticiaOcupadoBd(string $slug, ?int $excepto): bool
{
    $stmt = conexion()->prepare('SELECT 1 FROM noticias WHERE slug = ? AND id <> ? LIMIT 1');
    $stmt->execute([$slug, $excepto ?? 0]);
    return $stmt->fetchColumn() !== false;
}

/**
 * Inserta una noticia y devuelve su id. `$campos` ya viene validado y
 * normalizado por el servicio.
 */
function insertarNoticiaBd(array $campos): int
{
    $columnas = array_keys($campos);
    $stmt = conexion()->prepare(
        'INSERT INTO noticias (' . implode(', ', $columnas) . ') VALUES (' . implode(', ', array_fill(0, count($columnas), '?')) . ')'
    );
    $stmt->execute(array_values($campos));
    return (int) conexion()->lastInsertId();
}

/**
 * Actualiza los campos de una noticia. `$campos` ya viene validado.
 */
function actualizarNoticiaBd(int $id, array $campos): void
{
    $asignaciones = implode(', ', array_map(fn (string $c) => "{$c} = ?", array_keys($campos)));
    $stmt = conexion()->prepare("UPDATE noticias SET {$asignaciones} WHERE id = ?");
    $stmt->execute([...array_values($campos), $id]);
}

/**
 * Elimina una noticia por id.
 */
function eliminarNoticiaBd(int $id): void
{
    conexion()->prepare('DELETE FROM noticias WHERE id = ?')->execute([$id]);
}

/**
 * Todas las noticias para el panel (incluidos los borradores): la más
 * reciente primero.
 */
function noticiasAdminBd(): array
{
    return conexion()->query(
        'SELECT ' . COLUMNAS_NOTICIA . ' FROM noticias ORDER BY COALESCE(publicado_en, creado_en) DESC, id DESC LIMIT 500'
    )->fetchAll();
}

/**
 * Noticias publicadas y ya vigentes, con filtro opcional de tipo y texto.
 * Devuelve [filas, total] para la paginación.
 *
 * `$limite` y `$desplazamiento` llegan ya acotados a enteros por el servicio
 * (por eso se interpolan: PDO no admite LIMIT ? con emulación desactivada).
 */
function noticiasPublicasBd(?string $tipo, string $texto, int $limite, int $desplazamiento): array
{
    $condiciones = ["estado = 'publicado'", 'publicado_en <= NOW()'];
    $parametros = [];
    if ($tipo !== null) {
        $condiciones[] = 'tipo = ?';
        $parametros[] = $tipo;
    }
    if ($texto !== '') {
        $condiciones[] = '(titulo LIKE ? OR resumen LIKE ?)';
        $like = '%' . addcslashes($texto, '%_\\') . '%';
        array_push($parametros, $like, $like);
    }
    $donde = implode(' AND ', $condiciones);
    $total = conexion()->prepare("SELECT COUNT(*) FROM noticias WHERE {$donde}");
    $total->execute($parametros);
    $stmt = conexion()->prepare(
        'SELECT ' . COLUMNAS_NOTICIA . " FROM noticias WHERE {$donde} ORDER BY publicado_en DESC, id DESC LIMIT {$limite} OFFSET {$desplazamiento}"
    );
    $stmt->execute($parametros);
    return [$stmt->fetchAll(), (int) $total->fetchColumn()];
}

/**
 * Una noticia publicada y vigente por su slug, o null.
 */
function noticiaPublicaPorSlugBd(string $slug): ?array
{
    $stmt = conexion()->prepare(
        'SELECT ' . COLUMNAS_NOTICIA . " FROM noticias WHERE slug = ? AND estado = 'publicado' AND publicado_en <= NOW() LIMIT 1"
    );
    $stmt->execute([$slug]);
    $fila = $stmt->fetch();
    return $fila === false ? null : $fila;
}

/**
 * Slugs y fechas de las noticias publicadas, para el sitemap.
 */
function noticiasPublicadasSeoBd(): array
{
    return conexion()->query(
        "SELECT slug, actualizado_en FROM noticias WHERE estado = 'publicado' AND publicado_en <= NOW() ORDER BY publicado_en DESC"
    )->fetchAll();
}
