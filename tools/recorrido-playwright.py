"""Recorrido completo en vídeo del CMS educativo con Playwright."""

import os
import sys
import time

from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:4200"
SALIDA = "/tmp/opencode/tour/video"
os.makedirs(SALIDA, exist_ok=True)

PASO = [0]


def titulo(pg, texto, segundos=2.2):
    """Pinta un rótulo en pantalla y espera para que se lea."""
    PASO[0] += 1
    pg.evaluate(
        """([texto, n]) => {
      let capa = document.getElementById('__tour_capa');
      if (!capa) {
        capa = document.createElement('div');
        capa.id = '__tour_capa';
        capa.style.cssText = [
          'position:fixed', 'left:0', 'right:0', 'bottom:0', 'z-index:2147483647',
          'font:600 26px/1.35 system-ui,sans-serif', 'color:#fff',
          'background:linear-gradient(90deg,#123A6D 0%,#1B4E8F 60%,#B3541E 100%)',
          'padding:18px 28px', 'box-shadow:0 -6px 24px rgba(0,0,0,.35)',
          'pointer-events:none', 'text-shadow:0 1px 2px rgba(0,0,0,.4)'
        ].join(';');
        document.body.appendChild(capa);
      }
      capa.textContent = '▪ ' + texto;
    }""",
        [texto, PASO[0]],
    )
    pg.wait_for_timeout(int(segundos * 1000))


def raton(pg, selector, offset=(0, 0)):
    """Sitúa el cursor de forma natural sobre un elemento."""
    caja = pg.query_selector(selector)
    if not caja:
        return
    b = caja.bounding_box()
    if not b:
        return
    pg.mouse.move(
        b["x"] + b["width"] / 2 + offset[0],
        b["y"] + b["height"] / 2 + offset[1],
        steps=25,
    )
    pg.wait_for_timeout(400)


def bajar(pg, pasos=8, alto=700):
    for _ in range(pasos):
        pg.mouse.wheel(0, alto)
        pg.wait_for_timeout(550)


def subir(pg, pasos=8, alto=700):
    for _ in range(pasos):
        pg.mouse.wheel(0, -alto)
        pg.wait_for_timeout(450)


def ir(pg, ruta, espera=1800):
    pg.goto(BASE + ruta, wait_until="domcontentloaded")
    pg.wait_for_load_state("networkidle")
    pg.wait_for_timeout(espera)


def login(pg):
    ir(pg, "/admin/login", 1200)
    pg.fill("input[type=text]", "admin")
    pg.wait_for_timeout(350)
    pg.fill("input[type=password]", "AdminLocal123")
    pg.wait_for_timeout(350)
    pg.click("button[type=submit]")
    pg.wait_for_timeout(2500)


def paso(nombre, fn):
    print(f"[{time.strftime('%H:%M:%S')}] {nombre}", flush=True)
    try:
        fn()
    except Exception as e:  # noqa: BLE001 - el recorrido continúa aunque falle un paso
        print(f"  !! falló {nombre}: {e}", file=sys.stderr, flush=True)


with sync_playwright() as p:
    navegador = p.chromium.launch(headless=True)
    ctx = navegador.new_context(
        viewport={"width": 1440, "height": 900},
        record_video_dir=SALIDA,
        record_video_size={"width": 1440, "height": 900},
        locale="es-PE",
        device_scale_factor=1,
    )
    pg = ctx.new_page()
    pg.set_default_timeout(20000)
    # El panel usa confirm() para avisar de marcadores sin sustituir y para
    # borrar; sin este manejador Playwright descarta el diálogo y la acción
    # se queda sin efecto.
    pg.on("dialog", lambda d: d.accept())

    # ---------------------------------------------------------------- portada
    def s1():
        ir(pg, "/", 2500)
        titulo(pg, "1 · Sitio público: portada institucional", 3)
        raton(pg, "header a")
        bajar(pg, 7)
        titulo(pg, "Bloques: portada, cifras y llamado a la acción", 2.5)
        subir(pg, 7)

    paso("portada pública", s1)

    def s2():
        titulo(pg, "2 · Navegación pública entre páginas", 2.5)
        raton(pg, "nav a[href='/oferta']")
        pg.click("nav a[href='/oferta']")
        pg.wait_for_load_state("networkidle")
        pg.wait_for_timeout(1500)
        titulo(pg, "Página «Oferta académica»", 2)
        bajar(pg, 4)
        subir(pg, 4)
        pg.click("nav a[href='/admision']")
        pg.wait_for_load_state("networkidle")
        pg.wait_for_timeout(1500)
        titulo(pg, "Página «Admisión»", 2)
        pg.click("nav a[href='/contacto']")
        pg.wait_for_load_state("networkidle")
        pg.wait_for_timeout(1500)
        titulo(pg, "Página «Contacto»: datos, mapa… todavía sin formulario", 3)
        bajar(pg, 3)

    paso("navegación pública", s2)

    # ------------------------------------------------------------------ 404
    def s3():
        ir(pg, "/pagina-que-no-existe", 2500)
        titulo(pg, "3 · Página inexistente: estado 404 con salida al inicio", 3)

    paso("404", s3)

    # ----------------------------------------------------------------- login
    def s4():
        ir(pg, "/", 1500)
        titulo(pg, "4 · Acceso al panel de administración", 2.5)
        raton(pg, "a[href='/admin/login']")
        pg.click("a[href='/admin/login']")
        pg.wait_for_load_state("networkidle")
        pg.wait_for_timeout(1200)
        login(pg)
        titulo(pg, "Sesión iniciada: panel con las secciones de administración", 3)

    paso("login", s4)

    # ---------------------------------------------------------------- páginas
    def s5():
        ir(pg, "/admin/paginas", 2000)
        titulo(pg, "5 · Páginas: listado, plantillas y creación", 2.5)
        bajar(pg, 5, 600)
        subir(pg, 5, 600)
        titulo(pg, "Creamos una página nueva desde una plantilla", 2.5)
        pg.fill(
            "input[placeholder='Por ejemplo: Admisión']",
            f"Demostración recorrido {time.strftime('%H%M%S')}",
        )
        pg.wait_for_timeout(400)
        pg.select_option("select", label="Servicio")
        pg.wait_for_timeout(600)
        titulo(pg, "Plantilla «Servicio» seleccionada", 2)
        raton(pg, "button:has-text('Crear página')")
        pg.click("button:has-text('Crear página')")
        pg.wait_for_timeout(2500)
        titulo(pg, "La página se crea y abrimos su editor", 2.5)

    paso("páginas: crear", s5)

    # ------------------------------------------------------------------ editor
    def s6():
        try:
            pg.wait_for_url("**/admin/editor/**", timeout=15000)
        except Exception:  # noqa: BLE001 - a veces la navegación ya ocurrió
            if "/admin/editor/" not in pg.url:
                raise
        pg.wait_for_timeout(2500)
        titulo(pg, "6 · Constructor visual: bloques, vista previa e inspector", 3)
        raton(pg, "button:has-text('Tableta')")
        pg.click("button:has-text('Tableta')")
        pg.wait_for_timeout(1600)
        titulo(pg, "Vista previa en tableta", 2)
        pg.click("button:has-text('Móvil')")
        pg.wait_for_timeout(1600)
        titulo(pg, "Vista previa en móvil", 2)
        pg.click("button:has-text('Escritorio')")
        pg.wait_for_timeout(1400)

        titulo(pg, "Seleccionamos un bloque de la vista previa…", 2.5)
        bloque = pg.query_selector(
            ".editor__preview-inner [class*='bloque'], .editor__preview-inner > *"
        )
        if bloque:
            bloque.click()
        pg.wait_for_timeout(1400)
        titulo(pg, "…y su inspector carga los campos del bloque", 2.5)

        pg.select_option(
            ".editor__inspector select, select", index=0
        ) if False else None
        titulo(pg, "Añadimos otro bloque desde el catálogo", 2.5)
        pg.select_option("select", label="Preguntas frecuentes")
        pg.wait_for_timeout(500)
        pg.click("button:has-text('Agregar bloque')")
        pg.wait_for_timeout(1600)
        titulo(pg, "Bloque «Preguntas frecuentes» añadido", 2)

        titulo(pg, "Deshacer…", 2)
        pg.click("button:has-text('Deshacer')")
        pg.wait_for_timeout(1300)
        titulo(pg, "…y rehacer", 2)
        pg.click("button:has-text('Rehacer')")
        pg.wait_for_timeout(1300)

        titulo(pg, "Editamos el título de la página en el inspector", 2.5)
        campo = pg.query_selector(".editor__inspector input")
        if campo:
            campo.click()
            pg.keyboard.press("Control+a")
            pg.keyboard.type("Oferta de verano 2026", delay=25)
        pg.wait_for_timeout(1200)

        titulo(pg, "Guardamos el borrador…", 2.5)
        raton(pg, "button:has-text('Guardar')")
        pg.click("button:has-text('Guardar')")
        pg.wait_for_timeout(1800)
        titulo(pg, "…y publicamos. La versión publicada cambia", 2.5)
        pg.click("button:has-text('Publicar')")
        pg.wait_for_timeout(2200)

    paso("editor visual", s6)

    # ------------------------------------------------------- verificación web
    def s7():
        titulo(pg, "7 · Comprobamos en el sitio público lo publicado", 2.5)
        url = pg.url.replace("http://127.0.0.1:4200", "").replace("/admin/editor/", "/")
        pg.goto(BASE + url, wait_until="domcontentloaded")
        pg.wait_for_load_state("networkidle")
        pg.wait_for_timeout(2200)
        titulo(pg, "La página nueva ya está en línea con su plantilla", 3)
        bajar(pg, 5)
        subir(pg, 5)

    paso("verificación pública de la página nueva", s7)

    # -------------------------------------------------------------- formulario
    def s8():
        titulo(pg, "8 · Añadimos el formulario de contacto a la página Contacto", 2.5)
        ir(pg, "/admin/editor/contacto", 2500)
        pg.select_option("select", label="Formulario de contacto")
        pg.wait_for_timeout(500)
        pg.click("button:has-text('Agregar bloque')")
        pg.wait_for_timeout(1600)
        titulo(pg, "Bloque de formulario añadido", 2)
        pg.click("button:has-text('Guardar')")
        pg.wait_for_timeout(1600)
        pg.click("button:has-text('Publicar')")
        pg.wait_for_timeout(2200)
        titulo(pg, "Publicado. Un visitante ya puede escribirnos", 2.5)

    paso("formulario de contacto", s8)

    # ---------------------------------------------------------------- mensajes
    def s9():
        ir(pg, "/admin/mensajes", 2200)
        titulo(pg, "9 · Bandeja de mensajes del panel", 2.5)
        pg.select_option("select >> nth=0", label="Contacto")
        pg.wait_for_timeout(500)
        pg.select_option("select >> nth=1", label="Pendiente")
        pg.wait_for_timeout(500)
        pg.click("button:has-text('Aplicar filtros')")
        pg.wait_for_timeout(1800)
        titulo(pg, "Filtro por tipo y estado", 2.5)
        pg.click("button:has-text('Ver') >> nth=0")
        pg.wait_for_timeout(1500)
        titulo(pg, "Detalle del mensaje con su ticket", 2.5)
        bajar(pg, 3, 500)
        area = pg.query_selector("textarea")
        if area:
            area.click()
            pg.keyboard.type(
                "Hola, gracias por escribir. La matrícula se realiza durante todo el año. "
                "Te enviamos los requisitos por correo.",
                delay=8,
            )
        pg.wait_for_timeout(800)
        titulo(pg, "Respondemos desde la propia bandeja", 2.5)
        pg.click("button:has-text('Enviar respuesta')")
        pg.wait_for_timeout(2500)
        titulo(pg, "Mensaje respondido y marcado como respondido", 2.5)

    paso("mensajes", s9)

    # ----------------------------------------------------------------- medios
    def s10():
        ir(pg, "/admin/medios", 2200)
        titulo(pg, "10 · Medios: subida, recorte y variantes", 2.5)
        pg.set_input_files("input[type=file]", "/tmp/opencode/tour/banner-demo.png")
        pg.wait_for_timeout(1200)
        titulo(pg, "Elegimos el archivo: se comprueba la firma real", 2.5)
        pg.click("button:has-text('Subir')")
        pg.wait_for_timeout(3500)
        titulo(pg, "Subida completa, fuera del directorio público", 2.5)
        pg.click(".miniatura >> nth=0")
        pg.wait_for_timeout(1800)
        titulo(pg, "Al seleccionarla aparecen sus datos y acciones", 2.5)
        bajar(pg, 3, 500)

    paso("medios", s10)

    # --------------------------------------------------------------- identidad
    def s11():
        ir(pg, "/admin/identidad", 2200)
        titulo(pg, "11 · Identidad de la institución", 2.5)
        campo = pg.query_selector("#identidad-ciudad")
        if campo:
            campo.click()
            pg.keyboard.press("Control+a")
            pg.keyboard.type("Arequipa Centro", delay=15)
        pg.wait_for_timeout(900)
        titulo(pg, "«Guardar» deja el cambio en borrador…", 2.5)
        pg.click("button:has-text('Guardar')")
        pg.wait_for_timeout(1800)
        titulo(pg, "…y «Publicar» lo lleva al sitio", 2.5)
        pg.click("button:has-text('Publicar')")
        pg.wait_for_timeout(2200)
        titulo(
            pg, "El token {{institucion.ciudad}} se sustituye en el pie del sitio", 3
        )
        ir(pg, "/", 2000)
        pg.evaluate("() => window.scrollTo(0, document.body.scrollHeight)")
        pg.wait_for_timeout(1800)
        titulo(pg, "La ciudad nueva ya aparece en el pie público", 2.5)

    paso("identidad", s11)

    # -------------------------------------------------------------- apariencia
    def s12():
        ir(pg, "/admin/apariencia", 2200)
        titulo(pg, "12 · Apariencia: colores con maqueta en vivo", 2.5)
        colores = pg.query_selector_all("input[type=color]")
        original = colores[0].input_value() if colores else "#1f4d3f"
        print("  color primario original:", original, flush=True)
        if colores:
            colores[0].fill("#F5D76E")
            pg.wait_for_timeout(1600)
            titulo(pg, "La maqueta reacciona al instante, sin guardar", 2.5)
        titulo(
            pg,
            "Ese primario claro vuelve ilegible el texto: lo guardamos y publicamos",
            3,
        )
        pg.click("button:has-text('Guardar')")
        pg.wait_for_timeout(2000)
        pg.click("button:has-text('Publicar')")
        pg.wait_for_timeout(2500)
        avisos = [
            e.inner_text() for e in pg.query_selector_all(".apariencia__contraste-item")
        ]
        print("  avisos:", avisos[:4], flush=True)
        bajar(pg, 3, 500)
        titulo(pg, "El panel avisa cuando el contraste no llega a 4.5:1", 3)
        subir(pg, 3, 500)
        titulo(pg, "Restauramos el color original de la institución", 2.5)
        colores = pg.query_selector_all("input[type=color]")
        if colores:
            colores[0].fill(original)
        pg.wait_for_timeout(800)
        pg.click("button:has-text('Guardar')")
        pg.wait_for_timeout(1800)
        pg.click("button:has-text('Publicar')")
        pg.wait_for_timeout(2500)
        titulo(pg, "Vuelta a la paleta original", 2)

    paso("apariencia", s12)

    # --------------------------------------------------------------- seguridad
    def s13():
        ir(pg, "/admin/paginas", 1500)
        titulo(pg, "13 · Cerrar sesión desde el avatar del panel", 2.5)
        raton(pg, ".admin-avatar")
        pg.click(".admin-avatar")
        pg.wait_for_timeout(2000)
        titulo(pg, "La sesión muere también en el servidor, no solo en el navegador", 3)
        ir(pg, "/admin/paginas", 1800)
        titulo(pg, "Intentar volver al panel sin sesión devuelve al login", 2.5)

    paso("re-login", s13)

    # ------------------------------------------------------- cierre en público
    def s14():
        titulo(pg, "14 · El sitio, tal como lo ve un visitante", 2.5)
        ir(pg, "/contacto", 2200)
        bajar(pg, 5)
        titulo(pg, "Formulario de contacto publicado", 2.5)
        formulario = pg.query_selector("form")
        if formulario:
            formulario.scroll_into_view_if_needed()
        for nombre, valor in (
            ("nombre", "Ana Prueba"),
            ("correo", "ana@ejemplo.test"),
            ("telefono", "999888777"),
            ("asunto", "Consulta sobre matrícula"),
            ("mensaje", "Quisiera información sobre la matrícula y los horarios."),
        ):
            campo = pg.query_selector(f"[name={nombre}]")
            if campo:
                campo.fill(valor)
                pg.wait_for_timeout(220)
        pg.wait_for_timeout(800)
        titulo(pg, "Un visitante envía el formulario", 2.5)
        enviar = pg.query_selector("button[type=submit]")
        if enviar:
            enviar.click()
        pg.wait_for_timeout(3000)
        titulo(pg, "Mensaje enviado correctamente", 3)
        subir(pg, 6)

    paso("formulario público", s14)

    def s15():
        ir(pg, "/", 2000)
        titulo(pg, "15 · Fin del recorrido: CMS Angular 21 + PHP 8.1 + MariaDB", 4)
        bajar(pg, 4)

    paso("cierre", s15)

    ctx.close()
    navegador.close()
    print("VIDEO:", os.listdir(SALIDA), flush=True)
