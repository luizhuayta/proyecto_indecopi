<?php
declare(strict_types=1);

/**
 * Esquemas de validación del módulo de páginas.
 */

/**
 * Devuelve los esquemas de validación del módulo.
 */
function esquemasPaginas(): array
{
    return [
        'crear' => [
            'titulo' => ['requerido', 'longitud_max', 160],
            'slug' => ['slug'],
            'ruta' => ['texto'],
            'mostrar_en_menu' => ['booleano'],
            'plantilla' => ['texto'],
        ],
        'guardar' => [
            'contenido' => ['requerido', 'json'],
            'version' => ['requerido', 'entero'],
        ],
        'meta' => [
            'titulo' => ['texto', 'longitud_max', 160],
            'slug' => ['slug'],
            'ruta' => ['texto'],
            'mostrar_en_menu' => ['booleano'],
            'orden_menu' => ['entero'],
        ],
    ];
}
