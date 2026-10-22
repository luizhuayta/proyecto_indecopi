<?php
declare(strict_types=1);

require_once __DIR__ . '/servicio.php';
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
