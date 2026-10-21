<?php
declare(strict_types=1);

/**
 * Esquemas de validación del módulo de medios.
 */

/**
 * Devuelve los esquemas de validación del módulo.
 */
function esquemasMedios(): array
{
    return [
        'recorte' => [
            'url' => ['requerido', 'texto'],
            'x' => ['requerido', 'entero'],
            'y' => ['requerido', 'entero'],
            'w' => ['requerido', 'entero'],
            'h' => ['requerido', 'entero'],
        ],
    ];
}
