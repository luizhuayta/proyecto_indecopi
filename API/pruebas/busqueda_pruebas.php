<?php
declare(strict_types=1);

/**
 * Pruebas de búsqueda: índice al publicar y resultados que no exponen borradores.
 */

require_once __DIR__ . '/../src/modulos/busqueda/servicio.php';
require_once __DIR__ . '/../src/modulos/paginas/servicio.php';
require_once __DIR__ . '/ayuda.php';

probar('la busqueda encuentra una pagina publicada', function () {
    $pdo = conexion();
    $pdo->beginTransaction();
    try {
        $admin = usuarioAdminPaginas();
        fijarSesionDePrueba($admin);
        $slug = 'busca-' . bin2hex(random_bytes(4));
        crearPagina(['titulo' => 'Admisión especial', 'slug' => $slug, 'ruta' => '/' . $slug], $admin);
        guardarBorrador($slug, 'es', contenidoPrueba('Requisitos de admisión 2026'), 1);
        publicarPagina($slug, 'es', 2);

        $r = buscar('admisión', 'es');
        $rutas = array_column($r, 'ruta');
        afirmar(in_array('/' . $slug, $rutas, true), 'debe encontrar la página publicada');
    } finally {
        $pdo->rollBack();
    }
});

probar('la busqueda no expone borradores', function () {
    $pdo = conexion();
    $pdo->beginTransaction();
    try {
        $admin = usuarioAdminPaginas();
        fijarSesionDePrueba($admin);
        $slug = 'secreto-' . bin2hex(random_bytes(4));
        crearPagina(['titulo' => 'Texto-solo-borrador único', 'slug' => $slug, 'ruta' => '/' . $slug], $admin);
        guardarBorrador($slug, 'es', contenidoPrueba('texto-solo-borrador'), 1);

        $r = buscar('texto-solo-borrador', 'es');
        afirmar(count($r) === 0, 'no debe encontrar borradores');
    } finally {
        $pdo->rollBack();
    }
});

probar('la busqueda devuelve titulo, ruta y un fragmento', function () {
    $pdo = conexion();
    $pdo->beginTransaction();
    try {
        $admin = usuarioAdminPaginas();
        fijarSesionDePrueba($admin);
        $slug = 'frag-' . bin2hex(random_bytes(4));
        crearPagina(['titulo' => 'Programa de gestión', 'slug' => $slug, 'ruta' => '/' . $slug], $admin);
        guardarBorrador($slug, 'es', contenidoPrueba('Aprende gestión de proyectos con nosotros.'), 1);
        publicarPagina($slug, 'es', 2);

        $r = buscar('gestión', 'es');
        afirmar(count($r) >= 1, 'debe encontrar el resultado');
        afirmar(($r[0]['titulo'] ?? '') === 'Programa de gestión', 'debe traer el título');
        afirmar(($r[0]['ruta'] ?? '') === '/' . $slug, 'debe traer la ruta');
        afirmar(str_contains((string) ($r[0]['fragmento'] ?? ''), 'gestión'), 'debe traer un fragmento');
    } finally {
        $pdo->rollBack();
    }
});

probar('la busqueda limita los resultados', function () {
    $r = buscar('', 'es', 3);
    afirmar(count($r) <= 3, 'debe respetar el límite');
});

probar('cambiar ruta o titulo actualiza el indice y borrar la pagina lo limpia', function () {
    $pdo = conexion();
    $pdo->beginTransaction();
    try {
        $admin = usuarioAdminPaginas();
        fijarSesionDePrueba($admin);
        $slug = 'meta-busca-' . bin2hex(random_bytes(4));
        $rutaVieja = '/' . $slug;
        $rutaNueva = '/nueva-' . $slug;
        crearPagina(['titulo' => 'Título viejo', 'slug' => $slug, 'ruta' => $rutaVieja], $admin);
        guardarBorrador($slug, 'es', contenidoPrueba('texto unico de busqueda'), 1);
        publicarPagina($slug, 'es', 2);

        $antes = array_column(buscar('texto unico de busqueda', 'es'), 'ruta');
        afirmar(in_array($rutaVieja, $antes, true), 'debe encontrar la ruta publicada');

        actualizarMetaPagina($slug, ['titulo' => 'Título nuevo', 'ruta' => $rutaNueva]);

        $despues = buscar('texto unico de busqueda', 'es');
        $rutas = array_column($despues, 'ruta');
        afirmar(!in_array($rutaVieja, $rutas, true), 'la ruta vieja debe salir del índice');
        afirmar(in_array($rutaNueva, $rutas, true), 'la ruta nueva debe entrar al índice');
        afirmar(($despues[0]['titulo'] ?? '') === 'Título nuevo', 'el título debe actualizarse');

        eliminarPagina($slug);
        afirmar(count(buscar('texto unico de busqueda', 'es')) === 0, 'al borrar no debe quedar nada');
    } finally {
        $pdo->rollBack();
    }
});
