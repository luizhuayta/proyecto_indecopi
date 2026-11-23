<?php
declare(strict_types=1);

/**
 * Esquemas de validación del módulo de identidad y apariencia.
 */

/**
 * Devuelve los esquemas de validación del módulo.
 */
function esquemasIdentidad(): array
{
    return [
        'identidad' => [
            'nombre' => ['texto', 'longitud_max', 190],
            'ruc' => ['texto', 'longitud_max', 20],
            'direccion' => ['texto', 'longitud_max', 255],
            'telefono' => ['texto', 'longitud_max', 40],
            'correo' => ['correo'],
            'ciudad' => ['texto', 'longitud_max', 120],
        ],
        'apariencia' => [
            'color_primario' => ['color'],
            'color_primario_fuerte' => ['color'],
            'color_secundario' => ['color'],
            'color_acento' => ['color'],
            'color_texto' => ['color'],
            'color_texto_suave' => ['color'],
            'color_fondo' => ['color'],
            'color_superficie' => ['color'],
            'color_borde' => ['color'],
            'tipografia_titulos' => ['texto'],
            'tipografia_cuerpo' => ['texto'],
            'logo_url' => ['texto'],
            'logo_alt' => ['texto'],
            'favicon_url' => ['texto'],
            'pie_legal' => ['texto'],
            'correo_contacto' => ['correo'],
            'telefono_contacto' => ['texto'],
            'redes' => ['json'],
            'accesos' => ['json'],
            'botones_cabecera' => ['json'],
            'whatsapp' => ['texto', 'longitud_max', 15],
        ],
    ];
}
