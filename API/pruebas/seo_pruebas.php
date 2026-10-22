<?php
declare(strict_types=1);

/**
 * Pruebas de SEO: sitemap con las páginas publicadas y robots.txt.
 */

require_once __DIR__ . '/../src/modulos/seo/servicio.php';
require_once __DIR__ . '/ayuda.php';

probar('el sitemap solo lista paginas publicadas', function () {
    $pdo = conexion();
    $pdo->beginTransaction();
    try {
        $admin = usuarioAdminPaginas();
        fijarSesionDePrueba($admin);
        $prefijo = 'seo-' . bin2hex(random_bytes(4));
        crearPagina(['titulo' => 'Publicada', 'slug' => $prefijo . '-pub', 'ruta' => '/' . $prefijo . '-pub'], $admin);
        publicarPagina($prefijo . '-pub', 'es', 1);
        crearPagina(['titulo' => 'Solo borrador', 'slug' => $prefijo . '-borr', 'ruta' => '/' . $prefijo . '-borr'], $admin);

        $xml = generarSitemap('es');
        afirmar(str_contains($xml, '<urlset'), 'debe ser un urlset');
        afirmar(str_contains($xml, '/' . $prefijo . '-pub'), 'debe listar la publicada');
        afirmar(!str_contains($xml, $prefijo . '-borr'), 'no debe listar borradores');
    } finally {
        $pdo->rollBack();
    }
});

probar('el sitemap usa la URL base configurada', function () {
    $xml = generarSitemap('es', 'https://ejemplo.test');
    afirmar(str_contains($xml, 'https://ejemplo.test/'), 'debe usar la URL base');
    afirmar(str_contains($xml, '<loc>'), 'debe tener localizaciones');
});

probar('el robots permite indexar y senala el sitemap', function () {
    $robots = contenidoRobots('https://ejemplo.test');
    afirmar(str_contains($robots, 'User-agent:'), 'debe declarar agentes');
    afirmar(str_contains($robots, 'Allow: /'), 'debe permitir indexar');
    afirmar(str_contains($robots, 'Sitemap: https://ejemplo.test/sitemap.xml'), 'debe enlazar el sitemap');
    afirmar(preg_match('/^Disallow: \/$/m', $robots) !== 1, 'no debe prohibir el sitio');
    afirmar(str_contains($robots, 'Disallow: /admin/'), 'sí debe proteger el panel');
});
