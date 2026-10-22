<?php
declare(strict_types=1);

require_once __DIR__ . '/../src/modulos/publico/servicio.php';
require_once __DIR__ . '/ayuda.php';

probar('los tokens publicos escapan identidad dentro de texto enriquecido', function () {
    $contenido = ['blocks' => [[
        'id' => 'token', 'type' => 'richText', 'hidden' => false,
        'props' => ['title' => '{{institucion.nombre}}', 'body' => '<p>{{institucion.nombre}}</p>'],
    ]]];
    $salida = resolverContenidoPublico($contenido, ['nombre' => '<img src=x onerror=alert(1)> & Instituto']);
    afirmar($salida['blocks'][0]['props']['title'] === '<img src=x onerror=alert(1)> & Instituto', 'el título sigue siendo texto');
    afirmar(!str_contains($salida['blocks'][0]['props']['body'], '<img'), 'la identidad no debe insertar etiquetas');
    afirmar(str_contains($salida['blocks'][0]['props']['body'], '&lt;img'), 'debe escapar el valor dentro del HTML');
    afirmar($contenido['blocks'][0]['props']['title'] === '{{institucion.nombre}}', 'no muta el original');
});

probar('el portal resuelve rutas reales y nunca muestra borradores aun con sesion', function () {
    $pdo = conexion();
    $pdo->beginTransaction();
    try {
        $admin = usuarioAdminPaginas();
        fijarSesionDePrueba($admin);
        $slug = 'portal-' . bin2hex(random_bytes(4));
        crearPagina(['titulo' => 'Oferta académica', 'slug' => $slug, 'ruta' => '/estudios/' . $slug], $admin);
        guardarBorrador($slug, 'es', contenidoPrueba('Publicado'), 1);
        publicarPagina($slug, 'es', 2);
        guardarBorrador($slug, 'es', contenidoPrueba('Secreto sin publicar'), 3);
        $pagina = paginaPublicaPorRuta('/estudios/' . $slug, 'es');
        afirmar(textoDeContenido($pagina['contenido']) === 'Publicado', 'debe mostrar solo lo publicado');
        afirmar(paginaPublicaPorRuta('/' . $slug, 'es') === null, 'no debe confundir slug con ruta');
        afirmar(paginaPublicaPorRuta('/no-existe-' . $slug, 'es') === null, 'una ruta desconocida no es la portada');
    } finally {
        $pdo->rollBack();
    }
});

probar('el menu publico excluye paginas sin publicar y ocultas del menu', function () {
    $pdo = conexion();
    $pdo->beginTransaction();
    try {
        $admin = usuarioAdminPaginas();
        fijarSesionDePrueba($admin);
        $prefijo = 'menu-' . bin2hex(random_bytes(4));
        foreach (['visible', 'borrador', 'oculta'] as $tipo) {
            $slug = $prefijo . '-' . $tipo;
            crearPagina(['titulo' => $tipo, 'slug' => $slug, 'mostrar_en_menu' => $tipo !== 'oculta'], $admin);
            if ($tipo !== 'borrador') {
                publicarPagina($slug, 'es', 1);
            }
        }
        $slugs = array_column(sitioPublico('es')['menu'], 'slug');
        afirmar(in_array($prefijo . '-visible', $slugs, true), 'incluye publicada visible');
        afirmar(!in_array($prefijo . '-borrador', $slugs, true), 'no filtra títulos de borradores');
        afirmar(!in_array($prefijo . '-oculta', $slugs, true), 'respeta ocultación del menú');
    } finally {
        $pdo->rollBack();
    }
});

probar('el tema publico ignora el borrador de apariencia incluso con sesion', function () {
    $pdo = conexion();
    $pdo->beginTransaction();
    try {
        fijarSesionDePrueba(usuarioAdminPaginas());
        $pdo->exec("DELETE FROM configuracion_sitio WHERE clave = 'apariencia' AND locale = 'es'");
        guardarDocumento(CLAVE_APARIENCIA, 'es', ['color_primario' => '#123a6d'], 1, 'prepararApariencia');
        publicarDocumento(CLAVE_APARIENCIA, 'es', 2, 'prepararApariencia');
        guardarDocumento(CLAVE_APARIENCIA, 'es', ['color_primario' => '#abcdef'], 3, 'prepararApariencia');
        afirmar(sitioPublico('es')['apariencia']['color_primario'] === '#123a6d', 'solo tema publicado');
    } finally {
        $pdo->rollBack();
    }
});

probar('la apariencia publicada resuelve los tokens de identidad', function () {
    $pdo = conexion();
    $pdo->beginTransaction();
    try {
        fijarSesionDePrueba(usuarioAdminPaginas());
        conexion()->exec("DELETE FROM institucion WHERE id = 1");
        insertarInstitucionBd(1, [
            'nombre' => 'Instituto de Prueba', 'ruc' => '', 'direccion' => '',
            'telefono' => '', 'correo' => '', 'ciudad' => '',
        ]);
        $pdo->exec("DELETE FROM configuracion_sitio WHERE clave = 'apariencia' AND locale = 'es'");
        guardarDocumento(CLAVE_APARIENCIA, 'es', ['pie_legal' => '© {{institucion.nombre}}'], 1, 'prepararApariencia');
        publicarDocumento(CLAVE_APARIENCIA, 'es', 2, 'prepararApariencia');
        afirmar(sitioPublico('es')['apariencia']['pie_legal'] === '© Instituto de Prueba', 'no debe quedar el token sin sustituir');
    } finally {
        $pdo->rollBack();
    }
});
