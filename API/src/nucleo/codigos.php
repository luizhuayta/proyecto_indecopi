<?php
declare(strict_types=1);

/**
 * Códigos de seguimiento con azar criptográfico.
 * Portado de Backend/src/lib/codigos.js (Perucanadiense).
 */

/**
 * Código con prefijo y cuerpo aleatorio sin caracteres ambiguos.
 */
function generarCodigo(string $prefijo): string
{
    $alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin I, O, 0, 1
    $bytes = random_bytes(12);
    $cuerpo = '';
    for ($i = 0; $i < 12; $i++) {
        $cuerpo .= $alfabeto[ord($bytes[$i]) % 32];
    }
    return $prefijo . '-' . $cuerpo;
}
