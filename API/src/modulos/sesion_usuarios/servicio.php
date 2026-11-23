<?php
declare(strict_types=1);

/**
 * Lógica de negocio de sesión y usuarios.
 * Capa servicio: valida, autoriza y coordina núcleo + repositorio.
 */

require_once __DIR__ . '/../../nucleo/sesion.php';
require_once __DIR__ . '/../../nucleo/csr.php';
require_once __DIR__ . '/../../nucleo/auditoria.php';
require_once __DIR__ . '/../../nucleo/validacion.php';
require_once __DIR__ . '/../../nucleo/fechas.php';
require_once __DIR__ . '/esquemas.php';
require_once __DIR__ . '/repositorio.php';

/**
 * Autentica un usuario y abre su sesión. Responde con el usuario, el rol y un
 * token CSRF nuevo. Lanza 400 con datos inválidos y 401 con credenciales
 * incorrectas o cuenta desactivada.
 */
function autenticarUsuario(string $usuario, string $contrasena): array
{
    limiteIntentosLogin();

    $datos = ['usuario' => $usuario, 'contrasena' => $contrasena];
    $fallo = validar($datos, esquemasSesionUsuarios()['login']);
    if ($fallo !== []) {
        solicitudInvalida($fallo['mensaje'], $fallo);
    }

    $registro = usuarioPorNombre(strtolower(trim($usuario)));
    if ($registro === null || !password_verify($contrasena, (string) $registro['hash_contrasena'])) {
        noAutorizado('Usuario o contraseña incorrectos.');
    }
    if ((int) $registro['activo'] !== 1) {
        noAutorizado('Esta cuenta está desactivada.');
    }

    fijarUsuarioDeSesion((int) $registro['id']);
    iniciarSesion();

    registrarAuditoria('iniciar_sesion', 'usuarios', (string) $registro['id'], [
        'usuario' => (string) $registro['usuario'],
    ]);

    return [
        'ok' => true,
        'usuario' => (string) $registro['usuario'],
        'rol' => (string) $registro['rol'],
        'csrfToken' => tokenCsrf(),
    ];
}

/**
 * Cierra la sesión actual.
 */
function cerrarSesion(): void
{
    // destruirSesion() es no-op si la sesión PHP no está activa; el logout no
    // pasa por revalidarSesion(), así que hay que abrirla para poder borrarla.
    arrancarSesionPhp();
    destruirSesion();
}

/**
 * Estado de la sesión actual (para GET /auth/me). Nunca lanza.
 */
function estadoSesion(): array
{
    $usuario = usuarioActual();
    if ($usuario === null) {
        return ['autenticado' => false];
    }
    return [
        'autenticado' => true,
        'usuario' => $usuario['usuario'],
        'rol' => $usuario['rol'],
        'csrfToken' => tokenCsrf(),
    ];
}

/**
 * Lista de usuarios (solo admin).
 */
function listarUsuarios(): array
{
    exigirRol('admin');
    $items = array_map(static function (array $fila): array {
        return [
            'id' => (int) $fila['id'],
            'usuario' => (string) $fila['usuario'],
            'rol' => (string) $fila['rol'],
            'activo' => (int) $fila['activo'] === 1,
            'creado_en' => aIso((string) $fila['creado_en']),
        ];
    }, todosLosUsuarios());
    return ['items' => $items];
}

/**
 * Crea un usuario (solo admin). El nombre se valida con la expresión regular
 * `^[a-z0-9._-]{3,80}$`; la contraseña con mínimo 8 caracteres.
 */
function crearUsuario(array $datos): array
{
    exigirRol('admin');

    $fallo = validar($datos, esquemasSesionUsuarios()['usuario_nuevo']);
    if ($fallo !== []) {
        solicitudInvalida($fallo['mensaje'], $fallo);
    }

    $usuario = strtolower(trim((string) ($datos['usuario'] ?? '')));
    $contrasena = (string) ($datos['contrasena'] ?? '');
    $rol = (string) ($datos['rol'] ?? 'editor');

    if (preg_match('/^[a-z0-9._-]{3,80}$/', $usuario) !== 1) {
        solicitudInvalida('Usa un usuario de 3 a 80 caracteres (letras, números, punto o guion).', [
            'campo' => 'usuario',
        ]);
    }
    if (usuarioExiste($usuario)) {
        conflicto('Ese usuario ya existe.');
    }

    $id = insertarUsuario($usuario, password_hash($contrasena, PASSWORD_DEFAULT), $rol);
    registrarAuditoria('crear_usuario', 'usuarios', (string) $id, [
        'usuario' => $usuario,
        'rol' => $rol,
    ]);

    return [
        'ok' => true,
        'item' => ['id' => $id, 'usuario' => $usuario, 'rol' => $rol, 'activo' => true],
    ];
}

/**
 * Cambia rol, estado o contraseña de un usuario (solo admin). Un usuario no
 * puede desactivar su propia cuenta ni quitarse el rol admin.
 */
function actualizarUsuario(int $id, array $datos): array
{
    $admin = exigirRol('admin');

    $registro = usuarioPorId($id);
    if ($registro === null) {
        noEncontrado('Usuario no encontrado.');
    }

    $rol = array_key_exists('rol', $datos) ? (string) $datos['rol'] : (string) $registro['rol'];
    if (!in_array($rol, ['admin', 'editor', 'secretaria'], true)) {
        solicitudInvalida('El rol debe ser admin, editor o secretaria.', ['campo' => 'rol']);
    }
    $activo = array_key_exists('activo', $datos)
        ? (!empty($datos['activo']) ? 1 : 0)
        : (int) $registro['activo'];

    $esPropio = (int) $registro['id'] === (int) $admin['id'];
    if ($esPropio && $activo === 0) {
        solicitudInvalida('No puedes desactivar tu propia cuenta.');
    }
    if ($esPropio && $rol !== 'admin') {
        solicitudInvalida('No puedes quitarte el rol de administrador.');
    }

    $contrasena = (string) ($datos['contrasena'] ?? '');
    $hash = null;
    if ($contrasena !== '') {
        if (strlen($contrasena) < 8) {
            solicitudInvalida('La contraseña debe tener al menos 8 caracteres.', ['campo' => 'contrasena']);
        }
        $hash = password_hash($contrasena, PASSWORD_DEFAULT);
    }

    actualizarPerfilUsuario($id, $rol, $activo, $hash);
    registrarAuditoria('actualizar_usuario', 'usuarios', (string) $id, [
        'rol' => $rol,
        'activo' => $activo === 1,
    ]);

    return [
        'ok' => true,
        'item' => [
            'id' => $id,
            'usuario' => (string) $registro['usuario'],
            'rol' => $rol,
            'activo' => $activo === 1,
        ],
    ];
}

/**
 * El propio usuario cambia su contraseña. Exige la contraseña actual y
 * actualiza `contrasena_actualizada_en` para invalidar las sesiones abiertas.
 */
function cambiarContrasena(array $datos): array
{
    $usuario = exigirSesion();

    $fallo = validar($datos, esquemasSesionUsuarios()['cambio_contrasena']);
    if ($fallo !== []) {
        solicitudInvalida($fallo['mensaje'], $fallo);
    }

    $actual = (string) ($datos['contrasena_actual'] ?? '');
    $nueva = (string) ($datos['contrasena'] ?? '');

    $registro = usuarioPorId((int) $usuario['id']);
    if ($registro === null || !password_verify($actual, (string) $registro['hash_contrasena'])) {
        noAutorizado('La contraseña actual no es correcta.');
    }

    actualizarContrasenaUsuario((int) $usuario['id'], password_hash($nueva, PASSWORD_DEFAULT));
    registrarAuditoria('cambiar_contrasena', 'usuarios', (string) $usuario['id'], []);

    return ['ok' => true];
}
