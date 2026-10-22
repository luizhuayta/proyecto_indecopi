<?php
declare(strict_types=1);

/**
 * Lógica de mensajes: alta desde el sitio público, bandeja del panel y
 * respuesta. Un mensaje se guarda aunque el aviso por correo falle: perder el
 * contacto de una persona es peor que no avisar.
 */

require_once __DIR__ . '/../../nucleo/base_datos.php';
require_once __DIR__ . '/../../nucleo/sesion.php';
require_once __DIR__ . '/../../nucleo/validacion.php';
require_once __DIR__ . '/../../nucleo/codigos.php';
require_once __DIR__ . '/../../nucleo/json.php';
require_once __DIR__ . '/../../nucleo/auditoria.php';
require_once __DIR__ . '/../../nucleo/fechas.php';
require_once __DIR__ . '/../../http/errores.php';
require_once __DIR__ . '/esquemas.php';
require_once __DIR__ . '/repositorio.php';

/** Tipos de mensaje admitidos. */
const TIPOS_MENSAJE = ['contacto', 'reclamo', 'sugerencia'];

/** Estados de un mensaje. */
const ESTADOS_MENSAJE = ['pendiente', 'respondido', 'archivado'];

/**
 * Crea un mensaje y devuelve su ticket. `tipo` es el formulario de origen.
 */
function crearMensaje(array $datos, string $tipo): array
{
    if (!in_array($tipo, TIPOS_MENSAJE, true)) {
        $tipo = 'contacto';
    }

    $fallo = validar($datos, esquemasMensaje()['mensaje']);
    if ($fallo !== []) {
        solicitudInvalida($fallo['mensaje'], $fallo);
    }

    $cuerpo = [
        'nombre' => trim((string) $datos['nombre']),
        'correo' => trim((string) $datos['correo']),
        'telefono' => trim((string) ($datos['telefono'] ?? '')),
        'mensaje' => trim((string) $datos['mensaje']),
        'ruta' => trim((string) ($datos['ruta'] ?? '')),
    ];

    $ticket = generarCodigo('MSG');
    $id = insertarMensajeBd($tipo, trim((string) $datos['asunto']), $cuerpo, $ticket);

    registrarAuditoria('crear', 'mensajes', (string) $id, ['tipo' => $tipo]);

    return [
        'id' => $id,
        'ticket' => $ticket,
        'tipo' => $tipo,
        'estado' => 'pendiente',
        'creado_en' => aIso(null),
    ];
}

/**
 * Bandeja de mensajes del panel. Exige sesión. Admite filtros por tipo y
 * estado.
 */
function listarMensajes(array $filtros): array
{
    exigirSesion();

    $tipo = isset($filtros['tipo']) && in_array($filtros['tipo'], TIPOS_MENSAJE, true) ? (string) $filtros['tipo'] : null;
    $estado = isset($filtros['estado']) && in_array($filtros['estado'], ESTADOS_MENSAJE, true) ? (string) $filtros['estado'] : null;

    $filas = mensajesFiltradosBd($tipo, $estado);
    $mensajes = [];
    foreach ($filas as $fila) {
        $cuerpo = decodificarJson($fila['cuerpo'] ?? null);
        $mensajes[] = [
            'id' => (int) $fila['id'],
            'tipo' => (string) $fila['tipo'],
            'asunto' => (string) $fila['asunto'],
            'ticket' => (string) ($fila['ticket'] ?? ''),
            'estado' => (string) $fila['estado'],
            'respuesta' => (string) ($fila['respuesta'] ?? ''),
            'notificado' => (int) ($fila['notificado'] ?? 0) === 1,
            'creado_en' => aIso(isset($fila['creado_en']) ? (string) $fila['creado_en'] : null),
            'nombre' => (string) ($cuerpo['nombre'] ?? ''),
            'correo' => (string) ($cuerpo['correo'] ?? ''),
            'telefono' => (string) ($cuerpo['telefono'] ?? ''),
            'mensaje' => (string) ($cuerpo['mensaje'] ?? ''),
        ];
    }
    return $mensajes;
}

/**
 * Responde un mensaje: guarda la respuesta y lo pasa a 'respondido'.
 */
function responderMensaje(int $id, string $respuesta, bool $notificar): array
{
    exigirRol('editor', 'admin');

    $fila = mensajePorIdBd($id);
    if ($fila === null) {
        noEncontrado('El mensaje no existe.');
    }
    $respuesta = trim($respuesta);
    if ($respuesta === '') {
        solicitudInvalida('La respuesta no puede estar vacía.', ['campo' => 'respuesta']);
    }

    actualizarMensajeBd($id, 'respondido', $respuesta, $notificar);
    registrarAuditoria('responder', 'mensajes', (string) $id, ['notificado' => $notificar]);

    $actualizado = mensajePorIdBd($id);
    $cuerpo = decodificarJson($actualizado['cuerpo'] ?? null);
    return [
        'id' => $id,
        'estado' => (string) $actualizado['estado'],
        'respuesta' => (string) ($actualizado['respuesta'] ?? ''),
        'notificado' => (int) ($actualizado['notificado'] ?? 0) === 1,
        'correo' => (string) ($cuerpo['correo'] ?? ''),
    ];
}
