<?php
declare(strict_types=1);

/**
 * Auditoría sin datos personales.
 * Portado de Backend/src/lib/auditoria.js (Perucanadiense): registrar().
 *
 * Guarda acción, entidad, identificador, usuario y un resumen JSON no
 * sensible. Nunca guarda el cuerpo del mensaje ni valores de claves sensibles.
 * Nunca interrumpe la operación principal: cualquier fallo se registra en el
 * log y se ignora.
 */

require_once __DIR__ . '/base_datos.php';
require_once __DIR__ . '/sesion.php';

/**
 * Claves cuyo valor nunca debe guardarse en la auditoría.
 */
function clavesSensiblesAuditoria(): array
{
    return ['cuerpo', 'mensaje', 'dni', 'correo', 'telefono', 'documento', 'adjunto', 'contrasena', 'clave', 'token'];
}

/**
 * Recorre $datos y reemplaza por '[omitido]' el valor de toda clave sensible,
 * también en estructuras anidadas.
 */
function sanearDatosAuditoria(array $datos): array
{
    $sensibles = clavesSensiblesAuditoria();
    $salida = [];
    foreach ($datos as $clave => $valor) {
        $claveNorm = strtolower((string) $clave);
        if (in_array($claveNorm, $sensibles, true)) {
            $salida[$clave] = '[omitido]';
            continue;
        }
        $salida[$clave] = is_array($valor) ? sanearDatosAuditoria($valor) : $valor;
    }
    return $salida;
}

/**
 * Deja constancia de una acción. El usuario se deduce de la identidad de la
 * sesión actual (ya validada al inicio de la petición), sin revalidar: así el
 * registro no pierde al autor cuando la propia acción —por ejemplo, cambiar la
 * contraseña— invalida la sesión a mitad de petición.
 */
function registrarAuditoria(string $accion, string $entidad, ?string $entidadId, array $datos = []): void
{
    try {
        $sesion = sesionEnMemoria();
        $idSesion = (int) ($sesion['usuario_id'] ?? 0);
        $usuarioId = $idSesion > 0 ? $idSesion : null;
        $saneado = sanearDatosAuditoria($datos);
        $stmt = conexion()->prepare(
            'INSERT INTO auditoria (accion, entidad, entidad_id, usuario_id, datos)
             VALUES (?, ?, ?, ?, ?)'
        );
        $stmt->execute([
            $accion,
            $entidad,
            $entidadId,
            $usuarioId,
            json_encode($saneado, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        ]);
    } catch (Throwable $e) {
        error_log('[auditoria] no se pudo registrar: ' . $e->getMessage());
    }
}
