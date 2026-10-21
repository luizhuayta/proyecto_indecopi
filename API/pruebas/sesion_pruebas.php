<?php
declare(strict_types=1);

/**
 * Pruebas de sesión, usuarios, roles y auditoría.
 * Requieren base de datos; se omiten si la conexión no está disponible.
 */

require_once __DIR__ . '/../src/nucleo/sesion.php';
require_once __DIR__ . '/../src/nucleo/csr.php';
require_once __DIR__ . '/../src/nucleo/auditoria.php';
require_once __DIR__ . '/../src/modulos/sesion_usuarios/servicio.php';

/**
 * Contraseña por defecto de los usuarios de prueba.
 */
function contrasenaPrueba(): string
{
    return 'ClavePrueba123';
}

/**
 * Crea un usuario de prueba y devuelve su id. Borra antes cualquier usuario
 * con el mismo nombre para que las ejecuciones repetidas no colisionen.
 */
function crear_usuario_de_prueba(string $usuario, string $rol, bool $activo = true): int
{
    $pdo = conexion();
    $pdo->prepare('DELETE FROM usuarios WHERE usuario = ?')->execute([$usuario]);
    $stmt = $pdo->prepare(
        'INSERT INTO usuarios (usuario, hash_contrasena, rol, activo) VALUES (?, ?, ?, ?)'
    );
    $stmt->execute([
        $usuario,
        password_hash(contrasenaPrueba(), PASSWORD_DEFAULT),
        $rol,
        $activo ? 1 : 0,
    ]);
    return (int) $pdo->lastInsertId();
}

probar('la sesion se invalida cuando se desactiva la cuenta', function () {
    $id = crear_usuario_de_prueba('desactivo1', 'admin');
    fijarSesionDePrueba($id);
    conexion()->prepare('UPDATE usuarios SET activo = 0 WHERE id = ?')->execute([$id]);
    intentar(function () {
        exigirSesion();
    });
    afirmar(error_ultimo_codigo() === 401, 'debe responder 401');
});

probar('la sesion se invalida cuando cambia la contrasena', function () {
    $id = crear_usuario_de_prueba('cambiaclave1', 'admin');
    fijarSesionDePrueba($id);
    // Cambia la contraseña de verdad: sube el contador de credenciales.
    actualizarContrasenaUsuario($id, password_hash('OtraClave123', PASSWORD_DEFAULT));
    intentar(function () {
        exigirSesion();
    });
    afirmar(error_ultimo_codigo() === 401, 'debe responder 401');
});

probar('la sesion se invalida aunque la contrasena cambie dos veces en el mismo segundo', function () {
    $id = crear_usuario_de_prueba('mismo segundo1', 'admin');
    fijarSesionDePrueba($id);
    // Dos cambios de contraseña seguidos: la marca de tiempo no distinguiría
    // los dos, pero el contador de credenciales sí.
    actualizarContrasenaUsuario($id, password_hash('ClaveSegunda123', PASSWORD_DEFAULT));
    actualizarContrasenaUsuario($id, password_hash('ClaveTercera123', PASSWORD_DEFAULT));
    intentar(function () {
        exigirSesion();
    });
    afirmar(error_ultimo_codigo() === 401, 'debe responder 401');
});

probar('la sesion sobrevive si no cambian las credenciales', function () {
    $id = crear_usuario_de_prueba('sigueviva1', 'admin');
    fijarSesionDePrueba($id);
    $usuario = exigirSesion();
    afirmar((int) $usuario['id'] === $id, 'la sesion debe seguir valida');
});

probar('el rol se lee de la base y no de la sesion', function () {
    $id = crear_usuario_de_prueba('rolbase1', 'editor');
    fijarSesionDePrueba($id);
    // Aunque una sesión obsoleta dijese 'admin', exigirRol consulta la base.
    intentar(function () {
        exigirRol('admin');
    });
    afirmar(error_ultimo_codigo() === 403, 'debe responder 403');
});

probar('la auditoria no guarda el cuerpo del mensaje', function () {
    $id = crear_usuario_de_prueba('audit1', 'admin');
    fijarSesionDePrueba($id);
    registrarAuditoria('crear', 'mensajes', '7', ['cuerpo' => 'dni 12345678']);
    $fila = conexion()->query('SELECT datos FROM auditoria ORDER BY id DESC LIMIT 1')->fetch();
    afirmar($fila !== false, 'debe haber una fila de auditoria');
    $json = (string) ($fila['datos'] ?? '');
    afirmar(!str_contains($json, '12345678'), 'no debe guardar datos personales');
});

probar('el rol editor no puede crear usuarios', function () {
    $id = crear_usuario_de_prueba('editornoadmin1', 'editor');
    fijarSesionDePrueba($id);
    intentar(function () {
        exigirRol('admin');
    });
    afirmar(error_ultimo_codigo() === 403, 'debe responder 403');
});

probar('el login con contrasena incorrecta responde 401', function () {
    crear_usuario_de_prueba('loginmalo1', 'admin');
    intentar(function () {
        autenticarUsuario('loginmalo1', 'ClaveIncorrecta9');
    });
    afirmar(error_ultimo_codigo() === 401, 'debe responder 401');
});

probar('el hash de la contrasena no es el texto plano', function () {
    $id = crear_usuario_de_prueba('hash1', 'admin');
    $stmt = conexion()->prepare('SELECT hash_contrasena FROM usuarios WHERE id = ?');
    $stmt->execute([$id]);
    $fila = $stmt->fetch();
    afirmar($fila !== false, 'debe existir el usuario');
    $hash = (string) $fila['hash_contrasena'];
    afirmar(!str_starts_with($hash, contrasenaPrueba()), 'el hash no debe empezar por la contraseña');
    afirmar(password_verify(contrasenaPrueba(), $hash) === true, 'password_verify debe dar true');
});

probar('un usuario no puede desactivar su propia cuenta', function () {
    $id = crear_usuario_de_prueba('noadesactiva1', 'admin');
    fijarSesionDePrueba($id);
    intentar(function () use ($id) {
        actualizarUsuario($id, ['activo' => false]);
    });
    afirmar(error_ultimo_codigo() === 400, 'debe responder 400');
});
