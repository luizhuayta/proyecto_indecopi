<?php
declare(strict_types=1);

/**
 * Pruebas del rol `secretaria`: bandeja de mensajes completa, noticias como
 * el editor (crea y edita borradores; no publica ni elimina) y medios. Sin
 * acceso a páginas, identidad, apariencia, usuarios ni contenido del sitio:
 * la autorización final siempre la decide la API.
 */

require_once __DIR__ . '/../src/nucleo/sesion.php';
require_once __DIR__ . '/../src/modulos/sesion_usuarios/servicio.php';
require_once __DIR__ . '/../src/modulos/paginas/servicio.php';
require_once __DIR__ . '/../src/modulos/noticias/servicio.php';
require_once __DIR__ . '/../src/modulos/mensajes/servicio.php';
require_once __DIR__ . '/../src/modulos/identidad/servicio.php';
require_once __DIR__ . '/../src/modulos/contenido/servicio.php';
require_once __DIR__ . '/ayuda.php';

/**
 * Crea (o recrea) la usuaria secretaria de pruebas y devuelve su id.
 */
function usuarioSecretariaPrueba(): int
{
    $pdo = conexion();
    $pdo->prepare("DELETE FROM usuarios WHERE usuario = 'prueba-sesion-secretaria'")->execute();
    $pdo->prepare(
        "INSERT INTO usuarios (usuario, hash_contrasena, rol, activo) VALUES ('prueba-sesion-secretaria', ?, 'secretaria', 1)"
    )->execute([password_hash('ClavePrueba123', PASSWORD_DEFAULT)]);
    return (int) $pdo->lastInsertId();
}

probar('el alta y el cambio de rol admiten secretaria', function () {
    $pdo = conexion();
    $pdo->beginTransaction();
    try {
        fijarSesionDePrueba(usuarioAdminPaginas());
        $nueva = crearUsuario([
            'usuario' => 'secretaria.demo',
            'contrasena' => 'ClaveSecretaria123',
            'rol' => 'secretaria',
        ]);
        afirmar(($nueva['item']['rol'] ?? '') === 'secretaria', 'el alta acepta el rol secretaria');

        $cambiada = actualizarUsuario((int) $nueva['item']['id'], ['rol' => 'secretaria']);
        afirmar(($cambiada['item']['rol'] ?? '') === 'secretaria', 'el cambio de rol acepta secretaria');

        intentar(fn () => actualizarUsuario((int) $nueva['item']['id'], ['rol' => 'jefatura']));
        afirmar(error_ultimo_codigo() === 400, 'un rol desconocido sigue rechazado');
    } finally {
        fijarSesionDePrueba(null);
        $pdo->rollBack();
    }
});

probar('secretaria gestiona la bandeja de mensajes como el editor', function () {
    $pdo = conexion();
    $pdo->beginTransaction();
    try {
        fijarSesionDePrueba(usuarioSecretariaPrueba());
        $mensaje = crearMensaje([
            'nombre' => 'Ana Prueba',
            'correo' => 'ana@ejemplo.test',
            'mensaje' => 'Consulta de matrícula.',
        ], 'contacto');

        $bandeja = listarMensajes([]);
        afirmar(count($bandeja) >= 1, 'secretaria ve la bandeja');

        $respondido = responderMensaje((int) $mensaje['id'], 'Gracias, lo atendemos.', false);
        afirmar(($respondido['estado'] ?? '') === 'respondido', 'secretaria responde');

        $archivado = archivarMensaje((int) $mensaje['id']);
        afirmar(($archivado['estado'] ?? '') === 'archivado', 'secretaria archiva');
    } finally {
        fijarSesionDePrueba(null);
        $pdo->rollBack();
    }
});

probar('secretaria redacta noticias como editor, sin publicar ni eliminar', function () {
    $pdo = conexion();
    $pdo->beginTransaction();
    try {
        $secretaria = usuarioSecretariaPrueba();
        fijarSesionDePrueba($secretaria);

        $listado = listarNoticiasAdmin();
        afirmar(is_array($listado), 'secretaria lista las noticias del panel');

        $noticia = crearNoticia(['titulo' => 'Comunicado de secretaria']);
        afirmar(($noticia['estado'] ?? '') === 'borrador', 'la noticia nace como borrador');

        $editada = actualizarNoticia((int) $noticia['id'], ['resumen' => 'Resumen revisado.']);
        afirmar(($editada['resumen'] ?? '') === 'Resumen revisado.', 'secretaria edita el borrador');

        intentar(fn () => crearNoticia(['titulo' => 'Publicada directo', 'estado' => 'publicado']));
        afirmar(error_ultimo_codigo() === 403, 'secretaria no crea publicada');

        intentar(fn () => actualizarNoticia((int) $noticia['id'], ['estado' => 'publicado']));
        afirmar(error_ultimo_codigo() === 403, 'secretaria no publica al editar');

        intentar(fn () => eliminarNoticia((int) $noticia['id']));
        afirmar(error_ultimo_codigo() === 403, 'secretaria no elimina');

        // Tampoco toca una noticia ya publicada por el administrador.
        fijarSesionDePrueba(usuarioAdminPaginas());
        $publicada = crearNoticia(['titulo' => 'Publicada por admin', 'estado' => 'publicado']);
        fijarSesionDePrueba($secretaria);
        intentar(fn () => actualizarNoticia((int) $publicada['id'], ['resumen' => 'Toque ajeno.']));
        afirmar(error_ultimo_codigo() === 403, 'secretaria no edita lo ya publicado');
    } finally {
        fijarSesionDePrueba(null);
        $pdo->rollBack();
    }
});

probar('secretaria no entra a paginas, configuracion, identidad ni usuarios', function () {
    $pdo = conexion();
    $pdo->beginTransaction();
    try {
        $admin = usuarioAdminPaginas();
        fijarSesionDePrueba($admin);
        limpiarPaginaPrueba('secretariapag');
        crearPagina(['titulo' => 'Página vedada', 'slug' => 'secretariapag'], $admin);

        fijarSesionDePrueba(usuarioSecretariaPrueba());
        intentar(fn () => listarPaginas('es'));
        afirmar(error_ultimo_codigo() === 403, 'no lista páginas');
        intentar(fn () => guardarBorrador('secretariapag', 'es', contenidoPrueba('toque'), 1));
        afirmar(error_ultimo_codigo() === 403, 'no guarda borradores de página');
        intentar(fn () => listarRevisiones('secretariapag', 'es'));
        afirmar(error_ultimo_codigo() === 403, 'no ve el historial');
        intentar(fn () => publicarPagina('secretariapag', 'es', 1));
        afirmar(error_ultimo_codigo() === 403, 'no publica páginas');

        intentar(fn () => verContenidoDelSitio('es'));
        afirmar(error_ultimo_codigo() === 403, 'no lee el contenido del sitio');
        intentar(fn () => guardarContenidoDelSitio(['clave' => 'valor'], 1, 'es'));
        afirmar(error_ultimo_codigo() === 403, 'no guarda el contenido del sitio');
        intentar(fn () => guardarApariencia(['color_primario' => '#123456'], 1, 'es'));
        afirmar(error_ultimo_codigo() === 403, 'no guarda la apariencia');

        intentar(fn () => guardarIdentidad(['nombre' => 'Otro nombre']));
        afirmar(error_ultimo_codigo() === 403, 'no guarda la identidad');

        intentar(fn () => listarUsuarios());
        afirmar(error_ultimo_codigo() === 403, 'no lista usuarios');
        intentar(fn () => crearUsuario(['usuario' => 'intruso', 'contrasena' => 'ClaveIntruso123', 'rol' => 'admin']));
        afirmar(error_ultimo_codigo() === 403, 'no crea usuarios');
    } finally {
        fijarSesionDePrueba(null);
        limpiarPaginaPrueba('secretariapag');
        $pdo->rollBack();
    }
});

probar('secretaria puede cambiar su propia contrasena', function () {
    $pdo = conexion();
    $pdo->beginTransaction();
    try {
        fijarSesionDePrueba(usuarioSecretariaPrueba());
        $res = cambiarContrasena([
            'contrasena_actual' => 'ClavePrueba123',
            'contrasena' => 'ClaveNuevaSecretaria9',
        ]);
        afirmar(($res['ok'] ?? false) === true, 'la contraseña propia se cambia');
    } finally {
        fijarSesionDePrueba(null);
        $pdo->rollBack();
    }
});
