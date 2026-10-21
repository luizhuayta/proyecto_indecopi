<?php
declare(strict_types=1);

/**
 * Errores de dominio con código HTTP.
 * Portado de Backend/src/lib/errores.js (Perucanadiense): ErrorHttp y helpers.
 */

/**
 * Error con código HTTP. Lo captura el manejador central de la aplicación.
 */
class ErrorApp extends RuntimeException
{
    public int $codigoHttp;
    public array $extra;

    public function __construct(string $mensaje, int $codigo = 400, array $extra = [])
    {
        parent::__construct($mensaje, $codigo);
        $this->codigoHttp = $codigo;
        $this->extra = $extra;
    }
}

/**
 * Lanza un error de aplicación con código HTTP. Nunca retorna.
 */
function error_app(string $mensaje, int $codigo = 400, array $extra = []): never
{
    throw new ErrorApp($mensaje, $codigo, $extra);
}

/** Solicitud inválida (400). */
function solicitudInvalida(string $mensaje = 'Solicitud inválida.', array $extra = []): never
{
    error_app($mensaje, 400, $extra);
}

/** No autenticado (401). */
function noAutorizado(string $mensaje = 'Token requerido.'): never
{
    error_app($mensaje, 401);
}

/** Sin permisos (403). */
function prohibido(string $mensaje = 'No tiene permisos para esta operación.'): never
{
    error_app($mensaje, 403);
}

/** No encontrado (404). */
function noEncontrado(string $mensaje = 'Recurso no encontrado.'): never
{
    error_app($mensaje, 404);
}

/** Conflicto de versión o estado (409). */
function conflicto(string $mensaje = 'El recurso ya existe.'): never
{
    error_app($mensaje, 409);
}

/** Datos válidos pero incorrectos (422). */
function noProcesable(string $mensaje = 'Datos inválidos.', array $extra = []): never
{
    error_app($mensaje, 422, $extra);
}

/** Archivo demasiado grande (413). */
function demasiadoGrande(string $mensaje = 'El archivo excede el tamaño permitido.'): never
{
    error_app($mensaje, 413);
}

/** Tipo de archivo no permitido (415). */
function tipoNoSoportado(string $mensaje = 'Tipo de archivo no permitido.'): never
{
    error_app($mensaje, 415);
}
