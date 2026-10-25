#!/usr/bin/env python3
"""Siembra el contenido de demostración del portal.

Añade el formulario de contacto a la página /contacto, crea la página del
Libro de Reclamaciones con su formulario, coloca la banda de admisión en la
portada y reindexa la búsqueda.

Uso:  python3 tools/sembrar-demo.py
Variables de entorno opcionales: API, USUARIO, CLAVE.
"""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request

API = os.environ.get("API", "http://127.0.0.1:8000")
USUARIO = os.environ.get("USUARIO", "admin")
CLAVE = os.environ.get("CLAVE", "ClaveHumo123")

COOKIE = ""


def pedir(metodo: str, ruta: str, cuerpo: dict | None = None, token: str = "") -> dict:
    global COOKIE
    datos = json.dumps(cuerpo).encode() if cuerpo is not None else None
    peticion = urllib.request.Request(f"{API}{ruta}", data=datos, method=metodo)
    peticion.add_header("Content-Type", "application/json")
    if token:
        peticion.add_header("X-CSRF-Token", token)
    if COOKIE:
        peticion.add_header("Cookie", COOKIE)
    try:
        with urllib.request.urlopen(peticion, timeout=20) as respuesta:
            cabeceras = respuesta.headers.get_all("Set-Cookie") or []
            for valor in cabeceras:
                if valor.startswith("plibre_sesion="):
                    COOKIE = valor.split(";")[0]
            crudo = respuesta.read().decode()
    except urllib.error.HTTPError as error:
        crudo = error.read().decode()
    datos_respuesta = json.loads(crudo) if crudo.strip() else {}
    if "error" in datos_respuesta:
        raise SystemExit(
            f"{metodo} {ruta} falló: {datos_respuesta.get('error')} "
            f"({datos_respuesta.get('field', 'sin campo')})"
        )
    return datos_respuesta


def guardar_y_publicar(slug: str, contenido: dict, version: int, token: str) -> None:
    """Guarda el borrador y lo publica. La publicación exige la versión nueva."""
    guardado = pedir(
        "PUT", f"/paginas/{slug}", {"contenido": contenido, "version": version}, token
    )
    pedir(
        "POST",
        f"/paginas/{slug}/publicar",
        {"version": guardado.get("version", version)},
        token,
    )


def bloque(tipo: str, identificador: str, props: dict) -> dict:
    """Bloque con la forma que exige el validador del servidor."""
    return {
        "id": identificador,
        "type": tipo,
        "hidden": False,
        "layout": {"width": "full", "padding": "", "background": ""},
        "props": props,
    }


def main() -> None:
    pedir("POST", "/auth/login", {"usuario": USUARIO, "contrasena": CLAVE})
    token = pedir("GET", "/auth/me").get("csrfToken", "")
    if not token:
        raise SystemExit("No se pudo iniciar sesión. Revisa USUARIO y CLAVE.")

    # --- 1. Formulario de contacto en /contacto --------------------------------
    documento = pedir("GET", "/paginas/contacto")
    contenido = documento.get("contenido") or {}
    bloques = contenido.get("blocks") or []
    hay_formulario = any(b.get("type") == "contactForm" for b in bloques)
    if not hay_formulario:
        bloques.append(
            bloque("contactForm", "contacto-form", {
                    "title": "Escríbenos",
                    "text": "Cuéntanos qué necesitas y te respondemos por correo.",
                    "submitLabel": "Enviar mensaje",
                    "fields": {
                        "nombre": True,
                        "correo": True,
                        "telefono": True,
                        "asunto": True,
                        "mensaje": True,
                    },
                    "placeholders": {
                        "name": "Nombre y apellidos",
                        "email": "correo@ejemplo.test",
                        "phone": "999 999 999",
                        "subject": "Admisión 2026",
                        "message": "Escribe aquí tu consulta.",
                    },
            })
        )
        contenido["blocks"] = bloques
    # Se publica siempre: así el script también sube un borrador que quedó a
    # medias en una corrida anterior.
    guardar_y_publicar("contacto", contenido, documento.get("version", 1), token)
    if hay_formulario:
        print("· /contacto: formulario de contacto publicado")
    else:
        print("· /contacto: formulario de contacto añadido y publicado")

    # --- 2. Página del Libro de Reclamaciones ---------------------------------
    if "error" in pedir("GET", "/paginas/libro-de-reclamaciones"):
        pedir(
            "POST",
            "/paginas",
            {
                "titulo": "Libro de Reclamaciones",
                "slug": "libro-de-reclamaciones",
                "ruta": "/libro-de-reclamaciones",
                "mostrar_en_menu": False,
                "plantilla": "blank",
            },
            token,
        )
        print("· página libro-de-reclamaciones creada")

    contenido_reclamo = {
        "schemaVersion": 1,
        "blocks": [
            bloque("claimsBook", "reclamo-1", {
                    "title": "Libro de Reclamaciones",
                    "company": "Instituto de Educación Superior",
                    "subtitle": (
                        "Registra aquí tu reclamo o tu queja. Recibirás un código de "
                        "seguimiento con el que podrás pedir información sobre su estado."
                    ),
                    "ruc": "20500000000",
                    "destinationEmail": "informacion@ejemplo.test",
                    "disclaimer1": (
                        "En virtud de lo dispuesto en el artículo 24 de la Ley N.° 29311, "
                        "Ley de Protección y Defensa del Consumidor, los consumidores "
                        "tienen derecho a registrar reclamos o quejas en el Libro de "
                        "Reclamaciones Virtual de esta institución."
                    ),
                    "disclaimer2": (
                        "El libro de reclamaciones se encuentra registrado ante la "
                        "Dirección de Defensa del Consumidor (Indecopi) y puede ser "
                        "consultado por el consumidor en el portal de la institución."
                    ),
                    "submitLabel": "Registrar reclamo",
            }),
        ],
    }
    documento = pedir("GET", "/paginas/libro-de-reclamaciones")
    guardar_y_publicar(
        "libro-de-reclamaciones", contenido_reclamo, documento.get("version", 1), token
    )
    print("· libro-de-reclamaciones publicado")

    # --- 3. Banda de admisión en la portada ----------------------------------
    documento = pedir("GET", "/paginas/inicio")
    contenido = documento.get("contenido") or {}
    bloques = contenido.get("blocks") or []
    if not any(b.get("type") == "admision" for b in bloques):
        bloques.insert(
            min(1, len(bloques)),
            bloque("admision", "admision-1", {
                    "label": "Proceso de admisión 2026",
                    "fecha": "Cierre de postulación: 15 de diciembre",
                    "text": (
                        "Presenta tu postulación en línea y recibe la "
                        "confirmación al instante."
                    ),
                    "button": "Postular ahora",
                    "link": "/admision",
            }),
        )
        contenido["blocks"] = bloques
    guardar_y_publicar("inicio", contenido, documento.get("version", 1), token)
    print("· /inicio: banda de admisión publicada")

    # --- 4. Reindexar la búsqueda ---------------------------------------------
    os.system(
        "docker run --rm --network plibre_default -v \"$PWD\":/app -w /app "
        "-e DB_HOST=plantilla_mariadb -e DB_PORT=3306 "
        "plantilla-php81 php tools/reindexar-busqueda.php"
    )
    print("Listo.")


if __name__ == "__main__":
    main()
