<?php
declare(strict_types=1);

/**
 * Lógica de mensajes: alta desde el sitio público, bandeja del panel y
 * respuesta. El mensaje se guarda antes que cualquier otro efecto: perder el
 * contacto de una persona es peor que no avisar. Por eso el aviso por correo
 * (SMTP) se envía después de guardar y su fallo no cambia la respuesta.
 */

require_once __DIR__ . '/../../nucleo/base_datos.php';
require_once __DIR__ . '/../../nucleo/sesion.php';
require_once __DIR__ . '/../../nucleo/validacion.php';
require_once __DIR__ . '/../../nucleo/codigos.php';
require_once __DIR__ . '/../../nucleo/json.php';
require_once __DIR__ . '/../../nucleo/auditoria.php';
require_once __DIR__ . '/../../nucleo/fechas.php';
require_once __DIR__ . '/../../nucleo/correo.php';
require_once __DIR__ . '/../identidad/servicio.php';
require_once __DIR__ . '/../../http/errores.php';
require_once __DIR__ . '/esquemas.php';
require_once __DIR__ . '/repositorio.php';

/**
 * Tipos de mensaje admitidos. `tramite` es la mesa de partes virtual y
 * `accesibilidad` son los reportes de barreras que envía el visitante desde
 * el panel de ajustes de lectura.
 */
const TIPOS_MENSAJE = ['contacto', 'reclamo', 'sugerencia', 'tramite', 'accesibilidad'];

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

    $esquema = esquemasMensaje()['mensaje'];
    // En un reporte de accesibilidad el correo es opcional: la barrera que se
    // describe importa aunque la persona no quiera dejar su dirección. Si lo
    // escribe, se valida igual que en los demás tipos.
    if ($tipo === 'accesibilidad') {
        $esquema['correo'] = ['correo', ['longitud_max', 160]];
    }
    $fallo = validar($datos, $esquema);
    if ($fallo !== []) {
        solicitudInvalida($fallo['mensaje'], $fallo);
    }

    if ($tipo === 'reclamo' && empty($datos['consentimiento'])) {
        solicitudInvalida(
            'Debes autorizar el tratamiento de tus datos para registrar el reclamo.',
            ['campo' => 'consentimiento']
        );
    }

    $cuerpo = [
        'nombre' => trim((string) ($datos['nombre'] ?? '')),
        'correo' => trim((string) ($datos['correo'] ?? '')),
        'telefono' => trim((string) ($datos['telefono'] ?? '')),
        'documento' => trim((string) ($datos['documento'] ?? '')),
        'mensaje' => trim((string) ($datos['mensaje'] ?? '')),
        'ruta' => trim((string) ($datos['ruta'] ?? '')),
        'consentimiento' => !empty($datos['consentimiento']),
    ];

    $ticket = generarCodigo('MSG');
    $id = insertarMensajeBd($tipo, trim((string) ($datos['asunto'] ?? '')), $cuerpo, $ticket);

    registrarAuditoria('crear', 'mensajes', (string) $id, ['tipo' => $tipo]);

    // Aviso a la institución: contacto, reclamo, trámite y reportes de
    // accesibilidad, y solo después de guardar. Un fallo de SMTP se registra
    // dentro de enviarCorreo() y no cambia la respuesta al visitante.
    if (smtpConfigurado() && in_array($tipo, ['contacto', 'reclamo', 'tramite', 'accesibilidad'], true)) {
        $destinatario = cabeceraLimpia((string) identidad()['correo']);
        if ($destinatario === '') {
            $destinatario = cabeceraLimpia(configurar('SMTP_REMITENTE'));
        }
        if ($destinatario !== '') {
            $lineas = [
                'Ticket: ' . $ticket,
                'Tipo: ' . $tipo,
                'De: ' . trim($cuerpo['nombre'] . ' <' . $cuerpo['correo'] . '>'),
            ];
            if ($cuerpo['telefono'] !== '') {
                $lineas[] = 'Teléfono: ' . $cuerpo['telefono'];
            }
            if ($cuerpo['documento'] !== '') {
                $lineas[] = 'Documento: ' . $cuerpo['documento'];
            }
            $lineas[] = '';
            $lineas[] = $cuerpo['mensaje'];
            if (enviarCorreo($destinatario, 'Nuevo mensaje ' . $ticket, implode("\n", $lineas))) {
                marcarNotificadoBd($id);
            }
        }
    }

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
            'documento' => (string) ($cuerpo['documento'] ?? ''),
            'mensaje' => (string) ($cuerpo['mensaje'] ?? ''),
            'ruta' => (string) ($cuerpo['ruta'] ?? ''),
            'consentimiento' => (bool) ($cuerpo['consentimiento'] ?? false),
        ];
    }
    return $mensajes;
}

/**
 * Responde un mensaje: guarda la respuesta y lo pasa a 'respondido'.
 */
function responderMensaje(int $id, string $respuesta, bool $notificar): array
{
    exigirRol('editor', 'admin', 'secretaria');

    $fila = mensajePorIdBd($id);
    if ($fila === null) {
        noEncontrado('El mensaje no existe.');
    }
    $respuesta = trim($respuesta);
    if ($respuesta === '') {
        solicitudInvalida('La respuesta no puede estar vacía.', ['campo' => 'respuesta']);
    }

    // El aviso al visitante se envía antes de marcar: `notificado` refleja el
    // resultado real del envío, no lo que se pidió.
    $notificado = false;
    if ($notificar && smtpConfigurado()) {
        $cuerpoOriginal = decodificarJson($fila['cuerpo'] ?? null);
        $destino = cabeceraLimpia((string) ($cuerpoOriginal['correo'] ?? ''));
        if ($destino !== '') {
            $notificado = enviarCorreo(
                $destino,
                'Respuesta a tu mensaje ' . (string) ($fila['ticket'] ?? ''),
                $respuesta
            );
        }
    }

    actualizarMensajeBd($id, 'respondido', $respuesta, $notificado);
    registrarAuditoria('responder', 'mensajes', (string) $id, ['notificado' => $notificado]);

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

/**
 * Archiva un mensaje: lo saca del flujo de la bandeja sin borrarlo ni
 * perder la respuesta guardada.
 */
function archivarMensaje(int $id): array
{
    exigirRol('editor', 'admin', 'secretaria');

    if (mensajePorIdBd($id) === null) {
        noEncontrado('El mensaje no existe.');
    }

    cambiarEstadoMensajeBd($id, 'archivado');
    registrarAuditoria('archivar', 'mensajes', (string) $id, []);

    return ['id' => $id, 'estado' => 'archivado'];
}
