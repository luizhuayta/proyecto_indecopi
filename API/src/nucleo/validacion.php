<?php
declare(strict_types=1);

/**
 * Validación de entrada por esquemas.
 * Portado de Backend/src/middlewares/validar.js (Perucanadiense).
 *
 * $esquemas es un mapa `campo => lista de reglas`. Cada regla es una cadena
 * ('requerido', 'correo', ...) o un par [regla, parámetro] ('enum',
 * 'longitud_max', 'longitud_min' y 'una_de' llevan parámetro).
 *
 * validar() devuelve [] si todo pasa; si no, ['campo' => ..., 'mensaje' => ...]
 * con el PRIMER fallo, en el orden de los campos del esquema.
 */

/**
 * Devuelve el mensaje de error de una regla, o null si la regla pasa.
 */
function fallo_de_regla(string $regla, string $campo, mixed $valor, mixed $parametro): ?string
{
    switch ($regla) {
        case 'requerido':
            if ($valor === null || $valor === '' || $valor === []) {
                return "El campo {$campo} es obligatorio.";
            }
            return null;

        case 'texto':
            if (esta_vacio($valor)) {
                return null;
            }
            if (!is_string($valor) && !is_int($valor) && !is_float($valor)) {
                return "El campo {$campo} debe ser un texto.";
            }
            return null;

        case 'correo':
            if (esta_vacio($valor)) {
                return null;
            }
            if (!is_string($valor) || filter_var($valor, FILTER_VALIDATE_EMAIL) === false) {
                return "El campo {$campo} debe ser un correo electrónico válido.";
            }
            return null;

        case 'entero':
            if (esta_vacio($valor)) {
                return null;
            }
            if (is_int($valor)) {
                return null;
            }
            if (is_string($valor) && preg_match('/^[+-]?\d+$/', $valor) === 1) {
                return null;
            }
            return "El campo {$campo} debe ser un número entero.";

        case 'decimal':
            if (esta_vacio($valor)) {
                return null;
            }
            if (is_int($valor) || is_float($valor)) {
                return null;
            }
            if (is_string($valor) && preg_match('/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/', $valor) === 1) {
                return null;
            }
            return "El campo {$campo} debe ser un número decimal.";

        case 'booleano':
            if (esta_vacio($valor)) {
                return null;
            }
            if (!is_bool($valor)) {
                return "El campo {$campo} debe ser verdadero o falso.";
            }
            return null;

        case 'enum':
            if (esta_vacio($valor)) {
                return null;
            }
            if (!is_array($parametro) || !in_array($valor, $parametro, true)) {
                $permitidos = is_array($parametro) ? implode(', ', array_map('strval', $parametro)) : '';
                return "El campo {$campo} debe ser uno de: {$permitidos}.";
            }
            return null;

        case 'longitud_max':
            if (esta_vacio($valor)) {
                return null;
            }
            if (is_string($valor) && is_int($parametro) && mb_strlen($valor, 'UTF-8') > $parametro) {
                return "El campo {$campo} no debe superar {$parametro} caracteres.";
            }
            return null;

        case 'longitud_min':
            if (esta_vacio($valor)) {
                return null;
            }
            if (is_string($valor) && is_int($parametro) && mb_strlen($valor, 'UTF-8') < $parametro) {
                return "El campo {$campo} debe tener al menos {$parametro} caracteres.";
            }
            return null;

        case 'slug':
            if (esta_vacio($valor)) {
                return null;
            }
            if (
                !is_string($valor)
                || preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/', $valor) !== 1
                || strlen($valor) < 2
                || strlen($valor) > 80
            ) {
                return "El campo {$campo} debe ser un slug válido.";
            }
            return null;

        case 'url':
            if (esta_vacio($valor)) {
                return null;
            }
            if (!is_string($valor) || filter_var($valor, FILTER_VALIDATE_URL) === false) {
                return "El campo {$campo} debe ser una URL válida.";
            }
            return null;

        case 'color':
            if (esta_vacio($valor)) {
                return null;
            }
            if (!is_string($valor) || preg_match('/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/', $valor) !== 1) {
                return "El campo {$campo} debe ser un color #RGB o #RRGGBB.";
            }
            return null;

        case 'json':
            if (esta_vacio($valor)) {
                return null;
            }
            if (is_array($valor) || is_object($valor)) {
                return null;
            }
            if (is_string($valor)) {
                json_decode($valor);
                if (json_last_error() === JSON_ERROR_NONE) {
                    return null;
                }
            }
            return "El campo {$campo} debe ser un JSON válido.";

        case 'una_de':
            if (esta_vacio($valor)) {
                return null;
            }
            if (!is_array($valor) || !is_array($parametro)) {
                return "El campo {$campo} debe incluir una de las claves esperadas.";
            }
            $presentes = 0;
            foreach ($parametro as $clave) {
                if (array_key_exists($clave, $valor)) {
                    $presentes++;
                }
            }
            if ($presentes !== 1) {
                $claves = implode(', ', array_map('strval', $parametro));
                return "El campo {$campo} debe incluir exactamente una de: {$claves}.";
            }
            return null;

        default:
            return null;
    }
}

/**
 * Aplica las reglas de un campo y devuelve el primer fallo, o null.
 */
function aplicar_reglas(string $campo, mixed $valor, array $reglas): ?array
{
    $total = count($reglas);
    $i = 0;
    while ($i < $total) {
        $regla = $reglas[$i];
        $parametro = null;
        if (is_array($regla) && count($regla) === 2 && is_string($regla[0])) {
            $nombre = $regla[0];
            $parametro = $regla[1];
            $i++;
        } else {
            $nombre = (string) $regla;
            $i++;
            if (in_array($nombre, ['enum', 'longitud_max', 'longitud_min', 'una_de'], true) && $i < $total) {
                $parametro = $reglas[$i];
                $i++;
            }
        }
        $mensaje = fallo_de_regla($nombre, $campo, $valor, $parametro);
        if ($mensaje !== null) {
            return ['campo' => $campo, 'mensaje' => $mensaje];
        }
    }
    return null;
}

/**
 * Un valor está vacío cuando es null, cadena vacía o array vacío.
 */
function esta_vacio(mixed $valor): bool
{
    return $valor === null || $valor === '' || $valor === [];
}

/**
 * Valida $datos contra $esquemas. Devuelve [] si todo pasa, o el primer fallo.
 */
function validar(array $datos, array $esquemas): array
{
    foreach ($esquemas as $campo => $reglas) {
        $valor = array_key_exists($campo, $datos) ? $datos[$campo] : null;
        $fallo = aplicar_reglas($campo, $valor, $reglas);
        if ($fallo !== null) {
            return $fallo;
        }
    }
    return [];
}
