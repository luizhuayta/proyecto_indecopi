<?php
declare(strict_types=1);

require_once __DIR__ . '/servicio.php';
require_once __DIR__ . '/../seo/servicio.php';
require_once __DIR__ . '/../busqueda/servicio.php';
require_once __DIR__ . '/../../http/respuesta.php';

function controladorSitioPublico(): void
{
    json_out(sitioPublico(localeDePeticion()));
}

function controladorPaginaPublica(): void
{
    $ruta = $_GET['ruta'] ?? '/';
    if (!is_string($ruta) || !str_starts_with($ruta, '/') || str_starts_with($ruta, '//') || strlen($ruta) > 500) {
        solicitudInvalida('La ruta de la página no es válida.');
    }
    $pagina = paginaPublicaPorRuta($ruta, localeDePeticion());
    if ($pagina === null) {
        noEncontrado('Esta página no está disponible.');
    }
    json_out($pagina);
}

/**
 * GET /publico/sitemap.xml — sitemap con las páginas publicadas.
 */
function controladorSitemap(): void
{
    header('Content-Type: application/xml; charset=utf-8');
    echo generarSitemap(localeDePeticion());
}

/**
 * GET /publico/robots.txt — permite indexar y señala el sitemap.
 */
function controladorRobots(): void
{
    header('Content-Type: text/plain; charset=utf-8');
    echo contenidoRobots();
}

/**
 * GET /publico/buscar?q=texto — resultados en las páginas publicadas.
 */
function controladorBuscar(): void
{
    $consulta = (string) ($_GET['q'] ?? '');
    if (mb_strlen($consulta) > 120) {
        solicitudInvalida('La consulta es demasiado larga.');
    }
    $limite = (int) ($_GET['limite'] ?? 20);
    json_out(['resultados' => buscar($consulta, localeDePeticion(), $limite)]);
}
