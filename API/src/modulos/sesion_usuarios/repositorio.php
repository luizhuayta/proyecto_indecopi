<?php
declare(strict_types=1);

/**
 * Acceso a la tabla `usuarios`. Todo el SQL del módulo vive aquí.
 * Consultas preparadas siempre.
 */

require_once __DIR__ . '/../../nucleo/base_datos.php';

/**
 * Usuario completo por nombre (para el login: incluye el hash y el estado).
 */
function usuarioPorNombre(string $usuario): ?array
{
    $stmt = conexion()->prepare(
        'SELECT id, usuario, hash_contrasena, rol, activo, contrasena_actualizada_en, creado_en
           FROM usuarios WHERE usuario = ? LIMIT 1'
    );
    $stmt->execute([$usuario]);
    $fila = $stmt->fetch();
    return $fila === false ? null : $fila;
}

/**
 * Usuario completo por id.
 */
function usuarioPorId(int $id): ?array
{
    $stmt = conexion()->prepare(
        'SELECT id, usuario, hash_contrasena, rol, activo, contrasena_actualizada_en, creado_en
           FROM usuarios WHERE id = ? LIMIT 1'
    );
    $stmt->execute([$id]);
    $fila = $stmt->fetch();
    return $fila === false ? null : $fila;
}

/**
 * ¿Ya existe un usuario con ese nombre?
 */
function usuarioExiste(string $usuario): bool
{
    $stmt = conexion()->prepare('SELECT id FROM usuarios WHERE usuario = ? LIMIT 1');
    $stmt->execute([$usuario]);
    return $stmt->fetch() !== false;
}

/**
 * Todos los usuarios (sin el hash de contraseña).
 */
function todosLosUsuarios(): array
{
    return conexion()->query(
        'SELECT id, usuario, rol, activo, creado_en FROM usuarios ORDER BY id'
    )->fetchAll();
}

/**
 * Crea un usuario y devuelve su id.
 */
function insertarUsuario(string $usuario, string $hash, string $rol): int
{
    $stmt = conexion()->prepare(
        'INSERT INTO usuarios (usuario, hash_contrasena, rol, activo) VALUES (?, ?, ?, 1)'
    );
    $stmt->execute([$usuario, $hash, $rol]);
    return (int) conexion()->lastInsertId();
}

/**
 * Actualiza rol y estado. Si viene un hash nuevo, también cambia la contraseña
 * e invalida las sesiones (contrasena_actualizada_en = UTC_TIMESTAMP()).
 */
function actualizarPerfilUsuario(int $id, string $rol, int $activo, ?string $hash): void
{
    if ($hash !== null) {
        $stmt = conexion()->prepare(
            'UPDATE usuarios
                SET rol = ?, activo = ?, hash_contrasena = ?, contrasena_actualizada_en = UTC_TIMESTAMP()
              WHERE id = ?'
        );
        $stmt->execute([$rol, $activo, $hash, $id]);
        return;
    }
    $stmt = conexion()->prepare('UPDATE usuarios SET rol = ?, activo = ? WHERE id = ?');
    $stmt->execute([$rol, $activo, $id]);
}

/**
 * Cambia la contraseña de un usuario e invalida sus sesiones.
 */
function actualizarContrasenaUsuario(int $id, string $hash): void
{
    $stmt = conexion()->prepare(
        'UPDATE usuarios
            SET hash_contrasena = ?, contrasena_actualizada_en = UTC_TIMESTAMP()
          WHERE id = ?'
    );
    $stmt->execute([$hash, $id]);
}
