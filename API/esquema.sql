-- Esquema completo de la versión 1.
-- Motor: InnoDB. Juego de caracteres: utf8mb4_unicode_ci.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario VARCHAR(80) NOT NULL,
    hash_contrasena VARCHAR(255) NOT NULL,
    rol VARCHAR(20) NOT NULL DEFAULT 'admin',
    activo TINYINT NOT NULL DEFAULT 1,
    contrasena_actualizada_en DATETIME NULL,
    sesion_version INT UNSIGNED NOT NULL DEFAULT 1,
    creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unq_usuarios_usuario (usuario)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS paginas (
    slug VARCHAR(80) NOT NULL,
    locale VARCHAR(8) NOT NULL DEFAULT 'es',
    titulo VARCHAR(160) NOT NULL DEFAULT '',
    contenido JSON NULL,
    borrador LONGTEXT NULL,
    version INT NOT NULL DEFAULT 1,
    ruta VARCHAR(200) NOT NULL DEFAULT '',
    mostrar_en_menu TINYINT NOT NULL DEFAULT 0,
    orden_menu INT NOT NULL DEFAULT 0,
    actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (slug, locale),
    KEY idx_paginas_menu (locale, mostrar_en_menu, orden_menu)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS configuracion_sitio (
    locale VARCHAR(8) NOT NULL,
    contenido JSON NULL,
    borrador LONGTEXT NULL,
    version INT NOT NULL DEFAULT 1,
    actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (locale)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS institucion (
    id TINYINT NOT NULL,
    nombre VARCHAR(190) NOT NULL DEFAULT '',
    ruc VARCHAR(20) NOT NULL DEFAULT '',
    direccion VARCHAR(255) NOT NULL DEFAULT '',
    telefono VARCHAR(40) NOT NULL DEFAULT '',
    correo VARCHAR(190) NOT NULL DEFAULT '',
    ciudad VARCHAR(120) NOT NULL DEFAULT '',
    actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS apariencia_sitio (
    locale VARCHAR(8) NOT NULL,
    contenido JSON NULL,
    borrador LONGTEXT NULL,
    version INT NOT NULL DEFAULT 1,
    actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (locale)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS medios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre_original VARCHAR(255) NOT NULL DEFAULT '',
    nombre_guardado VARCHAR(255) NOT NULL DEFAULT '',
    url VARCHAR(400) NOT NULL DEFAULT '',
    mime VARCHAR(80) NOT NULL DEFAULT '',
    tamano INT NOT NULL DEFAULT 0,
    ancho INT NULL,
    alto INT NULL,
    variantes TEXT NULL,
    padre_id INT NULL,
    tipo VARCHAR(20) NOT NULL DEFAULT 'subida',
    original_guardado VARCHAR(255) NULL,
    sha256 CHAR(64) NOT NULL DEFAULT '',
    publico TINYINT NOT NULL DEFAULT 1,
    creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_medios_sha256_publico (sha256, publico)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS versiones_medio (
    id INT AUTO_INCREMENT PRIMARY KEY,
    medio_id INT NOT NULL,
    nombre_guardado VARCHAR(255) NOT NULL DEFAULT '',
    url VARCHAR(400) NOT NULL DEFAULT '',
    mime VARCHAR(80) NOT NULL DEFAULT '',
    tamano INT NOT NULL DEFAULT 0,
    ancho INT NULL,
    alto INT NULL,
    motivo VARCHAR(20) NOT NULL DEFAULT 'recorte',
    creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_versiones_medio (medio_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS mensajes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tipo VARCHAR(40) NOT NULL DEFAULT '',
    asunto VARCHAR(255) NOT NULL DEFAULT '',
    cuerpo JSON NULL,
    ticket VARCHAR(40) NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
    respuesta TEXT NULL,
    notificado TINYINT NOT NULL DEFAULT 0,
    creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unq_mensajes_ticket (ticket),
    KEY idx_mensajes_tipo_estado (tipo, estado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS revisiones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    slug VARCHAR(80) NOT NULL,
    locale VARCHAR(8) NOT NULL DEFAULT 'es',
    autor VARCHAR(80) NOT NULL DEFAULT '',
    instantanea LONGTEXT NULL,
    creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_revisiones_slug_locale (slug, locale)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS redirecciones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    desde VARCHAR(200) NOT NULL,
    hacia VARCHAR(200) NOT NULL DEFAULT '',
    estado SMALLINT NOT NULL DEFAULT 301,
    creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unq_redirecciones_desde (desde)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS semillas (
    clave VARCHAR(120) NOT NULL,
    datos JSON NULL,
    actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (clave)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS auditoria (
    id INT AUTO_INCREMENT PRIMARY KEY,
    accion VARCHAR(40) NOT NULL DEFAULT '',
    entidad VARCHAR(60) NOT NULL DEFAULT '',
    entidad_id VARCHAR(60) NULL,
    usuario_id INT NULL,
    datos JSON NULL,
    creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_auditoria_entidad (entidad, entidad_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS secretos (
    k VARCHAR(80) NOT NULL,
    v TEXT NULL,
    PRIMARY KEY (k)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS trabajos_busqueda (
    ruta VARCHAR(200) NOT NULL,
    locale VARCHAR(8) NOT NULL,
    titulo VARCHAR(190) NOT NULL DEFAULT '',
    texto TEXT NULL,
    actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (ruta, locale),
    KEY idx_trabajos_busqueda_locale (locale)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
