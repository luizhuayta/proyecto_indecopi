<?php
declare(strict_types=1);

/**
 * Pruebas del módulo de noticias: alta, slug único, saneado del cuerpo,
 * permisos de publicación y listado público.
 */

require_once __DIR__ . '/../src/modulos/noticias/servicio.php';
require_once __DIR__ . '/../src/modulos/seo/servicio.php';
require_once __DIR__ . '/ayuda.php';

/** Usuario editor de pruebas (se recrea en cada ejecución). */
function usuarioEditorNoticias(): int
{
    $pdo = conexion();
    $pdo->prepare("DELETE FROM usuarios WHERE usuario = 'editornoticias'")->execute();
    $pdo->prepare("INSERT INTO usuarios (usuario, hash_contrasena, rol, activo) VALUES ('editornoticias', ?, 'editor', 1)")
        ->execute([password_hash('ClavePrueba123', PASSWORD_DEFAULT)]);
    return (int) $pdo->lastInsertId();
}

probar('el editor crea un borrador con slug derivado del titulo y cuerpo saneado', function () {
    $pdo = conexion();
    $pdo->beginTransaction();
    try {
        fijarSesionDePrueba(usuarioEditorNoticias());
        $n = crearNoticia([
            'titulo' => 'Día de la Peruanidad 2025',
            'cuerpo' => '<p>Actos cívicos</p><script>alert(1)</script>',
        ]);
        afirmar($n['slug'] === 'dia-de-la-peruanidad-2025', 'slug derivado: ' . $n['slug']);
        afirmar($n['estado'] === 'borrador', 'nace como borrador');
        afirmar(!str_contains($n['cuerpo'], '<script'), 'el cuerpo se sanea');
        $otra = crearNoticia(['titulo' => 'Día de la Peruanidad 2025']);
        afirmar($otra['slug'] === 'dia-de-la-peruanidad-2025-2', 'slug único: ' . $otra['slug']);
    } finally {
        fijarSesionDePrueba(null);
        $pdo->rollBack();
    }
});

probar('el editor no puede publicar; el administrador si', function () {
    $pdo = conexion();
    $pdo->beginTransaction();
    try {
        fijarSesionDePrueba(usuarioEditorNoticias());
        intentar(fn () => crearNoticia(['titulo' => 'Publicada por editor', 'estado' => 'publicado']));
        afirmar(error_ultimo_codigo() === 403, 'publicar exige admin');

        fijarSesionDePrueba(usuarioAdminPaginas());
        $n = crearNoticia(['titulo' => 'Publicada por admin', 'estado' => 'publicado']);
        afirmar($n['estado'] === 'publicado' && $n['publicado_en'] !== null, 'publica con fecha');
    } finally {
        fijarSesionDePrueba(null);
        $pdo->rollBack();
    }
});

probar('el listado publico solo trae publicadas y ya vigentes, por tipo', function () {
    $pdo = conexion();
    $pdo->beginTransaction();
    try {
        fijarSesionDePrueba(usuarioAdminPaginas());
        crearNoticia(['titulo' => 'Visible prueba', 'estado' => 'publicado', 'tipo' => 'noticia']);
        crearNoticia(['titulo' => 'Comunicado prueba', 'estado' => 'publicado', 'tipo' => 'comunicado']);
        crearNoticia(['titulo' => 'Borrador prueba']);
        crearNoticia(['titulo' => 'Futura prueba', 'estado' => 'publicado', 'publicado_en' => '2999-01-01 08:00']);
        fijarSesionDePrueba(null);

        $titulos = array_column(noticiasPublicas(['tipo' => 'noticia', 'q' => 'prueba'])['items'], 'titulo');
        afirmar(in_array('Visible prueba', $titulos, true), 'la publicada aparece');
        afirmar(!in_array('Borrador prueba', $titulos, true), 'el borrador no');
        afirmar(!in_array('Futura prueba', $titulos, true), 'la programada no');
        afirmar(!in_array('Comunicado prueba', $titulos, true), 'filtra por tipo');
        intentar(fn () => noticiaPublica('borrador-prueba'));
        afirmar(error_ultimo_codigo() === 404, 'el detalle de un borrador es 404');
    } finally {
        fijarSesionDePrueba(null);
        $pdo->rollBack();
    }
});

probar('una imagen con protocolo no permitido se rechaza', function () {
    $pdo = conexion();
    $pdo->beginTransaction();
    try {
        fijarSesionDePrueba(usuarioEditorNoticias());
        intentar(fn () => crearNoticia(['titulo' => 'Imagen mala', 'imagen_url' => 'javascript:alert(1)']));
        afirmar(error_ultimo_codigo() === 400, 'imagen_url invalida');
    } finally {
        fijarSesionDePrueba(null);
        $pdo->rollBack();
    }
});

probar('solo el administrador elimina', function () {
    $pdo = conexion();
    $pdo->beginTransaction();
    try {
        fijarSesionDePrueba(usuarioEditorNoticias());
        $n = crearNoticia(['titulo' => 'Para borrar']);
        intentar(fn () => eliminarNoticia((int) $n['id']));
        afirmar(error_ultimo_codigo() === 403, 'el editor no elimina');
        fijarSesionDePrueba(usuarioAdminPaginas());
        afirmar(eliminarNoticia((int) $n['id'])['id'] === (int) $n['id'], 'el admin elimina');
    } finally {
        fijarSesionDePrueba(null);
        $pdo->rollBack();
    }
});

probar('el sitemap incluye las noticias publicadas', function () {
    $pdo = conexion();
    $pdo->beginTransaction();
    try {
        fijarSesionDePrueba(usuarioAdminPaginas());
        crearNoticia(['titulo' => 'Noticia del sitemap', 'estado' => 'publicado']);
        fijarSesionDePrueba(null);
        afirmar(str_contains(generarSitemap('es', 'https://ejemplo.test'), '/noticias/noticia-del-sitemap'), 'debe listar la noticia');
    } finally {
        fijarSesionDePrueba(null);
        $pdo->rollBack();
    }
});

probar('la busqueda del sitio encuentra la noticia publicada, no el borrador', function () {
    $pdo = conexion();
    $pdo->beginTransaction();
    try {
        fijarSesionDePrueba(usuarioAdminPaginas());
        crearNoticia([
            'titulo' => 'Palabraclave visible',
            'estado' => 'publicado',
            'resumen' => 'Resumen con la palabraclave dentro.',
        ]);
        crearNoticia(['titulo' => 'Palabraclave oculta', 'resumen' => 'Solo en el borrador.']);
        fijarSesionDePrueba(null);

        $rutas = array_column(buscar('palabraclave', 'es'), 'ruta');
        afirmar(in_array('/noticias/palabraclave-visible', $rutas, true), 'la publicada se indexa');
        afirmar(!in_array('/noticias/palabraclave-oculta', $rutas, true), 'el borrador no');
    } finally {
        fijarSesionDePrueba(null);
        $pdo->rollBack();
    }
});
