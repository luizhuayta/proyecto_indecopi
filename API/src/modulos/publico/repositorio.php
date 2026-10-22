<?php
declare(strict_types=1);

require_once __DIR__ . '/../../nucleo/base_datos.php';

function slugPublicadoPorRuta(string $ruta, string $locale): ?string
{
    $stmt = conexion()->prepare(
        "SELECT slug FROM paginas WHERE locale = ? AND contenido IS NOT NULL
         AND COALESCE(NULLIF(ruta, ''), CASE WHEN slug = 'inicio' THEN '/' ELSE CONCAT('/', slug) END) = ? LIMIT 1"
    );
    $stmt->execute([$locale, $ruta]);
    $slug = $stmt->fetchColumn();
    return $slug === false ? null : (string) $slug;
}

function menuPublicadoBd(string $locale): array
{
    $stmt = conexion()->prepare(
        'SELECT slug, titulo, ruta, mostrar_en_menu, orden_menu, actualizado_en, version
         FROM paginas WHERE locale = ? AND contenido IS NOT NULL AND mostrar_en_menu = 1
         ORDER BY orden_menu, slug'
    );
    $stmt->execute([$locale]);
    return $stmt->fetchAll();
}
