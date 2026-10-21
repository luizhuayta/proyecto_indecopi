<?php
declare(strict_types=1);

/**
 * Pruebas de páginas, saneado, borradores, publicación, historial y
 * validación de bloques. Requieren base de datos; se omiten si la conexión no
 * está disponible.
 */

require_once __DIR__ . '/../src/nucleo/sesion.php';
require_once __DIR__ . '/../src/nucleo/saneado.php';
require_once __DIR__ . '/../src/modulos/paginas/servicio.php';

/**
 * Crea (o recrea) un usuario administrador de pruebas y devuelve su id.
 */
function usuarioAdminPaginas(): int
{
    $pdo = conexion();
    $pdo->prepare("DELETE FROM usuarios WHERE usuario = 'adminpaginas'")->execute();
    $stmt = $pdo->prepare(
        "INSERT INTO usuarios (usuario, hash_contrasena, rol, activo) VALUES (?, ?, 'admin', 1)"
    );
    $stmt->execute(['adminpaginas', password_hash('ClavePrueba123', PASSWORD_DEFAULT)]);
    return (int) $pdo->lastInsertId();
}

/**
 * Elimina una página de pruebas y sus revisiones (para ejecuciones repetidas).
 */
function limpiarPaginaPrueba(string $slug): void
{
    $pdo = conexion();
    $pdo->prepare('DELETE FROM revisiones WHERE slug = ?')->execute([$slug]);
    $pdo->prepare('DELETE FROM paginas WHERE slug = ?')->execute([$slug]);
}

/**
 * Bloque richText de pruebas.
 */
function bloqueRichTextPrueba(string $texto): array
{
    return [
        'id' => 'bloque-prueba',
        'type' => 'richText',
        'hidden' => false,
        'layout' => ['width' => 'full', 'padding' => '', 'background' => ''],
        'props' => ['title' => '', 'lastUpdated' => '', 'body' => '<p>' . $texto . '</p>'],
    ];
}

/**
 * Contenido válido de una página de pruebas (un bloque richText).
 */
function contenidoPrueba(string $texto): array
{
    return ['schemaVersion' => 1, 'blocks' => [bloqueRichTextPrueba($texto)]];
}

/**
 * Texto plano del cuerpo del primer bloque de un contenido.
 */
function textoDeContenido(array $contenido): string
{
    $cuerpo = $contenido['blocks'][0]['props']['body'] ?? '';
    return trim(strip_tags((string) $cuerpo));
}

probar('el saneado quita scripts y manejadores', function () {
    $limpio = sanearHtml('<p>Hola<script>alert(1)</script></p><a href="/x" onclick="x()">enlace</a>');
    afirmar(!str_contains($limpio, 'script'), 'debe quitar script');
    afirmar(!str_contains($limpio, 'onclick'), 'debe quitar manejadores');
    afirmar(str_contains($limpio, 'Hola'), 'debe conservar el texto');
    afirmar(str_contains($limpio, 'enlace'), 'debe conservar el enlace');
});

probar('el saneado baja los titulos h3 a h2', function () {
    afirmar(str_contains(sanearHtml('<h3>Sub</h3>'), '<h2>'), 'h3 debe bajar a h2');
});

probar('el enlace javascript se rechaza', function () {
    afirmar(validarEnlace('javascript:alert(1)') !== null, 'debe rechazarse');
    afirmar(validarEnlace('data:text/html,x') !== null, 'data: debe rechazarse');
    afirmar(validarEnlace('/contacto') === null, 'la ruta interna es válida');
    afirmar(validarEnlace('https://ejemplo.test') === null, 'https es válido');
});

probar('el token de institucion sobrevive al saneado', function () {
    $limpio = sanearHtml('<p>{{institucion.nombre}}</p>');
    afirmar(str_contains($limpio, '{{institucion.nombre}}'), 'el token debe sobrevivir');
});

probar('guardar con version vieja responde 409', function () {
    $admin = usuarioAdminPaginas();
    fijarSesionDePrueba($admin);
    limpiarPaginaPrueba('versionvieja');
    crearPagina(['titulo' => 'Versión vieja', 'slug' => 'versionvieja'], $admin);
    guardarBorrador('versionvieja', 'es', contenidoPrueba('uno'), 1);
    intentar(function () {
        guardarBorrador('versionvieja', 'es', contenidoPrueba('dos'), 1);
    });
    afirmar(error_ultimo_codigo() === 409, 'debe responder 409');
});

probar('guardar con la version correcta responde 200', function () {
    $admin = usuarioAdminPaginas();
    fijarSesionDePrueba($admin);
    limpiarPaginaPrueba('versionok');
    crearPagina(['titulo' => 'Versión ok', 'slug' => 'versionok'], $admin);
    $resultado = guardarBorrador('versionok', 'es', contenidoPrueba('uno'), 1);
    afirmar(($resultado['version'] ?? 0) === 2, 'debe subir a la versión 2');
    afirmar(isset($resultado['contenido']), 'debe devolver el contenido');
});

probar('publicar mueve el borrador a publicado', function () {
    $admin = usuarioAdminPaginas();
    fijarSesionDePrueba($admin);
    limpiarPaginaPrueba('publica1');
    crearPagina(['titulo' => 'Publicar', 'slug' => 'publica1'], $admin);
    guardarBorrador('publica1', 'es', contenidoPrueba('visible'), 1);
    $resultado = publicarPagina('publica1', 'es', 2);
    afirmar(($resultado['version'] ?? 0) === 3, 'debe subir la versión');
    $fila = paginaPorSlug('publica1', 'es');
    afirmar($fila !== null, 'debe existir la página');
    afirmar(decodificarJson($fila['borrador'] ?? null) === null, 'el borrador queda vacío');
    afirmar(textoDeContenido(decodificarJson($fila['contenido']) ?? []) === 'visible', 'el contenido publicado es el borrador');
});

probar('publicar deja historial', function () {
    $admin = usuarioAdminPaginas();
    fijarSesionDePrueba($admin);
    limpiarPaginaPrueba('historial1');
    crearPagina(['titulo' => 'Historial', 'slug' => 'historial1'], $admin);
    guardarBorrador('historial1', 'es', contenidoPrueba('historia'), 1);
    publicarPagina('historial1', 'es', 2);
    $revisiones = listarRevisiones('historial1', 'es');
    afirmar(count($revisiones['items']) >= 1, 'debe haber al menos una revisión');
});

probar('restaurar una revision la guarda como borrador', function () {
    $admin = usuarioAdminPaginas();
    fijarSesionDePrueba($admin);
    limpiarPaginaPrueba('restaurar1');
    crearPagina(['titulo' => 'Restaurar', 'slug' => 'restaurar1'], $admin);
    guardarBorrador('restaurar1', 'es', contenidoPrueba('primero'), 1);
    publicarPagina('restaurar1', 'es', 2);
    $revision = listarRevisiones('restaurar1', 'es')['items'][0];
    guardarBorrador('restaurar1', 'es', contenidoPrueba('segundo'), 3);
    $resultado = restaurarRevision('restaurar1', 'es', (int) $revision['id'], 4);
    afirmar(($resultado['version'] ?? 0) === 5, 'debe subir la versión');
    $fila = paginaPorSlug('restaurar1', 'es');
    afirmar($fila !== null, 'debe existir la página');
    $borrador = decodificarJson($fila['borrador'] ?? null);
    $publicado = decodificarJson($fila['contenido'] ?? null);
    afirmar($borrador !== null, 'debe quedar un borrador');
    afirmar(textoDeContenido($borrador ?? []) === 'primero', 'el borrador es la instantánea');
    afirmar(textoDeContenido($publicado ?? []) === 'primero', 'lo publicado no cambia');
});

probar('un bloque de tipo desconocido se rechaza con 400', function () {
    $admin = usuarioAdminPaginas();
    fijarSesionDePrueba($admin);
    limpiarPaginaPrueba('tipomalo');
    crearPagina(['titulo' => 'Tipo malo', 'slug' => 'tipomalo'], $admin);
    $contenido = ['schemaVersion' => 1, 'blocks' => [
        ['id' => 'x', 'type' => 'desconocido', 'hidden' => false, 'props' => []],
    ]];
    intentar(function () use ($contenido) {
        guardarBorrador('tipomalo', 'es', $contenido, 1);
    });
    afirmar(error_ultimo_codigo() === 400, 'debe responder 400');
});

probar('una pagina con cero bloques se rechaza con 400', function () {
    $admin = usuarioAdminPaginas();
    fijarSesionDePrueba($admin);
    limpiarPaginaPrueba('cero1');
    crearPagina(['titulo' => 'Cero', 'slug' => 'cero1'], $admin);
    intentar(function () {
        guardarBorrador('cero1', 'es', ['schemaVersion' => 1, 'blocks' => []], 1);
    });
    afirmar(error_ultimo_codigo() === 400, 'debe responder 400');
});

probar('crear una pagina con la plantilla blank deja un bloque richText', function () {
    $admin = usuarioAdminPaginas();
    fijarSesionDePrueba($admin);
    limpiarPaginaPrueba('blank1');
    $resultado = crearPagina(['titulo' => 'En blanco', 'slug' => 'blank1', 'plantilla' => 'blank'], $admin);
    $bloques = $resultado['contenido']['blocks'] ?? [];
    afirmar(count($bloques) === 1, 'debe dejar un único bloque');
    afirmar(($bloques[0]['type'] ?? '') === 'richText', 'el bloque debe ser richText');
});

probar('el slug duplicado responde 409', function () {
    $admin = usuarioAdminPaginas();
    fijarSesionDePrueba($admin);
    limpiarPaginaPrueba('duplicado1');
    crearPagina(['titulo' => 'Duplicado', 'slug' => 'duplicado1'], $admin);
    intentar(function () use ($admin) {
        crearPagina(['titulo' => 'Otra', 'slug' => 'duplicado1'], $admin);
    });
    afirmar(error_ultimo_codigo() === 409, 'debe responder 409');
});

probar('el menu solo incluye las paginas visibles', function () {
    $admin = usuarioAdminPaginas();
    fijarSesionDePrueba($admin);
    limpiarPaginaPrueba('menuvisible');
    limpiarPaginaPrueba('menuoculta');
    crearPagina(['titulo' => 'Visible', 'slug' => 'menuvisible', 'mostrar_en_menu' => true], $admin);
    crearPagina(['titulo' => 'Oculta', 'slug' => 'menuoculta', 'mostrar_en_menu' => false], $admin);
    $listado = listarPaginas('es');
    $slugs = array_column($listado['menu'], 'slug');
    afirmar(in_array('menuvisible', $slugs, true), 'la visible debe estar en el menú');
    afirmar(!in_array('menuoculta', $slugs, true), 'la oculta no debe estar en el menú');
});
