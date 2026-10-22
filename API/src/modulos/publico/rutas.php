<?php
declare(strict_types=1);

require_once __DIR__ . '/controlador.php';

function manejarRutasPublico(string $metodo, string $ruta): void
{
    if ($metodo === 'GET' && $ruta === '/publico/sitio') {
        controladorSitioPublico();
        return;
    }
    if ($metodo === 'GET' && $ruta === '/publico/pagina') {
        controladorPaginaPublica();
        return;
    }
    if ($metodo === 'GET' && $ruta === '/publico/sitemap.xml') {
        controladorSitemap();
        return;
    }
    if ($metodo === 'GET' && $ruta === '/publico/robots.txt') {
        controladorRobots();
        return;
    }
    if ($metodo === 'GET' && $ruta === '/publico/buscar') {
        controladorBuscar();
        return;
    }
    noEncontrado('Ruta no encontrada.');
}
