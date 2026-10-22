import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CmsApiService } from '../cms/cms-api.service';
import { getByPath, setByPath, JsonMap } from '../cms/cms.models';
import { contraste, normalizarHex, sugerirContraste } from '../core/contraste';
import { COLORES_DEFECTO, FONTS_DEFECTO } from '../core/tema';

interface CampoColor {
  key: string;
  label: string;
}

interface AvisoContraste {
  mensaje: string;
  sugerido: string;
}

interface Red {
  nombre: string;
  url: string;
}

const CAMPOS_COLOR: CampoColor[] = [
  { key: 'color_primario', label: 'Color primario' },
  { key: 'color_primario_fuerte', label: 'Primario fuerte' },
  { key: 'color_secundario', label: 'Secundario' },
  { key: 'color_acento', label: 'Acento' },
  { key: 'color_texto', label: 'Texto' },
  { key: 'color_texto_suave', label: 'Texto suave' },
  { key: 'color_fondo', label: 'Fondo' },
  { key: 'color_superficie', label: 'Superficie' },
  { key: 'color_borde', label: 'Borde' },
];

/**
 * Apariencia del sitio: colores, tipografías, logo, pie, contacto y redes.
 * Los colores se editan con un campo de texto hexadecimal y un selector de
 * color nativo sincronizados; la maqueta de la cabecera muestra el efecto al
 * instante usando las variables CSS del tema, y se avisa cuando un color no
 * cumple 4.5:1 de contraste (el texto nunca se pinta sobre el primario).
 */
@Component({
  selector: 'app-admin-apariencia',
  standalone: true,
  template: `
    <header>
      <h1 class="admin-titulo">Apariencia</h1>
      <p class="admin-subtitulo">
        Los colores, las tipografías y el logo de la institución. La maqueta muestra el efecto al
        instante, sin guardar.
      </p>
    </header>

    <div class="apariencia">
      <form class="apariencia__formulario" (ngSubmit)="guardar()">
        <section class="apariencia__seccion">
          <h2>Colores</h2>
          <div class="apariencia__colores">
            @for (c of CAMPOS_COLOR; track c.key) {
              <div class="color-campo">
                <label [for]="'color-' + c.key">{{ c.label }}</label>
                <div class="color-fila">
                  <input
                    [id]="'color-' + c.key"
                    class="color-hex"
                    type="text"
                    spellcheck="false"
                    [value]="colorDe(c.key)"
                    (input)="setColor(c.key, $any($event.target).value)"
                  />
                  <input
                    class="color-nativo"
                    type="color"
                    [value]="colorNormalizado(c.key)"
                    [attr.aria-label]="'Selector de color de ' + c.label"
                    (input)="setColor(c.key, $any($event.target).value)"
                  />
                  <span
                    class="color-muestra"
                    [style.background]="colorNormalizado(c.key)"
                    aria-hidden="true"
                  ></span>
                </div>
              </div>
            }
          </div>
        </section>

        @if (problemasContraste().length > 0) {
          <section class="apariencia__seccion apariencia__contraste" aria-label="Avisos de contraste">
            <h2>Contraste</h2>
            @for (p of problemasContraste(); track $index) {
              <p class="apariencia__contraste-item" role="alert">
                {{ p.mensaje }} Un valor que sí cumple es
                <code>{{ p.sugerido }}</code>.
              </p>
            }
          </section>
        }

        <section class="apariencia__seccion">
          <h2>Tipografía</h2>
          <div class="admin-campo">
            <label for="tipografia-titulos">Tipografía de títulos</label>
            <input
              id="tipografia-titulos"
              class="admin-control"
              type="text"
              [value]="str('tipografia_titulos')"
              (input)="setStr('tipografia_titulos', $any($event.target).value)"
            />
          </div>
          <div class="admin-campo">
            <label for="tipografia-cuerpo">Tipografía del cuerpo</label>
            <input
              id="tipografia-cuerpo"
              class="admin-control"
              type="text"
              [value]="str('tipografia_cuerpo')"
              (input)="setStr('tipografia_cuerpo', $any($event.target).value)"
            />
          </div>
        </section>

        <section class="apariencia__seccion">
          <h2>Logo y favicon</h2>
          <div class="admin-campo">
            <label for="logo-url">URL del logo</label>
            <input
              id="logo-url"
              class="admin-control"
              type="text"
              [value]="str('logo_url')"
              (input)="setStr('logo_url', $any($event.target).value)"
            />
          </div>
          <div class="admin-campo">
            <label for="logo-alt">Texto alternativo del logo</label>
            <input
              id="logo-alt"
              class="admin-control"
              type="text"
              [value]="str('logo_alt')"
              (input)="setStr('logo_alt', $any($event.target).value)"
            />
          </div>
          <div class="admin-campo">
            <label for="favicon-url">URL del favicon</label>
            <input
              id="favicon-url"
              class="admin-control"
              type="text"
              [value]="str('favicon_url')"
              (input)="setStr('favicon_url', $any($event.target).value)"
            />
          </div>
        </section>

        <section class="apariencia__seccion">
          <h2>Pie y contacto</h2>
          <div class="admin-campo">
            <label for="pie-legal">Texto legal del pie</label>
            <textarea
              id="pie-legal"
              class="admin-control"
              rows="3"
              [value]="str('pie_legal')"
              (input)="setStr('pie_legal', $any($event.target).value)"
            ></textarea>
          </div>
          <div class="admin-campo">
            <label for="correo-contacto">Correo de contacto</label>
            <input
              id="correo-contacto"
              class="admin-control"
              type="email"
              [value]="str('correo_contacto')"
              (input)="setStr('correo_contacto', $any($event.target).value)"
            />
          </div>
          <div class="admin-campo">
            <label for="telefono-contacto">Teléfono de contacto</label>
            <input
              id="telefono-contacto"
              class="admin-control"
              type="tel"
              [value]="str('telefono_contacto')"
              (input)="setStr('telefono_contacto', $any($event.target).value)"
            />
          </div>
        </section>

        <section class="apariencia__seccion">
          <h2>Redes sociales</h2>
          @for (red of redes(); track $index) {
            <div class="red">
              <div class="admin-campo red__nombre">
                <label [for]="'red-nombre-' + $index">Nombre</label>
                <input
                  [id]="'red-nombre-' + $index"
                  class="admin-control"
                  type="text"
                  [value]="red.nombre"
                  (input)="setRed($index, 'nombre', $any($event.target).value)"
                />
              </div>
              <div class="admin-campo red__url">
                <label [for]="'red-url-' + $index">URL</label>
                <input
                  [id]="'red-url-' + $index"
                  class="admin-control"
                  type="text"
                  [value]="red.url"
                  (input)="setRed($index, 'url', $any($event.target).value)"
                />
              </div>
              <div class="red__acciones">
                <button
                  type="button"
                  class="admin-btn admin-btn--fantasma"
                  (click)="moverRed($index, -1)"
                  [disabled]="$index === 0"
                  [attr.aria-label]="'Subir red ' + ($index + 1)"
                >
                  ↑
                </button>
                <button
                  type="button"
                  class="admin-btn admin-btn--fantasma"
                  (click)="moverRed($index, 1)"
                  [disabled]="$index === redes().length - 1"
                  [attr.aria-label]="'Bajar red ' + ($index + 1)"
                >
                  ↓
                </button>
                <button
                  type="button"
                  class="admin-btn admin-btn--fantasma admin-btn--peligro"
                  (click)="quitarRed($index)"
                  [attr.aria-label]="'Quitar red ' + ($index + 1)"
                >
                  Quitar
                </button>
              </div>
            </div>
          }
          <button type="button" class="admin-btn" (click)="agregarRed()">Agregar red</button>
        </section>

        @if (avisos().length > 0) {
          <section class="apariencia__seccion" aria-label="Avisos del servidor">
            @for (a of avisos(); track a.campo) {
              <p class="apariencia__contraste-item" role="status">{{ a.mensaje }}</p>
            }
          </section>
        }

        @if (error()) {
          <p class="admin-banner admin-banner--error" role="alert">{{ error() }}</p>
        }
        @if (status()) {
          <p class="admin-banner admin-banner--ok" role="status">{{ status() }}</p>
        }

        <div class="apariencia__acciones">
          <button type="submit" class="admin-btn" [disabled]="guardando() || publicando()">
            {{ guardando() ? 'Guardando…' : 'Guardar' }}
          </button>
          <button
            type="button"
            class="admin-btn admin-btn--primario"
            [disabled]="guardando() || publicando()"
            (click)="publicar()"
          >
            {{ publicando() ? 'Publicando…' : 'Publicar' }}
          </button>
        </div>
      </form>

      <aside class="apariencia__maqueta" aria-label="Vista previa de la cabecera">
        <p class="apariencia__nota">Vista previa</p>
        <div
          class="maqueta"
          [style.--color-primario]="colorDe('color_primario')"
          [style.--color-primario-fuerte]="colorDe('color_primario_fuerte')"
          [style.--color-secundario]="colorDe('color_secundario')"
          [style.--color-acento]="colorDe('color_acento')"
          [style.--color-texto]="colorDe('color_texto')"
          [style.--color-texto-suave]="colorDe('color_texto_suave')"
          [style.--color-fondo]="colorDe('color_fondo')"
          [style.--color-superficie]="colorDe('color_superficie')"
          [style.--color-borde]="colorDe('color_borde')"
          [style.--font-titulos]="fontTitulos()"
          [style.--font-cuerpo]="fontCuerpo()"
        >
          <div class="maqueta__cabecera">
            <span class="maqueta__logo">Logo</span>
            <span class="maqueta__nombre">Nombre de la institución</span>
            <nav class="maqueta__menu">
              <span>Inicio</span>
              <span>Programas</span>
              <span>Contacto</span>
            </nav>
          </div>
          <div class="maqueta__cuerpo">
            <p class="maqueta__regla"></p>
            <h1>Título de portada</h1>
            <p class="maqueta__texto">
              Una línea que explica qué es la institución y para quién.
            </p>
            <a class="maqueta__enlace" href="#" (click)="$event.preventDefault()">Ver programas</a>
            <p><button type="button" class="maqueta__boton" disabled>Botón principal</button></p>
            <p class="maqueta__acento">Aviso destacado con el acento.</p>
          </div>
        </div>
      </aside>
    </div>
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        gap: var(--space-16, 1rem);
      }
      .admin-titulo {
        margin: 0;
        font-family: var(--font-titulos, serif);
        font-weight: 600;
      }
      .admin-subtitulo {
        margin: 0;
        color: var(--color-texto-suave);
      }
      .apariencia {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(18rem, 24rem);
        gap: var(--space-24, 1.5rem);
        align-items: start;
      }
      @media (max-width: 900px) {
        .apariencia {
          grid-template-columns: 1fr;
        }
      }
      .apariencia__formulario {
        display: flex;
        flex-direction: column;
        gap: var(--space-16, 1rem);
      }
      .apariencia__seccion {
        display: flex;
        flex-direction: column;
        gap: var(--space-12, 0.75rem);
        border: 1px solid var(--color-borde);
        border-radius: var(--radio-tarjeta, 6px);
        padding: var(--space-16, 1rem);
      }
      .apariencia__seccion h2 {
        margin: 0;
        font-size: var(--texto-lg, 1.125rem);
      }
      .apariencia__colores {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: var(--space-12, 0.75rem);
      }
      @media (max-width: 640px) {
        .apariencia__colores {
          grid-template-columns: 1fr;
        }
      }
      .color-campo {
        display: flex;
        flex-direction: column;
        gap: var(--space-4, 0.25rem);
      }
      .color-campo label {
        font-size: var(--texto-sm, 0.875rem);
      }
      .color-fila {
        display: flex;
        align-items: center;
        gap: var(--space-8, 0.5rem);
      }
      .color-hex {
        flex: 1;
        min-width: 0;
        padding: 0.4rem 0.5rem;
        border: 1px solid var(--color-borde);
        border-radius: var(--radio-campo, 4px);
        background: var(--color-superficie);
        color: var(--color-texto);
        font: inherit;
        font-variant-numeric: tabular-nums;
      }
      .color-nativo {
        width: 2.5rem;
        height: 2.25rem;
        padding: 0;
        border: 1px solid var(--color-borde);
        border-radius: var(--radio-campo, 4px);
        background: none;
        cursor: pointer;
      }
      .color-muestra {
        width: 2.25rem;
        height: 2.25rem;
        border: 1px solid var(--color-borde);
        border-radius: var(--radio-campo, 4px);
        flex: none;
      }
      .color-hex:focus-visible,
      .color-nativo:focus-visible,
      .admin-control:focus-visible,
      textarea:focus-visible {
        outline: 2px solid var(--color-primario);
        outline-offset: 2px;
      }
      .apariencia__contraste {
        border-color: var(--color-acento);
      }
      .apariencia__contraste-item {
        margin: 0;
        font-size: var(--texto-sm, 0.875rem);
        color: var(--color-texto);
      }
      .apariencia__contraste-item code {
        font-variant-numeric: tabular-nums;
      }
      .red {
        display: grid;
        grid-template-columns: 1fr 1fr auto;
        gap: var(--space-8, 0.5rem);
        align-items: end;
      }
      .red__acciones {
        display: flex;
        gap: var(--space-4, 0.25rem);
      }
      .apariencia__acciones {
        display: flex;
        gap: var(--space-8, 0.5rem);
      }
      .apariencia__maqueta {
        position: sticky;
        top: var(--space-16, 1rem);
      }
      .apariencia__nota {
        margin: 0 0 var(--space-8, 0.5rem);
        font-size: var(--texto-sm, 0.875rem);
        color: var(--color-texto-suave);
      }
      .maqueta {
        border: 1px solid var(--color-borde);
        border-radius: var(--radio-tarjeta, 6px);
        overflow: hidden;
        background: var(--color-fondo);
        font-family: var(--font-cuerpo);
      }
      .maqueta__cabecera {
        display: flex;
        align-items: center;
        gap: var(--space-12, 0.75rem);
        padding: var(--space-12, 0.75rem) var(--space-16, 1rem);
        background: var(--color-primario);
        color: #fff;
      }
      .maqueta__logo {
        font-weight: 600;
      }
      .maqueta__nombre {
        font-family: var(--font-titulos);
        font-weight: 600;
      }
      .maqueta__menu {
        margin-left: auto;
        display: flex;
        gap: var(--space-8, 0.5rem);
        font-size: var(--texto-sm, 0.875rem);
      }
      .maqueta__cuerpo {
        padding: var(--space-16, 1rem);
        color: var(--color-texto);
      }
      .maqueta__regla {
        height: 3px;
        background: var(--color-primario);
        margin: 0 0 var(--space-12, 0.75rem);
      }
      .maqueta h1 {
        font-family: var(--font-titulos);
        font-weight: 600;
        font-size: var(--texto-xl, 1.5rem);
        color: var(--color-texto);
      }
      .maqueta__texto {
        color: var(--color-texto-suave);
      }
      .maqueta__enlace {
        color: var(--color-primario);
        font-weight: 500;
      }
      .maqueta__boton {
        padding: 0.5rem 1rem;
        border: 1px solid var(--color-primario);
        border-radius: var(--radio-campo, 4px);
        background: var(--color-primario);
        color: #fff;
        font: inherit;
        font-weight: 600;
      }
      .maqueta__acento {
        color: var(--color-acento);
      }
      @media (prefers-reduced-motion: reduce) {
        .maqueta * {
          transition: none !important;
        }
      }
    `,
  ],
})
export class AdminApariencia implements OnInit {
  protected readonly CAMPOS_COLOR = CAMPOS_COLOR;

  private api = inject(CmsApiService);

  readonly contenido = signal<JsonMap>({});
  readonly version = signal(1);
  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly publicando = signal(false);
  readonly error = signal('');
  readonly status = signal('');
  readonly avisos = signal<Array<{ campo: string; mensaje: string }>>([]);

  async ngOnInit(): Promise<void> {
    this.cargando.set(true);
    try {
      const res = await this.api.getApariencia();
      this.contenido.set(res.contenido ?? {});
      this.version.set(res.version ?? 1);
    } catch {
      this.error.set('No se pudo cargar la apariencia. Revisa tu conexión.');
    } finally {
      this.cargando.set(false);
    }
  }

  str(path: string, defecto = ''): string {
    const v = getByPath(this.contenido(), path);
    return typeof v === 'string' ? v : defecto;
  }

  setStr(path: string, valor: string): void {
    this.contenido.set(setByPath(this.contenido(), path, valor));
  }

  colorDe(key: string): string {
    return this.str(key, COLORES_DEFECTO[key]) || COLORES_DEFECTO[key];
  }

  colorNormalizado(key: string): string {
    return normalizarHex(this.colorDe(key));
  }

  setColor(key: string, valor: string): void {
    this.setStr(key, valor);
  }

  fontTitulos(): string {
    const defecto = FONTS_DEFECTO['tipografia_titulos'];
    return this.str('tipografia_titulos', defecto) || defecto;
  }

  fontCuerpo(): string {
    const defecto = FONTS_DEFECTO['tipografia_cuerpo'];
    return this.str('tipografia_cuerpo', defecto) || defecto;
  }

  redes(): Red[] {
    const raw = getByPath(this.contenido(), 'redes');
    if (!Array.isArray(raw)) {
      return [];
    }
    return raw.filter(
      (r): r is Red => !!r && typeof r === 'object' && typeof (r as Red).nombre === 'string',
    );
  }

  setRed(index: number, campo: 'nombre' | 'url', valor: string): void {
    this.setStr(`redes.${index}.${campo}`, valor);
  }

  agregarRed(): void {
    const lista = [...this.redes(), { nombre: '', url: '' }];
    this.contenido.set(setByPath(this.contenido(), 'redes', lista));
  }

  quitarRed(index: number): void {
    const lista = this.redes().filter((_, i) => i !== index);
    this.contenido.set(setByPath(this.contenido(), 'redes', lista));
  }

  moverRed(from: number, delta: number): void {
    const lista = this.redes();
    const to = from + delta;
    if (to < 0 || to >= lista.length) {
      return;
    }
    const [moved] = lista.splice(from, 1);
    lista.splice(to, 0, moved);
    this.contenido.set(setByPath(this.contenido(), 'redes', lista));
  }

  /** Pares de contraste que no cumplen 4.5:1 (texto sobre fondo/superficie y botón). */
  readonly problemasContraste = computed<AvisoContraste[]>(() => {
    const primario = this.colorDe('color_primario');
    const texto = this.colorDe('color_texto');
    const suave = this.colorDe('color_texto_suave');
    const fondo = this.colorDe('color_fondo');
    const superficie = this.colorDe('color_superficie');
    const avisos: AvisoContraste[] = [];
    this.verificarPar(texto, fondo, 'El texto', 'el fondo', true, avisos);
    this.verificarPar(suave, fondo, 'El texto suave', 'el fondo', true, avisos);
    this.verificarPar(texto, superficie, 'El texto', 'la superficie', true, avisos);
    this.verificarPar(primario, fondo, 'El color primario', 'el fondo', true, avisos);
    this.verificarPar('#ffffff', primario, 'El texto del botón', 'el color primario', false, avisos);
    return avisos;
  });

  private verificarPar(
    fg: string,
    bg: string,
    etiquetaFg: string,
    etiquetaBg: string,
    ajustarFrente: boolean,
    avisos: AvisoContraste[],
  ): void {
    const ratio = contraste(fg, bg);
    if (ratio >= 4.5) {
      return;
    }
    const sugerido = ajustarFrente ? sugerirContraste(fg, bg) : sugerirContraste(bg, fg);
    const frente = ajustarFrente ? etiquetaFg : etiquetaBg;
    const detras = ajustarFrente ? etiquetaBg : etiquetaFg;
    avisos.push({
      mensaje: `${frente} (${this.redondear(ratio)}:1) no alcanza 4.5:1 sobre ${detras}.`,
      sugerido,
    });
  }

  private redondear(n: number): string {
    return n.toFixed(2).replace(/\.?0+$/, '');
  }

  async guardar(): Promise<void> {
    this.error.set('');
    this.status.set('');
    this.avisos.set([]);
    this.guardando.set(true);
    try {
      const res = await this.api.guardarApariencia(this.contenido(), this.version());
      this.contenido.set(res.contenido ?? this.contenido());
      this.version.set(res.version);
      this.status.set('Apariencia guardada.');
    } catch {
      this.error.set('No se pudo guardar la apariencia. Revisa tu conexión.');
    } finally {
      this.guardando.set(false);
    }
  }

  async publicar(): Promise<void> {
    this.error.set('');
    this.status.set('');
    this.avisos.set([]);
    this.publicando.set(true);
    try {
      const res = await this.api.publicarApariencia(this.version());
      this.contenido.set(res.contenido ?? this.contenido());
      this.version.set(res.version);
      this.avisos.set(res.avisos ?? []);
      this.status.set('Apariencia publicada.');
    } catch {
      this.error.set('No se pudo publicar la apariencia. Comprueba que tu usuario sea administrador.');
    } finally {
      this.publicando.set(false);
    }
  }
}
