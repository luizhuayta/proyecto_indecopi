# Sistema de diseño — Portal IESPP Peruano Canadiense

Especificación del lenguaje visual del sitio público y del CMS, extraída del
código en `codigo/` y de las capturas en `capturas/`.

---

## 1. Identidad base

| Rasgo            | Valor                                                              |
| ---------------- | ------------------------------------------------------------------- |
| Carácter         | Institucional educativo, cálido, naranja + azul marino                |
| Tipografía       | **Poppins** para TODO (títulos, cuerpo, UI, admin). Pesos 300–800.    |
| Iconos           | Font Awesome 6.5 (`<i class="fa*">`), lucide-angular en partes nuevas |
| Idioma           | Español, sin i18n                                                    |
| Enfoque CSS      | Variables CSS de marca + Tailwind para espaciado/utilidad             |
| Radio base       | `--radius: 12px` (lg), −2 md, −4 sm; píldoras 999px para badges       |
| `color-scheme`   | Claro (admin tiene modo oscuro propio)                                |

---

## 2. Paleta del sitio público (`--inst-*`, `src/styles.css`)

```css
--inst-primary:        #ff6600   /* naranja marca: CTA, acentos, focus */
--inst-primary-hover:  #e65c00
--inst-primary-light:  #fff0e6   /* naranja lavado: hover fondos, badges */
--inst-primary-rgb:    255,102,0

--inst-dark:           #153d68   /* azul marino: footer, hamburguesa, textos fuertes */
--inst-dark-surface:   #12365e
--inst-dark-deep:      #0d2d50
--inst-secondary:      #f2f1f8   /* gris lavanda: secciones alternas */
--inst-surface:        #ffffff
--inst-text-heading:   #153d68   /* títulos */
--inst-text:           #6c6a74   /* cuerpo */
--inst-text-light:     #9a98a6   /* metadatos */
--inst-border:         #e2e1ec

--inst-blue-minedu:    #0052a3   /* sello/entorno regulatorio */
--inst-blue-stats:     #2173d1
--inst-blue-navy:      #213f77
--inst-whatsapp:       #25d366

--inst-gradient:        linear-gradient(135deg,#153d68 0%,#12365e 50%,#ff6600 120%)
--inst-gradient-orange: linear-gradient(135deg,#ff6600 0%,#ff8533 100%)
```

**Ojo — desvío de marca real:** partes del header/hero usan literales
`#f46a0b`, `#ff6900`, `#ff6508` en vez del token. Canonizar a `#ff6600` al
portar, salvo que se quiera replicar pixel-perfect.

Equivalentes Tailwind (`tailwind.config.js`): `primary` `#FF6600`,
`primary-hover` `#E65C00`, `primary-light` `#FFF0E6`, `dark` `#44425A`
(heredado, no coincide con `--inst-dark`), `secondary`/`muted` `#F2F1F8`,
`minedu`, `stats`, `whatsapp`, `destructive` `#DC2626`.

### Gradientes con nombre propio

| Superficie            | Gradiente                                                                 |
| --------------------- | ------------------------------------------------------------------------- |
| Hero portada          | `linear-gradient(90deg, rgba(7,30,62,.84) → rgba(8,35,69,0))` sobre foto    |
| Hero interior `.page-hero` | `linear-gradient(112deg,#0d4677,#1266a8 65%,#087bce)` + aro radial + puntos |
| Barra de cifras       | `linear-gradient(112deg,#103b70,#125a9e 52%,#1674c3)` + textura de puntos   |
| Login aside           | foto + `linear-gradient(158deg, rgba(48,46,66,.95) → rgba(185,28,43,.42))`  |

---

## 3. Sitio público — anatomía de la portada (`/inicio`)

Orden real de secciones (ver `capturas/publico/inicio.png`):

1. **Franja de plataformas** `.side-buttons` — barra naranja sólida
   `#f46a0b`, 32–48 px, enlaces con ícono blanco invertido (EVA, Aula
   virtual, Biblioteca). Alineada a la derecha en desktop; se apila en
   ≤650 px. Vive dentro del `HeaderComponent`.
2. **Navbar** `.navbar` — sticky `top:0`, fondo blanco, sombra
   `0 4px 20px rgba(43,41,61,.08)`, padding `16px 48px`, logo 240 px.
   Menú horizontal: enlaces `#303b56` bold 14 px, activo = texto naranja
   `#ff6508` + subrayado de 3 px; hover = fondo `#fff0e7` + texto naranja.
   Dos CTA a la derecha: **Admisión** (relleno naranja) y
   **Transparencia** (outline oscuro). Breakpoint hamburguesa < 992 px:
   botón oscuro `var(--inst-dark)` con icono blanco que se vuelve naranja.
3. **Hero** `.hero` — `min-height: 490–520px`, carrusel de fotos de fondo
   con crossfade `opacity 1s`, overlay degradado marino→transparente de
   izquierda a derecha, contenido `max-width:600px` a la izquierda:
   - Eyebrow automático vía `::before`: «FORMACIÓN DOCENTE · EDUCACIÓN
     SUPERIOR» en chip translúcido borde `rgba(255,255,255,.4)`, radio 30px.
   - `h1` blanco `clamp(2.5rem,3.1vw,3.35rem)` peso 800, `text-wrap:balance`.
   - Subtítulo `clamp(1.25rem,1.5vw,1.55rem)` color `#f2f6ff`.
   - CTA cards: `.btn-card.carreras` naranja lleno + `.btn-card.licencia`
     vidrio oscuro `rgba(15,43,79,.65)` + `backdrop-filter:blur(5px)`;
     hover `translateY(-2px)`; la segunda abre una mini-foto emergente
     (`.licencia-popup`) a su derecha.
4. **Barra de cifras** `.stat-bar` — degradado azul triple + textura de
   puntos radiales enmascarada. Chip «PERIODO ACADÉMICO …» + título
   `clamp(1.65rem,2.6vw,2.25rem)` + grid de 5 `.stat-item` translúcidos
   (`rgba(255,255,255,.075)`, borde `.2`, radio 17px): ícono en tile de
   42 px, número `clamp(2rem,2.7vw,2.6rem)` peso 800 `tabular-nums`, label
   .85 rem. Hover: sube 3 px y aclara borde. ≤980 px → 3 cols, ≤620 px → 2.
5. **«Transparencia y Gestión Institucional»** `.gestion-section` — título
   grande + 3 grupos con subtítulos `.gestion-heading` (barra vertical
   naranja a la izquierda): tarjetas destacadas (ícono + título + descripción)
   y listas de enlaces con íconos FA. Cada tarjeta anima con `appReveal`
   escalonado (`[appRevealDelay]` +70 ms).
6. **«Otros servicios»** — eyebrow «EXPLORA MÁS» + título + link
   «Explorar programas →»; cards horizontales con foto a la izquierda.
7. **Actualidad** `.actualidad-section` — eyebrow azul + H2 + enlace
   «Ver todas». Grid `1.85fr | .8fr`: panel de noticias (destacada con
   foto 245 px + columna de titulares con miniaturas 70×65) y panel de
   comunicados `.feat--com` con borde lateral naranja 3 px.
8. **Carrusel de logos** — logos institucionales en marquesina infinita.
9. **Footer** `.site-footer` — fondo `var(--inst-dark)`, **borde superior
   naranja de 4 px**, padding `50px 24px 20px`. Grid auto-fit ≥220 px:
   bloque con logo sobre fondo blanco redondeado, columnas de enlaces
   (`rgba(255,255,255,.8)`, hover naranja), títulos `h4` con subrayado
   naranja corto `::after 30×2`. Botones sociales circulares 40 px
   `rgba(255,255,255,.08)`→hover naranja. Barra inferior con copyright
   + crédito.
10. **Flotantes** — botón WhatsApp verde `#25D366` abajo-derecha, chatbot
    «EVA» naranja, widget de accesibilidad azul abajo-izquierda.

### Páginas interiores

- Hero compartido `.page-hero` (`shared/components/page-hero`): degradado
  azul `#0d4677→#087bce`, aro gigante `::after` (300 px, borde 48 px
  `rgba(87,170,255,.22)`), puntos decorativos, `h1` `clamp(2.3rem,4.1vw,4rem)`
  peso 850, subrayado final `::after` de 82×6 ` #40a4ff`, breadcrumbs
  blancos. Min-height 285 px.
- Patrón de servicio (`shared/styles/service-page.css`) y shell de visor
  de documentos (`viewer-shell.css`) reutilizados por todas las secciones.
- Tarjetas de contenido: fondo blanco, borde `var(--inst-border)`, radios
  13–19 px, sombras suaves `0 14px 36px rgba(16,53,95,.065)`.

### Kit UI (`shared/ui/`, estilo shadcn/spartan)

`appButton` con `cva`: variantes `default` (naranja), `secondary`,
`outline`, `dark`, `ghost`, `link`, `destructive`, `whatsapp`, `minedu`;
tamaños `default h-11`, `sm h-9`, `lg h-13`, `icon`. Mismo patrón para
`badge`, `card`, `input`, `dialog`, `alert`. Helper `cn()` = clsx +
tailwind-merge (`core/utils/cn.ts`).

### Movimiento y accesibilidad pública

- `appReveal`: `opacity 0 → translateY(18px)` con
  `cubic-bezier(.16,1,.3,1)` 0.6 s, delay por atributo; se desactiva con
  `prefers-reduced-motion` o sin JS (`@media (scripting: enabled)`).
- View Transitions: fade-out 300 ms / fade-in 500 ms en `root`.
- Skeletons `skeleton-shimmer` para carga de noticias.
- Suite de accesibilidad (clases `body.ae-*`): alto contraste
  (invertir + grayscale), cursor naranja grande SVG, resaltar
  enlaces/encabezados, texto grande 120%, espaciado, detener animaciones,
  ocultar imágenes, fuente dislexia (Arial). Panel propio excluido de los
  filtros. Se administra desde `/admin/accesibilidad`.

---

## 4. CMS `/admin` — sistema visual propio

Dos capas de tokens:

- **`admin-tokens.css`** — variables `--adm-*` bajo `.admin-shell`.
- **`admin-base.css`** — componentes base scoped a `.admin-shell`
  (no usan Tailwind, todo es CSS clásico).

### Tokens admin

```css
--adm-brand:      var(--inst-primary)      /* acento = paleta elegida    */
--adm-ink:        #292d3b   /* texto principal  */
--adm-ink-soft:   #64748b
--adm-surface:    #ffffff
--adm-bg:         #f7f6f8   /* fondo general    */
--adm-line:       #e2e8f0
--adm-ok/bg:      #16834b / #eafaf1
--adm-warn/bg:    #976c19 / #fff7e7
--adm-danger/bg:  #ad202e / #fcecee
--adm-muted/bg:   #526174 / #edf2f7
--adm-radius:     14px
--adm-shadow:     0 3px 18px rgba(28,44,68,.055)
--adm-sidebar-top/bottom: #292d3b / #191e2b
```

**5 paletas** conmutables (`data-paleta` en `.admin-shell`): `rojo` #b91c2b
(defecto/fallback), `azul` #24476b, `celeste` #238ac7, `naranja` #f26922,
`amarillo` #a67900 — cada una redefine `--inst-primary/-hover/-soft/-border`.
**Modo oscuro** independiente (`data-modo="oscuro"`): redefine todas las
superficies. Se elige en *Mi cuenta*; afecta solo al panel.

### Estructura (`admin-layout`)

```
.admin-shell (flex, min-h 100vh, fondo --adm-bg)
├─ app-admin-sidebar   ← riel fijo 260px (74px contraído / drawer móvil)
└─ .admin-body         ← margin-left:260px
   ├─ .admin-topbar.studio-topbar   (sticky, 76px, blanca)
   ├─ .studio-toolbar               (breadcrumb + acciones + guía)
   └─ .admin-main                   (padding 28px 32px; .admin-page max-w 1440px)
```

**Sidebar** (`.admin-sidebar`): degradado vertical `--adm-sidebar-top→bottom`,
logo «PC» en tile 40 px con degradado de marca + título «PANEL ADMIN» /
subtítulo. Enlaces 0.9 rem `rgba(255,255,255,.75)`, radio 10 px; indicador
`::before` barra izquierda que crece al hover (60%) y activo (70%); activo =
tinte de marca 17% + borde interno. Agrupado por `.nav-group-label`
(«PORTAL PÚBLICO», «PÁGINAS DE SERVICIO», «GESTIÓN»). Footer: «Ver portal
público» + «Cerrar sesión». ≥901 px fijo con colapso a riel 74 px; ≤900 px
drawer con scrim.

**Topbar**: hamburguesa (colapsa riel en desktop, abre drawer en móvil) +
overline «CENTRO ADMINISTRATIVO / {contexto}» + título + fecha +
`studio-session-indicator` (punto verde «Sesión administrativa») +
toggle sol/luna + `usermenu` (avatar iniciales en círculo oscuro, nombre,
rol, caret → popover con «Mi cuenta» y «Cerrar sesión»).

**Toolbar studio**: breadcrumb «Administración › {página}» + botones
`.studio-tool` (Contenido, Noticias, Ver página/portal en nueva pestaña,
«Guía del módulo» que abre `.studio-guide` — panel con borde izquierdo de
acento 4 px, pasos numerados y nota info).

### Componentes admin (`admin-base.css`)

| Clase                  | Diseño                                                                  |
| ---------------------- | ----------------------------------------------------------------------- |
| `.admin-card`          | superficie + línea + radius 14 + sombra suave; `:focus-within` tiñe borde |
| `.page-header`         | título `clamp(1.45rem,2vw,1.75rem)` peso 750 + `.page-sub` 0.84 rem muted |
| `.admin-table`         | th fondo `#f7f9fc` 0.76 rem muted; filas cebra al 42% bg; hover tinte 5% marca; `tabular-nums` |
| `.badge`               | píldora 999 px 0.72 rem: `-publicado` verde, `-borrador` ámbar, `-modificado` marca |
| `.btn-save/.btn-add`   | marca lleno, 42 px, radio 10; hover +sombra marca 22%                      |
| `.btn-cancel/.btn-ghost`| blanco borde línea, texto muted                                         |
| `.btn-danger`          | rojo `--adm-danger`                                                      |
| `.btn-icon`            | 36×36 cuadrado borde línea; `.btn-delete` rojo                             |
| `.btn-agregar`         | **dashed** tinte marca: «añadir elemento a lista»                         |
| `.admin-tabs`          | contenedor `#f0f3f8` radio 13; `.admin-tab.active` blanco + texto marca  |
| `.form-row`            | label 0.82 rem bold; inputs 44 px radio 10, focus borde marca + ring 16% |
| `.check-inline`        | checkbox 16 px `accent-color` marca                                      |
| `.dropzone`            | dashed línea, hover borde marca + fondo tinte                            |
| `.save-bar`            | sticky bottom con degradado transparente→fondo                           |
| `.empty-state`         | ícono en tile 48 px `--adm-muted-bg` + texto muted centrado              |
| `.toast`               | fijo top-right, `-ok` verde `-err` rojo                                   |
| `.modulo-tile`         | tarjeta-link del índice de contenido; hover sube 2 px + borde marca       |
| `.historial-item`      | fila clickable de versiones                                              |
| `.pdf-mini/.pdf-full`  | visor PDF embebido y modal a pantalla completa                           |
| `.ql-*`                | overrides de Quill snow a tokens admin                                   |

### Editor de contenido en vivo

Pantalla `.gestion-live-grid` = **dos columnas** (`1fr | 1.08fr`): a la
izquierda el formulario (`.live-editor-input`, scroll propio
`max-height: calc(100vh - 194px)`), a la derecha `app-gestion-preview`
con «VISTA PREVIA DEL BORRADOR», badge «sin cambios» y zoom de la página
pública real (75 %). ≤1350 px colapsa a una columna. Ver
`capturas/admin/editor-inicio.png`.

`styles.css` global contiene fixes específicos del `.page-header` dentro
del editor (header en grid 1fr auto con `.badge-modificado` y
`.btn-ghost` alineados).

### Login (`/admin/login`)

Split-screen `grid 1.05fr | 1fr`: panel izquierdo con foto + degradado
marino→rojizo + logo badge blanco + claim; panel derecho con card 384 px,
radio 20, animación `login-rise` (sube 14 px). ≤880 px: una columna, la
card se solapa −56 px sobre el panel. Hint ámbar cuando el backend no
responde. Ver `capturas/admin/login.png`.

---

## 5. Responsivo y convenciones

| Breakpoint | Efecto principal                                                        |
| ---------- | ----------------------------------------------------------------------- |
| ≤480/620px | stat-grid 2 cols; hero compacto; side-buttons apilados                    |
| ≤768px     | hero sin popup de licencia; page-hero sin puntos decorativos              |
| ≤880px     | login a una columna                                                      |
| ≤900px     | sidebar = drawer + scrim; admin grids a 1 columna                          |
| ≤992px     | navbar → hamburguesa + panel flotante 280 px                               |
| ≤1350px    | editor en vivo a una columna                                              |

- `prefers-reduced-motion`: TODAS las animaciones/transiciones se anulan.
- `:focus-visible` global: outline 3 px `--inst-primary` (admin: 2 px marca).
- `::selection`: fondo `--inst-primary-light`.
- Scrollbars finos (`scrollbar-width: thin`) en sidebar y paneles.
- Nombrado de clases: BEM suelto en componentes nuevos (`.feat__media`),
  plano histórico en heredados (`.menu li a`); CSS de admin bajo
  `.admin-shell`; tokens `--inst-*` público, `--adm-*` panel.
- Comentarios en español explicando el *porqué* del estilo (mismo estilo
  que ya usa `_tokens.scss` de Indecopi).

## 6. Inventario de capturas

**Público** (`capturas/publico/`): `inicio.png` (desktop 1440×2400),
`inicio-movil.png` (390×844), `nosotros`, `programas`, `admision`,
`noticias`, `transparencia`, `servicios`, `mesa-de-partes`.

**Admin** (`capturas/admin/`): `login` (split-screen), `dashboard`
(sidebar + topbar + toolbar), `contenido` (grid de módulos),
`editor-inicio` (editor + vista previa en vivo), `noticias` (tabla +
badges), `documentos`, `programas`, `usuarios`, `mesa-partes`,
`mi-cuenta` (selector de paleta).
