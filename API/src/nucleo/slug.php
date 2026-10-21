<?php
declare(strict_types=1);

/**
 * Normalización de slug en minúsculas y sin tildes.
 * Portado de Backend/src/lib/slug.js (Perucanadiense).
 */

/**
 * Convierte texto libre en un slug apto para URL.
 * La transliteración usa strtr para no depender de iconv ni intl: así el
 * núcleo corre igual en el hosting (cPanel) y en cualquier CLI de pruebas.
 * El tope de 80 caracteres coincide con la columna `slug` del esquema.
 */
function aSlug(string $texto): string
{
    $base = mb_strtolower($texto, 'UTF-8');
    $base = strtr($base, [
        'á' => 'a', 'à' => 'a', 'â' => 'a', 'ã' => 'a', 'ä' => 'a', 'å' => 'a',
        'é' => 'e', 'è' => 'e', 'ê' => 'e', 'ë' => 'e',
        'í' => 'i', 'ì' => 'i', 'î' => 'i', 'ï' => 'i',
        'ó' => 'o', 'ò' => 'o', 'ô' => 'o', 'õ' => 'o', 'ö' => 'o', 'ø' => 'o',
        'ú' => 'u', 'ù' => 'u', 'û' => 'u', 'ü' => 'u',
        'ñ' => 'n', 'ç' => 'c', 'ý' => 'y', 'ÿ' => 'y',
        'æ' => 'ae', 'œ' => 'oe', 'ß' => 'ss',
        'ā' => 'a', 'ē' => 'e', 'ī' => 'i', 'ō' => 'o', 'ū' => 'u',
        'š' => 's', 'ž' => 'z', 'č' => 'c', 'ć' => 'c', 'ł' => 'l',
    ]);
    $base = preg_replace('/[^a-z0-9]+/', '-', $base);
    $base = trim($base, '-');
    $base = substr($base, 0, 80);
    return $base === '' ? 'pagina' : $base;
}
