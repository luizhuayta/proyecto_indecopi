# Referencia de diseño — IESPP Peruano Canadiense

Captura completa del sistema visual del portal **peruano-canadiense-web**
(Angular 21 + Tailwind 3 + variables CSS + kit UI propio con CVA), tanto del
**sitio público** como del **panel administrativo (CMS)**.

El objetivo de esta carpeta es servir como **fuente de verdad visual y de
código** para replicar ese diseño en la página principal del proyecto
Indecopi (`../frontend`).

---

## Contenido

```
referencia-diseno-pcanadiense/
├── README.md                     ← este archivo
├── DISENO.md                     ← especificación completa del sistema visual
├── GUIA-ADAPTACION-INDECOPI.md   ← cómo aplicar este diseño en proyecto_indecopi
├── capturas/
│   ├── publico/                  ← pantallas del sitio público (1440px + móvil)
│   └── admin/                    ← pantallas del CMS (1440px)
└── codigo/
    ├── CLAUDE.md                 ← guía de arquitectura del proyecto origen
    ├── cms-local-y-backend-node.md
    ├── plan-backend-cms.md
    ├── config/                   ← tailwind.config.js, angular.json, package.json, tsconfig
    └── src/
        ├── index.html            ← fuentes (Poppins), Font Awesome, CSP
        ├── styles.css            ← tokens --inst-*, resets, accesibilidad, animaciones
        ├── environments/         ← config de entorno (api remota vs local)
        └── app/                  ← aplicación Angular completa (sin respaldos)
            ├── admin/            ← CMS: layout, sidebar, módulos, tokens y base CSS
            ├── core/             ← constantes (semilla de contenido), stores, guards, api
            ├── features/         ← páginas públicas (inicio, nosotros, programas, …)
            └── shared/           ← header, footer, UI kit, componentes transversales
```

> Nota: se excluyó `src/app/admin-con-fallo-20261022-112018/` (respaldo roto de
> una migración anterior) y `public/assets` (fotos institucionales ~23 MB,
> específicas del colegio, no parte del sistema de diseño).

## Cómo se capturó

- **Fecha:** 21-nov-2026.
- **Servidor:** `ng serve` del Frontend (`localhost:4200`), `useRemoteApi`
  temporalmente en `false` para poder entrar al CMS sin backend (los stores
  usan las semillas de `core/constants/` y `localStorage`; la app renderiza
  igual). Ya quedó restaurado a `true`.
- **Capturas:** Firefox headless `--screenshot` a 1440 px (desktop) y 390 px
  (móvil). Algunas pantallas del CMS aparecen a mitad de la animación de
  entrada — el diseño real se ve en `codigo/`.

## Stack del diseño origen

| Pieza            | Tecnología                                                    |
| ---------------- | ------------------------------------------------------------- |
| Framework        | Angular 21, standalone, signals, `OnPush`, rutas lazy          |
| Estilos          | Tailwind 3 (`darkMode: 'class'`) + variables `--inst-*`/`--adm-*` |
| Tipografía       | Poppins (Google Fonts); iconos Font Awesome 6.5 (CDN) + lucide  |
| UI kit           | Directivas `appButton`/`appInput` + `cva` + `cn()` (clsx+merge) |
| Editor CMS       | ngx-quill (rich text), CDK drag-drop, ng2-pdf-viewer            |
| Admin theming    | `data-paleta` (5 paletas) + `data-modo` (claro/oscuro)          |
| Motion           | `appReveal` (IntersectionObserver), View Transitions API        |

## Uso recomendado

1. Leer `DISENO.md` para entender el sistema (tokens, patrones, componentes).
2. Ver `capturas/` para el resultado visual real.
3. Copiar/adaptar piezas desde `codigo/src/app/` según la guía de adaptación.
