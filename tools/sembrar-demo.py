#!/usr/bin/env python3
"""Siembra el contenido de demostración del portal.

Añade el formulario de contacto a la página /contacto, crea la página del
Libro de Reclamaciones con su formulario, coloca la banda de admisión en la
portada, completa la portada con el diseño institucional (héroe, cifras,
accesos, novedades), crea las páginas públicas de la demo (Nosotros,
Servicios, Transparencia y Mesa de partes), ordena el menú de navegación,
publica noticias de muestra y reindexa la búsqueda.
Las noticias de muestra se publican con el usuario admin del sembrador.

Uso:  python3 tools/sembrar-demo.py
Variables de entorno opcionales: API, USUARIO, CLAVE, REINDEX_CMD.
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


def pedir(
    metodo: str,
    ruta: str,
    cuerpo: dict | None = None,
    token: str = "",
    permitir_error: bool = False,
) -> dict:
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
    if "error" in datos_respuesta and not permitir_error:
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
    if "error" in pedir("GET", "/paginas/libro-de-reclamaciones", permitir_error=True):
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

    # --- 4. Portada con el diseño institucional --------------------------------
    # Conserva los bloques actuales de la portada y añade delante los del
    # diseño solo si falta `accesos` (idempotente). Las imágenes quedan
    # vacías: el dueño las sube desde Medios.
    documento = pedir("GET", "/paginas/inicio")
    contenido = documento.get("contenido") or {}
    bloques = contenido.get("blocks") or []
    if not any(b.get("type") == "accesos" for b in bloques):
        enlace = lambda icono, texto, url, desc="": {
            "icono": icono, "texto": texto, "descripcion": desc, "url": url,
        }
        portada = [
            bloque("hero", "portada-hero", {
                "slides": [
                    {
                        "badge": "Formación · Educación superior",
                        "title": "{{institucion.nombre}}",
                        "image": "",
                    },
                    {
                        "badge": "Admisión 2026",
                        "title": "Postula y transforma tu futuro",
                        "image": "",
                    },
                ],
                "subtitle": "Estudia con nosotros y transforma el futuro.",
                "cta": "Programas", "ctaLink": "/programas",
                "cta2": "Transparencia", "cta2Link": "/transparencia",
            }),
            bloque("stats", "portada-cifras", {
                "tag": "Periodo académico 2026-I",
                "title": "Nuestras cifras de impacto",
                "items": [
                    {"icon": "usuarios", "number": "29", "label": "Docentes"},
                    {"icon": "grafico", "number": "356", "label": "Estudiantes"},
                    {"icon": "graduacion", "number": "4", "label": "Programas"},
                    {"icon": "premio", "number": "+10", "label": "Años de trayectoria"},
                ],
            }),
            bloque("accesos", "portada-accesos", {
                "title": "Transparencia y gestión institucional",
                "grupos": [
                    {"titulo": "Información para postulantes", "destacado": True, "enlaces": [
                        enlace("graduacion", "Admisión", "/admision", "Proceso de admisión"),
                        enlace("premio", "Becas y créditos", "/becas", "Apoyos económicos"),
                        enlace("monedas", "Costos", "/costos", "Matrícula, pensión y derechos"),
                        enlace("usuarios", "Plana docente", "/nosotros", "Autoridades y perfiles"),
                    ]},
                    {"titulo": "Gestión y normativa", "destacado": False, "enlaces": [
                        enlace("documento", "Transparencia", "/transparencia"),
                        enlace("balanza", "Reglamentos", "/reglamentos"),
                        enlace("correo", "Contacto", "/contacto"),
                        enlace("libro", "Libro de Reclamaciones", "/libro-de-reclamaciones"),
                    ]},
                ],
            }),
            bloque("novedades", "portada-novedades", {
                "tag": "Actualidad",
                "title": "Noticias y comunicados",
                "text": "Lo más reciente de la vida institucional.",
                "allLabel": "Ver todas las noticias",
                "cantidadNoticias": 4,
                "cantidadComunicados": 3,
            }),
        ]
        contenido["blocks"] = portada + bloques
        bloques = contenido["blocks"]
    # En portadas ya sembradas con el diseño, añade solo el bloque que falte:
    # Novedades va tras los accesos (o antes de los servicios/entidades).
    if not any(b.get("type") == "novedades" for b in bloques):
        posicion = next(
            (i + 1 for i, b in enumerate(bloques) if b.get("type") == "accesos"),
            next(
                (i for i, b in enumerate(bloques)
                 if b.get("type") in ("serviceCards", "entidades")),
                len(bloques),
            ),
        )
        bloques.insert(
            posicion,
            bloque("novedades", "portada-novedades", {
                "tag": "Actualidad",
                "title": "Noticias y comunicados",
                "text": "Lo más reciente de la vida institucional.",
                "allLabel": "Ver todas las noticias",
                "cantidadNoticias": 4,
                "cantidadComunicados": 3,
            }),
        )
        contenido["blocks"] = bloques
    guardar_y_publicar("inicio", contenido, documento.get("version", 1), token)
    print("· /inicio: portada con el diseño institucional publicada")

    # --- 5. Páginas públicas de la demo -------------------------------------
    # Cada página se crea si falta y se republica siempre con su contenido de
    # muestra (idempotente: cada corrida deja el mismo estado). Los textos son
    # neutros: la institución los reemplaza desde el editor.
    def asegurar_pagina(slug: str, titulo: str) -> None:
        if "error" in pedir("GET", f"/paginas/{slug}", permitir_error=True):
            pedir(
                "POST",
                "/paginas",
                {
                    "titulo": titulo,
                    "slug": slug,
                    "ruta": f"/{slug}",
                    "mostrar_en_menu": True,
                    "plantilla": "blank",
                },
                token,
            )
            print(f"· página {slug} creada")

    def publicar_pagina(slug: str, titulo: str, bloques_pagina: list) -> None:
        asegurar_pagina(slug, titulo)
        documento = pedir("GET", f"/paginas/{slug}")
        guardar_y_publicar(
            slug,
            {"schemaVersion": 1, "blocks": bloques_pagina},
            documento.get("version", 1),
            token,
        )
        print(f"· /{slug}: contenido de muestra publicado")

    publicar_pagina("nosotros", "Nosotros", [
        bloque("pageHero", "nosotros-hero", {
            "badge": "La institución",
            "title": "Quiénes somos",
            "text": (
                "Somos una institución dedicada a la formación integral de "
                "nuestros estudiantes, con un equipo comprometido y una "
                "oferta formativa pensada para el entorno."
            ),
            "cta": "Contáctanos",
            "ctaLink": "/contacto",
            "image": "",
        }),
        bloque("about", "nosotros-historia", {
            "tag": "Nuestra historia",
            "title": "Una institución al servicio de la comunidad",
            "text": (
                "Desde nuestra creación trabajamos para ofrecer una formación "
                "de calidad, cercana y abierta a la comunidad. Nuestro "
                "proyecto institucional se revisa cada año con la "
                "participación de todo el equipo."
            ),
            "image": "",
            "imageAlt": "",
            "cta": "Conoce la oferta académica",
            "ctaLink": "/oferta",
            "features": [
                {"text": "Formación centrada en la práctica y el acompañamiento."},
                {"text": "Gestión transparente y rendición de cuentas permanente."},
                {"text": "Vinculación con instituciones y con la comunidad local."},
            ],
        }),
        bloque("stats", "nosotros-cifras", {
            "tag": "La institución en cifras",
            "title": "",
            "items": [
                {"icon": "usuarios", "number": "29", "label": "Docentes"},
                {"icon": "grafico", "number": "356", "label": "Estudiantes"},
                {"icon": "graduacion", "number": "4", "label": "Programas"},
                {"icon": "premio", "number": "+10", "label": "Años de trayectoria"},
            ],
        }),
        bloque("team", "nosotros-equipo", {
            "tag": "El equipo",
            "title": "Dirección y equipo de gestión",
            "text": "Las personas responsables de la vida institucional.",
            "items": [
                {"name": "Dirección General", "role": "Dirección", "image": "", "linkedin": "", "github": ""},
                {"name": "Secretaría Académica", "role": "Gestión académica", "image": "", "linkedin": "", "github": ""},
                {"name": "Administración", "role": "Gestión administrativa", "image": "", "linkedin": "", "github": ""},
            ],
        }),
        bloque("cta", "nosotros-cta", {
            "title": "¿Quieres conocernos mejor?",
            "text": "Escríbenos o visítanos: estaremos encantados de atenderte.",
            "button": "Contáctanos",
            "link": "/contacto",
        }),
    ])

    publicar_pagina("servicios", "Servicios", [
        bloque("pageHero", "servicios-hero", {
            "badge": "Servicios",
            "title": "Servicios institucionales",
            "text": (
                "Además de la formación, ponemos a disposición de la "
                "comunidad una serie de servicios y trámites en línea."
            ),
            "cta": "Mesa de partes",
            "ctaLink": "/mesa-de-partes",
            "image": "",
        }),
        bloque("serviceCards", "servicios-tarjetas", {
            "subtitle": "Qué ofrecemos",
            "title": "Servicios a la comunidad",
            "cards": [
                {
                    "path": "/mesa-de-partes",
                    "img": "/demo/card-1.svg",
                    "title": "Mesa de partes virtual",
                    "text": "Presenta solicitudes y trámites en línea con cargo de recepción.",
                    "link": "Ir a mesa de partes",
                },
                {
                    "path": "/libro-de-reclamaciones",
                    "img": "/demo/card-2.svg",
                    "title": "Libro de Reclamaciones",
                    "text": "Registra tu reclamo o tu queja y recibe un código de seguimiento.",
                    "link": "Registrar una solicitud",
                },
                {
                    "path": "/transparencia",
                    "img": "/demo/card-3.svg",
                    "title": "Documentos de gestión",
                    "text": "Consulta la normativa y los documentos de gestión institucional.",
                    "link": "Ver transparencia",
                },
            ],
        }),
        bloque("reasons", "servicios-motivos", {
            "subtitle": "Por qué usar los servicios en línea",
            "title": "Trámites más simples",
            "items": [
                {
                    "img": "",
                    "title": "Sin desplazamientos",
                    "text": "Presenta tu solicitud desde cualquier lugar y en cualquier momento.",
                },
                {
                    "img": "",
                    "title": "Cargo inmediato",
                    "text": "Cada solicitud registrada devuelve un código de seguimiento.",
                },
                {
                    "img": "",
                    "title": "Respuesta por correo",
                    "text": "Recibirás la respuesta de tu solicitud en el correo que indiques.",
                },
            ],
        }),
        bloque("cta", "servicios-cta", {
            "title": "¿Tienes una consulta sobre un trámite?",
            "text": "Escríbenos y te orientamos sobre el procedimiento adecuado.",
            "button": "Contáctanos",
            "link": "/contacto",
        }),
    ])

    enlace_acceso = lambda icono, texto, url, desc="": {
        "icono": icono, "texto": texto, "descripcion": desc, "url": url,
    }
    publicar_pagina("transparencia", "Transparencia", [
        bloque("pageHero", "transparencia-hero", {
            "badge": "Transparencia",
            "title": "Transparencia institucional",
            "text": (
                "Publicamos la información de gestión y la normativa que "
                "sustenta el funcionamiento de la institución."
            ),
            "cta": "Mesa de partes",
            "ctaLink": "/mesa-de-partes",
            "image": "",
        }),
        bloque("accesos", "transparencia-accesos", {
            "title": "Documentos y enlaces de gestión",
            "grupos": [
                {
                    "titulo": "Gestión y normativa",
                    "destacado": True,
                    "enlaces": [
                        enlace_acceso("documento", "Documentos de gestión", "/transparencia", "Normativa institucional"),
                        enlace_acceso("balanza", "Libro de Reclamaciones", "/libro-de-reclamaciones", "Registra tu reclamo o queja"),
                        enlace_acceso("escudo", "Protección de datos", "/mesa-de-partes", "Solicita información sobre tus datos"),
                        enlace_acceso("correo", "Mesa de partes", "/mesa-de-partes", "Solicitudes y trámites en línea"),
                    ],
                },
                {
                    "titulo": "La institución",
                    "destacado": False,
                    "enlaces": [
                        enlace_acceso("escuela", "Nosotros", "/nosotros"),
                        enlace_acceso("graduacion", "Oferta académica", "/oferta"),
                        enlace_acceso("noticias", "Noticias", "/noticias"),
                        enlace_acceso("mensaje", "Contacto", "/contacto"),
                    ],
                },
            ],
        }),
        bloque("richText", "transparencia-normativa", {
            "title": "Información publicada",
            "lastUpdated": "",
            "body": (
                "<p>En esta sección la institución publica sus documentos de "
                "gestión, la normativa interna y la información de interés "
                "para la comunidad.</p>"
                "<p>Si no encuentras un documento o necesitas información "
                "adicional, puedes solicitarla a través de la "
                "<a href=\"/mesa-de-partes\">mesa de partes virtual</a> o "
                "escribiendo a la institución desde la página de "
                "<a href=\"/contacto\">contacto</a>.</p>"
            ),
        }),
        bloque("entidades", "transparencia-entidades", {
            "title": "Entidades colaboradoras",
            "text": "Instituciones que trabajan junto a nosotros.",
            "items": [
                {"title": "Entidad 1", "url": "https://e1.test", "image": "/demo/logo-1.svg", "alt": "Logo de la entidad 1"},
                {"title": "Entidad 2", "url": "https://e2.test", "image": "/demo/logo-2.svg", "alt": "Logo de la entidad 2"},
                {"title": "Entidad 3", "url": "https://e3.test", "image": "/demo/logo-3.svg", "alt": "Logo de la entidad 3"},
                {"title": "Entidad 4", "url": "https://e4.test", "image": "/demo/logo-4.svg", "alt": "Logo de la entidad 4"},
                {"title": "Entidad 5", "url": "https://e5.test", "image": "/demo/logo-5.svg", "alt": "Logo de la entidad 5"},
            ],
        }),
    ])

    publicar_pagina("mesa-de-partes", "Mesa de partes", [
        bloque("pageHero", "mesa-hero", {
            "badge": "Trámites",
            "title": "Mesa de partes virtual",
            "text": (
                "Presenta aquí tus solicitudes y trámites. Cada envío genera "
                "un código de seguimiento que llega a tu correo."
            ),
            "cta": "",
            "ctaLink": "",
            "image": "",
        }),
        bloque("contactForm", "mesa-form", {
            "title": "Presenta tu solicitud",
            "text": (
                "Completa el formulario y recibirás un cargo con el código de "
                "tu trámite."
            ),
            "tipo": "tramite",
            "submitLabel": "Enviar solicitud",
            "destinationEmail": "mesadepartes@ejemplo.test",
            "fields": {
                "name": True,
                "documento": True,
                "email": True,
                "phone": True,
                "subject": True,
                "message": True,
                "consentimiento": True,
            },
            "placeholders": {
                "name": "Nombre y apellidos",
                "documento": "DNI o RUC",
                "email": "correo@ejemplo.test",
                "phone": "999 999 999",
                "subject": "Solicito…",
                "message": "Describe tu solicitud.",
            },
            "consentText": (
                "Autorizo el tratamiento de mis datos personales para atender "
                "esta solicitud, conforme a la Ley N.° 29733 de Protección de "
                "Datos Personales."
            ),
        }),
        bloque("richText", "mesa-plazos", {
            "title": "Recepción y seguimiento",
            "lastUpdated": "",
            "body": (
                "<p>Las solicitudes presentadas por este medio quedan "
                "registradas con fecha y hora de recepción y generan un "
                "código de seguimiento que se envía al correo indicado.</p>"
                "<p>Para consultar el estado de tu trámite, escribe a la "
                "institución indicando tu código. Los plazos de atención y el "
                "horario de la mesa de partes presencial se publican en esta "
                "misma página.</p>"
            ),
        }),
    ])

    # --- 6. Orden del menú de navegación ------------------------------------
    # Se fija en cada corrida (idempotente): la numeración es absoluta, así
    # que reordenar no depende del estado previo. Incluye mostrar_en_menu del
    # Libro de Reclamaciones, que la demo sí muestra en la navegación.
    menu = [
        "inicio", "nosotros", "oferta", "admision", "servicios",
        "transparencia", "mesa-de-partes", "contacto", "libro-de-reclamaciones",
    ]
    for posicion, slug in enumerate(menu, start=1):
        pedir(
            "PATCH",
            f"/paginas/{slug}/meta",
            {"mostrar_en_menu": True, "orden_menu": posicion},
            token,
        )
    print("· menú ordenado: " + ", ".join(menu))

    # Noticias de muestra para que el bloque Novedades no salga vacío. Solo si
    # aún no hay ninguna: el script se puede correr varias veces.
    if not pedir("GET", "/noticias").get("items"):
        muestras = [
            ("noticia", "Institucional", "Inicio del año académico 2026",
             "Bienvenida a la comunidad educativa.", True),
            ("noticia", "Admisión", "Resultados del examen de admisión",
             "Consulta la lista de ingresantes.", False),
            ("noticia", "Investigación", "Seminario de competencias pedagógicas",
             "Ponentes nacionales e internacionales.", False),
            ("comunicado", "", "Horario de atención de verano", "", False),
        ]
        for tipo, categoria, titulo, resumen, destacada in muestras:
            pedir("POST", "/noticias", {
                "tipo": tipo, "categoria": categoria, "titulo": titulo,
                "resumen": resumen,
                "cuerpo": f"<p>{resumen or titulo}</p>",
                "destacada": destacada, "estado": "publicado",
            }, token)
        print("· noticias de muestra publicadas")

    # --- 7. Reindexar la búsqueda ---------------------------------------------
    # Si el contenedor del API no se llama así, define REINDEX_CMD con el
    # comando equivalente para este entorno.
    comando = os.environ.get(
        "REINDEX_CMD",
        "docker exec plantilla_portal_api php tools/reindexar-busqueda.php",
    )
    if os.system(comando) != 0:
        print("· aviso: no se pudo reindexar la búsqueda; ejecuta REINDEX_CMD manualmente.")
    print("Listo.")


if __name__ == "__main__":
    main()
