# Guía de adaptación — diseño Peruano Canadiense → proyecto Indecopi

Cómo trasladar el look & feel documentado en `DISENO.md` al frontend de
`proyecto_indecopi-master`. Los dos proyectos son **Angular 21 standalone**,
así que el trabajo es re-expresar el sistema visual, no reescribir lógica.

---

## 1. Diferencias estructurales a tener en cuenta

| Aspecto          | Peruano Canadiense (origen)                    | Indecopi (destino)                                     |
| ---------------- | ---------------------------------------------- | ------------------------------------------------------ |
| Estilos          | Tailwind 3 + vars `--inst-*`/`--adm-*`         | SCSS global por capas (`_tokens`, `_fuentes`, `_marco`, `_componentes`) con vars `--color-*`, sin Tailwind |
| Sitio público    | ~24 páginas-feature fijas (`features/*`)        | Una sola `portal-publico` que renderiza **bloques CMS** (`cms/blocks/render-bloque.ts`) + `buscar` |
| Marco público    | `HeaderComponent` + `FooterComponent` separados | `.marco` + `app-marco-portal` (cabecera+pie en `_marco.scss`) |
| Tipografía       | Poppins para todo (Google Fonts CDN)           | Source Serif 4 (títulos) + IBM Plex Sans (cuerpo), **autohospedadas** en `public/fonts` |
| Kit UI           | Directivas CVA `appButton`/`appInput`          | Clases `.boton`, `.campo`, `.tarjeta`, bloques `.bloque` |
| CMS admin        | Panel completo con paletas, studio toolbar, live-preview | Panel más simple (`admin-shell`): páginas, editor, identidad, apariencia, medios, usuarios |
| Identidad        | Datos fijos en `core/constants`                | Tema publicable desde `admin-apariencia` (`temaPublico()` inyecta tokens en línea) |

**Implicación clave:** la página principal de Indecopi no son componentes
fijos sino **bloques del CMS**. El diseño de PC hay que portarlo como
(a) estilos del marco y (b) tipos de bloque nuevos/rediseñados.

---

## 2. Mapeo de color — estructura, no valores quemados

**Premisa clave:** la plantilla de Indecopi es color-agnóstica
(`core/tema.ts`: `temaPublico()` publica `--color-*` en línea, deriva
superficies suaves y sombras con `color-mix` y corrige el contraste a
≥4.5:1). Por tanto NO se copian los hex de PC: se porta la **estructura**
y se cablea a los slots semánticos, y el dueño elige los colores desde
`admin-apariencia`.

PC usa **tres roles de color**; el modelo de Indecopi los cubre:

| Rol en el diseño PC                                    | Slot Indecopi          | Valor que reproduce el look PC |
| ------------------------------------------------------ | ---------------------- | ------------------------------ |
| Estructura: heroes azules, footer marino, enlaces, foco | `color_primario`       | `#153d68` (fuerte `#0d2a50`)    |
| Acción: franja superior, CTAs, subrayados, borde footer | `color_acento`         | `#ff6600`                       |
| Texto secundario gris-azulado                          | `color_secundario`     | `#6c6a74`                       |

⚠️ **No invertir el mapeo** (naranja→primario): haría los enlaces, el foco
y las superficies suaves salir naranjas y dejaría el acento azul — al
revés del diseño real.

Notas finas del mapeo:

- **Acento en texto:** el guardrail `legible()` de `tema.ts` oscurece el
  `#ff6600` cuando se usa como texto sobre blanco (a ~`#b84d05`, el mismo
  tono que PC ya usa en sus badges). Es una mejora de accesibilidad
  gratuita, no un defecto.
- **Texto sobre acento lleno:** PC pinta blanco sobre naranja (~2.9:1,
  no llega a AA). `temaPublico` ya decide blanco/negro según contraste —
  sobre naranja saldrá texto oscuro y AA conforme. Visualmente casi
  idéntico, mejor en accesibilidad.
- **Gradientes de héroe/stat-bar:** se derivan del primario con
  `color-mix` (paradas claro/medio/oscuro) en vez de los 3 azules
  quemados de PC. Si se necesita un extremo claro fijo (`#087bce`), se
  añade un token `--color-hero-claro` calculado en `tema.ts`, no en el
  CSS (ver comentario de `--color-lavado`: un `var()` dentro de una
  custom property se resuelve donde se declara).
- **Verde WhatsApp:** color de plataforma, no de marca → literal fijo
  `#25d366`, no entra al sistema de temas.
- **Tipografía Poppins:** `admin-apariencia` ya publica
  `tipografia_titulos`/`tipografia_cuerpo` como familia libre. Basta
  autohospedar Poppins woff2 (latin + latin-ext) en `public/fonts/`,
  registrar el `@font-face` en `_fuentes.scss`, y el dueño escribe
  «Poppins» en el panel → el look PC sin quemar la fuente.
- **Radios:** PC usa ~10 px en botones y 13–19 px en tarjetas (no
  píldora). `--radio-boton: 10px` cambia el carácter del botón principal;
  es el ajuste más visible, decidir si se adopta o se conserva la
  píldora de Indecopi.

Valores por defecto para el seeder/`COLORES_DEFECTO` si se quiere que la
plantilla *nazca* con el look PC:

```ts
color_primario: '#153d68', color_primario_fuerte: '#0d2a50',
color_secundario: '#6c6a74', color_acento: '#ff6600',
color_texto: '#44425a', color_texto_suave: '#6c6a74',
color_fondo: '#ffffff', color_superficie: '#f2f1f8', color_borde: '#e2e1ec',
tipografia_titulos/cuerpo: "'Poppins', system-ui, sans-serif"
```

---

## 3. Piezas a portar (origen → destino sugerido)

| Pieza PC                                       | Dónde vive en origen                                      | Destino en Indecopi                                           |
| ---------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------- |
| Franja naranja de plataformas (EVA/Aula/Biblioteca) | `shared/header/header.component.*` (`.side-buttons`)   | `_marco.scss` + `marco-portal.ts`, sobre `.cabecera`          |
| Navbar sticky blanco + 2 CTA (Admisión/Transparencia) | mismo (`navbar`, `.btn-admision`, `.btn-transparencia`) | `.cabecera`/`cabecera__acciones` en `_marco.scss`             |
| Hero con carrusel + overlay + eyebrow + CTA vidrio | `features/inicio/components/hero/*`                    | Nuevo tipo de bloque `hero` en `cms/blocks/` o sección fija en `portal-publico` |
| Barra de cifras azul con tiles de vidrio        | `shared/components/stat-bar/*`                           | Nuevo bloque `cifras`/`stat-bar`                               |
| Grid «Transparencia y Gestión» (3 grupos de link-cards) | `features/inicio/components/gestion/*`            | Nuevo bloque `enlaces`/`grid-accesos`                          |
| Panel editorial noticias + comunicados        | `features/inicio/components/actualidad/*`              | Nuevo bloque `actualidad` (o dos: `noticias` + `comunicados`) |
| Carrusel de logos                              | `features/inicio/components/logos-carousel/*`          | Nuevo bloque `logos`                                           |
| Footer marino con borde naranja 4 px + sociales | `shared/footer/*`                                       | `.pie` en `_marco.scss`                                        |
| Page-hero interior (degradado azul + aro + puntos) | `shared/components/page-hero/*`                     | Estilo para el bloque `hero` de páginas internas               |
| WhatsApp flotante + chatbot + widget accesibilidad | `shared/components/floating-whatsapp`, `chatbot`, `components/accessibility` | Componentes en `shared/public/` + montaje en `portal-publico` |
| Scroll-reveal `appReveal`                       | `core/` (directiva)                                      | **Ya existe equivalente:** `shared/public/public-reveal.ts` — ajustar umbrales (18 px, 0.6 s, easing PC) |
| View Transitions (fade 300/500 ms)              | `styles.css` + router `withViewTransitions`             | `app.config.ts` + `styles.scss`                                |
| Suite accesibilidad `body.ae-*`                  | `styles.css` + `components/accessibility`              | Portar clases tal cual; widget propio                          |

### Admin (si también se quiere el look del CMS de PC)

| Pieza                          | Origen                                  | Nota para Indecopi                                       |
| ------------------------------ | --------------------------------------- | -------------------------------------------------------- |
| Tokens + 5 paletas + modo oscuro | `admin/admin-tokens.css`              | `_tokens.scss` o nueva capa `_admin.scss`; Indecopi ya tiene `admin-apariencia` — conectar sus vars |
| Base de componentes admin      | `admin/admin-base.css`                  | Traducir a SCSS dentro de `_componentes.scss` (sección admin ya existe) |
| Sidebar oscuro colapsable       | `admin/sidebar/*`                      | Adaptar `admin/admin-shell.ts`                           |
| Studio topbar + toolbar + guía  | `admin/admin-layout/*`                 | Igual                                                    |
| Editor dos columnas con preview | `admin/contenido/*` + `.gestion-live-grid` en `styles.css` | `admin/page-editor.ts` ya tiene editor+preview — restilar |
| Login split-screen              | `admin/login/*`                        | `admin/admin-login.ts`                                   |

---

## 4. Orden de trabajo sugerido

1. **Fuentes** (`_fuentes.scss`, `public/fonts/`, `index.html`):
   autohospedar Poppins woff2 + `@font-face`; el dueño lo activa desde
   apariencia sin tocar código.
2. **Tokens derivados** (`tema.ts`, `_tokens.scss`): añadir lo que PC
   necesita y el modelo no tiene (gradiente de héroe, tile de stat,
   anillo decorativo) siempre con `color-mix` del primario/acento
   publicado — nada de hex quemados.
3. **Marco** (`_marco.scss`, `marco-portal.ts`): franja de plataformas,
   navbar sticky con dos CTA, footer estructural con borde de acento
   4 px — todo leyendo `var(--color-*)`.
4. **Portada**: replicar la secuencia hero → cifras → gestión → otros
   servicios → actualidad → logos, como bloques nuevos o secciones fijas
   en `portal-publico` mientras no existan en el CMS.
5. **Interiores**: estilo `.page-hero` para heroes de página.
6. **Flotantes y accesibilidad**.
7. **Motion**: ajustar `public-reveal` a los parámetros PC + view
   transitions.
8. **Admin** (opcional/fase 2): paletas + base CSS + sidebar/topbar.

## 5. Verificación

- Comparar con `capturas/` a igual viewport (1440 px).
- `npm run build` y `npm test` (vitest) en `frontend/`.
- Revisar `prefers-reduced-motion`, `:focus-visible` y móvil 390 px —
  PC los trata con mimo y es parte de su diseño, no opcional.
- Fuentes: confirmar con `document.fonts` que Poppins carga (lección
  documentada en `_fuentes.scss`: los tokens «mentían» sin los archivos).

---

## 6. Estado del porte (ejecutado, nov-2026)

Lo sugerido en §3 aterrizó así — donde difiere, la decisión quedó mejor
que la propuesta inicial:

| Pieza PC | Resultado final |
|---|---|
| Franja de plataformas | `Apariencia.accesos[]` (máx. 6, con icono del sprite) → `.franja` en `marco-portal.ts`, fondo `--color-acento-relleno` |
| Navbar + 2 CTA | `Apariencia.botones_cabecera[]` (máx. 2, `principal`/`contorno`) → `.cabecera__botones`; en móvil se pliegan con el menú |
| Hero carrusel | Bloque `hero` existente reestilizado (`heroEspecial`): crossfade, veladura `--color-primario-fuerte`, `cta2`, controles con pausa y puntos (`hero-carrusel.ts`, WCAG 2.2.2) |
| Barra de cifras | Bloque `stats` existente reestilizado (`statsEspecial`): `tag`/`title` nuevos, icono por cifra de la lista blanca, placas translúcidas sobre degradado del primario |
| «Transparencia y gestión» | **Bloque nuevo `accesos`** (grupos de tarjetas con icono/título/descripción, una destacada) |
| Actualidad | **Módulo `noticias` completo** (tabla, API con roles editor/admin, sitemap y búsqueda) + **bloque nuevo `novedades`** + páginas `/noticias` y `/noticias/:slug` — más que el bloque fijo sugerido |
| Carrusel de logos | Bloque `entidades` existente → marquesina CSS (pausa en hover/focus, quieta con reduced-motion) |
| Footer | `.pie` reestilizado: fondo estructural, borde de acento 4 px, marca, columnas, base |
| Page-hero interior | `pageHero`/`listingHero` reestilizados (banda estructural con trama y forma); el h1 queda `sr-only` cuando la página abre con héroe |
| WhatsApp | `Apariencia.whatsapp` (8–15 dígitos) → `.whatsapp-flotante` `wa.me` |
| Widget accesibilidad | `shared/public/panel-accesibilidad.ts`: 6 ajustes `pa-*` persistentes; mejor que `body.ae-*` porque cuelga de `<html>` y no pisa clases ajenas |
| Scroll-reveal | `appReveal` en cada bloque en modo lectura (18 px, 0.6 s, curva PC); solo con scripting y sin reduced-motion |
| Poppins | Autohospedada (woff2 400–800 latin/latin-ext), `FONTS_DEFECTO` = Poppins — no opción sino defecto (decisión del dueño) |
| Chatbot | **Fuera de alcance** (específico del producto PC) |

Admin (§3, «opcional»): también portado — sidebar oscuro plegable con
marca y grupos, topbar (antetítulo, fecha, sesión, modo, cuenta),
toolbar con migas y «Guía del módulo» (`guias-admin.ts`), 5 paletas
fijas (`[data-paleta]`, ajustadas a AA — celeste/naranja/amarillo se
oscurecieron lo justo para 4.5:1), modo oscuro (`[data-modo]`, tonos
derivados con `color-mix`), login partido y editor studio en dos
columnas. Las paletas son fijas e independientes del sitio, por decisión
del dueño; la vista previa del editor sigue mostrando los colores reales
del portal.

Capturas del resultado: `capturas/resultado/fase-final/` (comparación
lado a lado incluida).
