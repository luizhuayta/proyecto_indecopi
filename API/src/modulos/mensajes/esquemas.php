<?php
declare(strict_types=1);

/**
 * Esquemas de validación del módulo de mensajes.
 */

/**
 * Reglas de validación por tipo de mensaje.
 *
 * El formulario decide qué campos muestra la institución, así que solo el
 * correo y el mensaje son obligatorios: si la institución oculta el nombre o
 * el asunto, el mensaje se guarda igual. Excepción: en los reportes de
 * accesibilidad el correo es opcional (lo decide `crearMensaje`, que ajusta
 * la regla de `correo` para ese tipo).
 */
function esquemasMensaje(): array
{
    return [
        'mensaje' => [
            'nombre' => ['texto', ['longitud_max', 120]],
            'correo' => ['requerido', 'correo', ['longitud_max', 160]],
            'asunto' => ['texto', ['longitud_max', 200]],
            'mensaje' => ['requerido', 'texto', ['longitud_max', 4000]],
            'telefono' => ['texto', ['longitud_max', 40]],
            'documento' => ['texto', ['longitud_max', 20]],
            'consentimiento' => ['booleano'],
            'ruta' => ['texto', ['longitud_max', 200]],
        ],
    ];
}
