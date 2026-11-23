<?php
declare(strict_types=1);

require_once __DIR__ . '/../src/modulos/identidad/servicio.php';

/** Mensaje del error 400 de validarApariencia, o null si aceptó el contenido. */
function falloApariencia(array $contenido): ?string
{
    try {
        validarApariencia($contenido);
        return null;
    } catch (ErrorApp $e) {
        return $e->getMessage();
    }
}

probar('la apariencia acepta accesos, botones de cabecera y whatsapp validos', function () {
    $fallo = falloApariencia([
        'accesos' => [['nombre' => 'Aula virtual', 'url' => 'https://aula.test', 'icono' => 'plataforma']],
        'botones_cabecera' => [
            ['texto' => 'Admisión', 'url' => '/admision', 'estilo' => 'principal'],
            ['texto' => 'Transparencia', 'url' => '/transparencia', 'estilo' => 'contorno'],
        ],
        'whatsapp' => '51938146082',
    ]);
    afirmar($fallo === null, 'debe aceptar la apariencia valida: ' . (string) $fallo);
});

probar('la cabecera admite como maximo dos botones', function () {
    $boton = ['texto' => 'Ir', 'url' => '/x', 'estilo' => 'principal'];
    afirmar(falloApariencia(['botones_cabecera' => [$boton, $boton, $boton]]) !== null, 'tres botones deben rechazarse');
});

probar('un boton de cabecera con estilo desconocido se rechaza', function () {
    afirmar(falloApariencia(['botones_cabecera' => [['texto' => 'Ir', 'url' => '/x', 'estilo' => 'neon']]]) !== null, 'estilo invalido');
});

probar('la franja admite como maximo seis accesos y cada uno debe ser objeto', function () {
    $acceso = ['nombre' => 'A', 'url' => '/a'];
    afirmar(falloApariencia(['accesos' => array_fill(0, 7, $acceso)]) !== null, 'siete accesos deben rechazarse');
    afirmar(falloApariencia(['accesos' => ['texto suelto']]) !== null, 'un acceso no objeto debe rechazarse');
});

probar('el whatsapp solo admite de 8 a 15 digitos', function () {
    afirmar(falloApariencia(['whatsapp' => '+51 938 146 082']) !== null, 'simbolos y espacios deben rechazarse');
    afirmar(falloApariencia(['whatsapp' => '1234']) !== null, 'muy corto');
    afirmar(falloApariencia(['whatsapp' => '']) === null, 'vacio significa sin boton');
});
