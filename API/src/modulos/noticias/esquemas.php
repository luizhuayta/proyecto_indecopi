<?php
declare(strict_types=1);

/**
 * Esquemas de validación del módulo de noticias.
 */

/**
 * Reglas de validación de una noticia o comunicado.
 *
 * Solo el título es obligatorio: un comunicado puede ser solo una frase.
 * El resto se normaliza en el servicio (slug derivado del título, imagen
 * con protocolo permitido, fecha en formato MySQL).
 */
function esquemasNoticia(): array
{
    return [
        'noticia' => [
            'titulo' => ['requerido', 'texto', ['longitud_max', 200]],
            'slug' => ['texto', ['longitud_max', 120]],
            'tipo' => [['enum', ['noticia', 'comunicado']]],
            'categoria' => ['texto', ['longitud_max', 60]],
            'resumen' => ['texto', ['longitud_max', 400]],
            'cuerpo' => ['texto', ['longitud_max', 200000]],
            'imagen_url' => ['texto', ['longitud_max', 500]],
            'imagen_alt' => ['texto', ['longitud_max', 200]],
            'destacada' => ['booleano'],
            'estado' => [['enum', ['borrador', 'publicado']]],
            'publicado_en' => ['texto', ['longitud_max', 25]],
        ],
    ];
}
