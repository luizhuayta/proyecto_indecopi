<?php
declare(strict_types=1);

/**
 * Pruebas del núcleo. Todas puras: no requieren base de datos.
 */

probar('slug normaliza acentos y signos', function () {
    afirmar(aSlug('Ángel Pérez-Chávez') === 'angel-perez-chavez', 'slug esperado angel-perez-chavez');
});

probar('slug de texto vacío devuelve pagina', function () {
    afirmar(aSlug('   ') === 'pagina', 'slug de vacío debe ser pagina');
});

probar('el slug no deja mayusculas', function () {
    $slug = aSlug('TÍTULO General');
    afirmar($slug === strtolower($slug), 'el slug debe ir en minúsculas');
    afirmar($slug === 'titulo-general', 'slug esperado titulo-general');
});

probar('codigo de seguimiento tiene prefijo y cuerpo aleatorio', function () {
    $codigo = generarCodigo('MDP');
    afirmar(str_starts_with($codigo, 'MDP-'), 'debe empezar con MDP-');
    afirmar(strlen($codigo) === 3 + 1 + 12, 'longitud 16: ' . $codigo);
    afirmar(generarCodigo('MDP') !== generarCodigo('MDP'), 'dos códigos no coinciden');
});

probar('el codigo no usa caracteres ambiguos', function () {
    $codigo = generarCodigo('MDP');
    foreach (['0', 'O', '1', 'I', 'l'] as $caracter) {
        afirmar(!str_contains($codigo, $caracter), 'no debe contener el carácter ' . $caracter);
    }
});

probar('la fecha ISO sale en UTC', function () {
    afirmar(aIso('2026-03-04 05:06:07') === '2026-03-04T05:06:07+00:00', 'iso inesperado');
});

probar('la fecha corta se conserva', function () {
    afirmar(aFechaCorta('2026-03-04') === '2026-03-04', 'debe conservar la fecha corta');
});

probar('la validacion devuelve el campo que falla', function () {
    $err = validar(['correo' => 'no-es-correo'], ['correo' => ['requerido', 'correo']]);
    afirmar(($err['campo'] ?? '') === 'correo', 'campo esperado correo');
});

probar('la validacion acepta un correo valido', function () {
    afirmar(validar(['correo' => 'a@b.test'], ['correo' => ['requerido', 'correo']]) === [], 'debía pasar');
});

probar('el color invalido se rechaza', function () {
    afirmar(validar(['color' => 'rojo'], ['color' => ['color']]) !== [], 'el color rojo debía fallar');
});

probar('el enum rechaza un valor no permitido', function () {
    afirmar(validar(['rol' => 'super'], ['rol' => ['enum', ['admin', 'editor']]]) !== [], 'el rol super debía fallar');
});

probar('el color valido se acepta', function () {
    afirmar(validar(['color' => '#A1b2C3'], ['color' => ['color']]) === [], 'el color #A1b2C3 debía pasar');
});
