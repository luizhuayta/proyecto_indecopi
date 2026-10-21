<?php
declare(strict_types=1);

/**
 * Conexión PDO y transacciones.
 * Portado de API/db.php (Matt): db().
 */

require_once __DIR__ . '/configuracion.php';

/**
 * Devuelve la conexión PDO compartida, creándola si hace falta.
 */
function conexion(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $host = configurar('DB_HOST');
    $puerto = configurar('DB_PORT');
    $nombre = configurar('DB_NAME');
    $usuario = configurar('DB_USER');
    $contrasena = configurar('DB_PASSWORD');

    $dsn = sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', $host, $puerto, $nombre);
    $reintentos = in_array($host, ['db', 'mysql', 'mariadb'], true) ? 30 : 1;
    $ultimo = null;
    for ($i = 0; $i < $reintentos; $i++) {
        try {
            $pdo = new PDO($dsn, $usuario, $contrasena, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_TIMEOUT => 5,
            ]);
            // La sesión trabaja en UTC: las fechas se convierten de forma explícita.
            $pdo->exec("SET time_zone = '+00:00'");
            // Evita que un ALTER o una fila bloqueada deje esperando a las peticiones.
            $pdo->exec('SET SESSION lock_wait_timeout = 10');
            $pdo->exec('SET SESSION innodb_lock_wait_timeout = 10');
            return $pdo;
        } catch (PDOException $e) {
            $ultimo = $e;
            if ($i < $reintentos - 1) {
                sleep(1);
            }
        }
    }
    throw $ultimo ?? new RuntimeException('No se pudo conectar a MariaDB');
}

/**
 * Ejecuta $operacion dentro de una transacción; revierte si falla.
 * Si ya hay una transacción abierta, ejecuta $operacion sin abrir otra.
 */
function enTransaccion(callable $operacion): mixed
{
    $pdo = conexion();
    if ($pdo->inTransaction()) {
        return $operacion($pdo);
    }
    $pdo->beginTransaction();
    try {
        $resultado = $operacion($pdo);
        $pdo->commit();
        return $resultado;
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }
}
