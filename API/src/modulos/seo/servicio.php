<?php
declare(strict_types=1);

/**
 * SEO: sitemap.xml y robots.txt del sitio público.
 *
 * Solo se listan las páginas con contenido publicado: una URL que lleva a un
 * borrador o a una página inexistente perjudica al sitio más que no estar.
 */

require_once __DIR__ . '/../../nucleo/base_datos.php';
require_once __DIR__ . '/../../nucleo/configuracion.php';
require_once __DIR__ . '/../../nucleo/fechas.php';
require_once __DIR__ . '/../noticias/repositorio.php';

/**
 * Filas de las páginas publicadas de un locale.
 */
function paginasPublicadasSeo(string $locale): array
{
    $stmt = conexion()->prepare(
        'SELECT ruta, slug, actualizado_en FROM paginas
          WHERE locale = ? AND contenido IS NOT NULL ORDER BY ruta'
    );
    $stmt->execute([$locale]);
    return $stmt->fetchAll();
}

/**
 * Ruta efectiva de una página (la columna `ruta`, o la derivada del slug).
 */
function rutaSeo(string $slug, string $ruta): string
{
    if ($ruta !== '') {
        return $ruta;
    }
    return $slug === 'inicio' ? '/' : '/' . $slug;
}

/**
 * XML del sitemap con las páginas publicadas.
 */
function generarSitemap(string $locale, ?string $base = null): string
{
    $base = rtrim($base ?? configurar('URL_BASE', 'https://ejemplo.test'), '/');
    $filas = paginasPublicadasSeo($locale);

    $urls = '';
    foreach ($filas as $fila) {
        $ruta = rutaSeo((string) $fila['slug'], (string) ($fila['ruta'] ?? ''));
        $ultima = isset($fila['actualizado_en']) ? (string) $fila['actualizado_en'] : '';
        $fecha = $ultima !== '' ? substr($ultima, 0, 10) : date('Y-m-d');
        $urls .= '  <url>' . "\n"
            . '    <loc>' . htmlspecialchars($base . $ruta, ENT_XML1 | ENT_QUOTES, 'UTF-8') . '</loc>' . "\n"
            . '    <lastmod>' . htmlspecialchars($fecha, ENT_XML1 | ENT_QUOTES, 'UTF-8') . '</lastmod>' . "\n"
            . '  </url>' . "\n";
    }

    // Las noticias publicadas también son URLs del sitio; el listado
    // /noticias solo entra cuando hay al menos una que enseñar.
    $noticias = noticiasPublicadasSeoBd();
    if ($noticias !== []) {
        $urls .= '  <url>' . "\n"
            . '    <loc>' . htmlspecialchars($base . '/noticias', ENT_XML1 | ENT_QUOTES, 'UTF-8') . '</loc>' . "\n"
            . '  </url>' . "\n";
        foreach ($noticias as $fila) {
            $fecha = substr((string) $fila['actualizado_en'], 0, 10) ?: date('Y-m-d');
            $urls .= '  <url>' . "\n"
                . '    <loc>' . htmlspecialchars($base . '/noticias/' . $fila['slug'], ENT_XML1 | ENT_QUOTES, 'UTF-8') . '</loc>' . "\n"
                . '    <lastmod>' . htmlspecialchars($fecha, ENT_XML1 | ENT_QUOTES, 'UTF-8') . '</lastmod>' . "\n"
                . '  </url>' . "\n";
        }
    }

    return '<?xml version="1.0" encoding="UTF-8"?>' . "\n"
        . '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n"
        . $urls
        . '</urlset>' . "\n";
}

/**
 * Contenido de robots.txt: permite indexar y señala el sitemap.
 */
function contenidoRobots(?string $base = null): string
{
    $base = rtrim($base ?? configurar('URL_BASE', 'https://ejemplo.test'), '/');
    return "User-agent: *\n"
        . "Allow: /\n"
        . "Disallow: /admin/\n"
        . "Disallow: /api/\n"
        . "\n"
        . "Sitemap: {$base}/sitemap.xml\n";
}
