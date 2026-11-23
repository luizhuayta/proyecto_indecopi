# Spec — Diseño Peruano Canadiense sobre la plantilla Indecopi

**Fecha:** 2026-11-21 · **Estado:** aprobado con decisiones del dueño (2026-11-21): módulo de noticias completo, Poppins por defecto, 5 paletas de PC en el panel, ejecución por fases con pausa y capturas entre fases.
**Referencia visual y de código:** `referencia-diseno-pcanadiense/` (DISENO.md, GUIA-ADAPTACION-INDECOPI.md, capturas/, codigo/)

## 1. Objetivo

Que el portal público y el panel (CMS) de la plantilla Indecopi tengan la
**estructura y el lenguaje visual** del portal IESPP Peruano Canadiense (PC),
sin perder lo que la plantilla ya hace mejor: colores, tipografías, logo y
contenido elegibles por la institución desde el panel, bloques editables,
borrador/publicación, contraste AA garantizado.

## 2. Principios (no negociables)

1. **Estructura de PC, color de la institución.** Ningún hex de marca en el
   CSS. Todo lee `var(--color-*)`; los tonos derivados se calculan con
   `color-mix()` en propiedades normales (no dentro de custom properties).
2. **Todo editable desde el CMS.** Cada sección nueva de la portada es un
   bloque del catálogo (`cms/blocks.json`) o un dato de Apariencia.
3. **Mínimo código nuevo (Ponytail).** Reestilizar los 21 bloques existentes
   antes que crear nuevos; solo 2 bloques nuevos (`accesos`, `novedades`) y un
   módulo nuevo (`noticias`, siguiendo el patrón de `mensajes`).
   Sin dependencias npm ni Composer nuevas. Sin CDN de terceros.
4. **Nunca recortar:** escape de HTML en el render, `urlSegura()`/`hrefValido()`
   en todo enlace, contraste AA, `prefers-reduced-motion`, foco visible,
   navegación por teclado, pausa en todo carrusel automático (WCAG 2.2.2).
5. **Contrato estable:** no cambiar `slug`, `version`, `contenido`, `items`;
   los documentos guardados con los esquemas viejos siguen renderizando
   (campos nuevos opcionales con default).

## 3. Mapeo de roles de color

| Rol PC | Token Indecopi |
|---|---|
| Estructura (héroes, pie, enlaces, foco) | `--color-primario` / `--color-primario-fuerte` |
| Acción en **relleno** (franja, botones, borde del pie) | `--color-acento-relleno` **(nuevo)** + `--color-acento-texto` |
| Acción en **texto** (antetítulos, subrayados finos) | `--color-acento` (ya ajustado a AA) |
| Superficies alternas | `--color-superficie`, `--color-lavado` |

`--color-acento-relleno` = el acento publicado sin ajustar; `--color-acento-texto`
se recalcula contra él (blanco o negro, el que dé ≥4.5:1).

## 4. Alcance — sitio público

| Pieza PC | Implementación |
|---|---|
| Poppins en todo | Woff2 autohospedados + `FONTS_DEFECTO` = Poppins (Source Serif 4 / IBM Plex siguen disponibles) |
| Iconos (Font Awesome) | Sprite SVG propio `public/iconos.svg` (subconjunto Lucide, MIT) + lista blanca `cms/iconos.ts` |
| Franja de plataformas | Apariencia `accesos[]` {nombre, url, icono} → franja en el marco |
| Navbar sticky + 2 CTA | Apariencia `botones_cabecera[]` (máx. 2) {texto, url, estilo: principal|contorno} |
| Hero carrusel | Bloque `hero` reestilizado + `cta2/cta2Link` + crossfade con pausa (`hero-carrusel.ts`) |
| Barra de cifras | Bloque `stats` reestilizado + `tag`, `title`, icono por cifra |
| Transparencia y gestión | **Bloque nuevo `accesos`**: grupos de tarjetas/enlaces con icono |
| Otros servicios | `serviceCards` reestilizado (tarjeta horizontal con foto) |
| Actualidad | **Módulo `noticias`** (tabla, API, panel) + **bloque `novedades`** que muestra las últimas noticias y comunicados publicados |
| Noticias | Páginas públicas `/noticias` (listado con buscador y filtro) y `/noticias/:slug` (detalle), en sitemap y en la búsqueda |
| Carrusel de logos | `entidades` reestilizado como marquesina (pausa al pasar el cursor; estático con movimiento reducido) |
| Hero interior | `pageHero`/`listingHero` reestilizados; el h1 duplicado se oculta visualmente cuando la página abre con un héroe |
| Pie | Marco: fondo estructural oscuro, borde superior de acento 4 px, columnas con subrayado |
| WhatsApp flotante | Apariencia `whatsapp` (solo dígitos) → botón flotante `wa.me` |
| Panel de accesibilidad | Componente propio: texto grande, alto contraste, resaltar enlaces, detener animaciones, fuente legible, espaciado (localStorage) |
| Movimiento | `appReveal` en cada bloque público; view transitions ya activas |

## 5. Alcance — CMS

| Pieza PC | Implementación |
|---|---|
| Sidebar oscuro con marca, grupos e iconos, plegable a riel, cajón en móvil | `AdminShell` + `_componentes.scss` (oscuro derivado del primario) |
| Topbar: antetítulo «CENTRO ADMINISTRATIVO / sección», título, fecha, indicador de sesión, modo claro/oscuro, menú de usuario | `AdminShell` |
| Barra de herramientas: miga de pan + accesos + «Guía del módulo» | `AdminShell` + `admin/guias-admin.ts` |
| Tarjetas, tablas cebra, etiquetas píldora, botones, pestañas, campos, avisos, estados vacíos | Reestilo de las clases `admin-*` existentes |
| 5 paletas del panel (rojo, azul, celeste, naranja, amarillo) | `[data-paleta]` en `.admin-shell`, elegida en «Mi cuenta», guardada en este navegador; valores ajustados a AA |
| Modo oscuro del panel | `[data-modo="oscuro"]` en `.admin-shell`, preferencia en localStorage |
| Gestión de noticias y comunicados | Pantalla `/admin/noticias`: tabla con portada, buscador, filtros, editor con vista previa; el editor redacta, solo el administrador publica y elimina |
| Login partido | `AdminLogin`: panel de marca (degradado del primario + logo + nombre) + tarjeta |
| Editor en 2 columnas con vista previa | Reestilo de `page-editor` (barra studio, tarjeta de vista previa, inspector) |

**Decisión del dueño:** el panel usa las 5 paletas fijas de PC (por defecto
«rojo institucional»), independientes del color del sitio público; la vista
previa del editor sigue mostrando los colores reales del sitio. Los tonos de
celeste, naranja y amarillo se oscurecen lo justo para que el texto blanco de
los botones cumpla 4.5:1 (PC no lo cumplía).

## 6. Fuera de alcance (explícito)

- Chatbot de PC (específico del producto).
- Noticias multilingües (el portal es solo `es`).
- Fotos institucionales (las aporta el dueño desde Medios).

## 7. Criterios de aceptación

- Con `color_primario=#153d68`, `color_acento=#ff6600` y la plantilla
  «Portada», la home a 1440 px reproduce la secuencia y jerarquía de
  `referencia-diseno-pcanadiense/capturas/publico/inicio.png`.
- Cambiar los dos colores en Apariencia recolorea franja, héroes, cifras,
  botones, pie y panel sin tocar código, y el contraste sigue ≥4.5:1.
- Frontend: todas las pruebas Vitest en verde (base actual: 25 archivos,
  125 pruebas) + las nuevas; `tsc --noEmit` y `ng build` sin errores.
- API: suite propia en verde con las pruebas nuevas de apariencia.
- Teclado, foco visible, `prefers-reduced-motion` y móvil 390 px verificados.
