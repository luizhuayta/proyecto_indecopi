<?php
declare(strict_types=1);

/**
 * Acceso a la tabla `mensajes`. Todo el SQL del módulo vive aquí.
 */

require_once __DIR__ . '/../../nucleo/base_datos.php';

/**
 * Inserta un mensaje y devuelve su id.
 */
function insertarMensajeBd(string $tipo, string $asunto, array $cuerpo, string $ticket): int
{
    $stmt = conexion()->prepare(
        'INSERT INTO mensajes (tipo, asunto, cuerpo, ticket, estado) VALUES (?, ?, ?, ?, ?)'
    );
    $stmt->execute([
        $tipo,
        $asunto,
        json_encode($cuerpo, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        $ticket,
        'pendiente',
    ]);
    return (int) conexion()->lastInsertId();
}

/**
 * Mensajes filtrados por tipo y estado, del más reciente al más antiguo.
 */
function mensajesFiltradosBd(?string $tipo, ?string $estado): array
{
    $condiciones = ['1 = 1'];
    $parametros = [];
    if ($tipo !== null) {
        $condiciones[] = 'tipo = ?';
        $parametros[] = $tipo;
    }
    if ($estado !== null) {
        $condiciones[] = 'estado = ?';
        $parametros[] = $estado;
    }
    $stmt = conexion()->prepare(
        'SELECT id, tipo, asunto, cuerpo, ticket, estado, respuesta, notificado, creado_en
           FROM mensajes WHERE ' . implode(' AND ', $condiciones) . ' ORDER BY id DESC LIMIT 200'
    );
    $stmt->execute($parametros);
    return $stmt->fetchAll();
}

/**
 * Mensaje por id, o null.
 */
function mensajePorIdBd(int $id): ?array
{
    $stmt = conexion()->prepare(
        'SELECT id, tipo, asunto, cuerpo, ticket, estado, respuesta, notificado, creado_en
           FROM mensajes WHERE id = ? LIMIT 1'
    );
    $stmt->execute([$id]);
    $fila = $stmt->fetch();
    return $fila === false ? null : $fila;
}

/**
 * Guarda la respuesta, el estado y si se notificó.
 */
function actualizarMensajeBd(int $id, string $estado, string $respuesta, bool $notificado): void
{
    $stmt = conexion()->prepare(
        'UPDATE mensajes SET estado = ?, respuesta = ?, notificado = ? WHERE id = ?'
    );
    $stmt->execute([$estado, $respuesta, $notificado ? 1 : 0, $id]);
}
