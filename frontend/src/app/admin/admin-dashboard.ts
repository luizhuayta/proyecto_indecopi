import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { CmsApiService } from '../cms/cms-api.service';
import { AuthService } from '../cms/auth.service';
import type { NombreIcono } from '../cms/iconos';
import { Icono } from '../shared/public/icono';
import { BANDEJAS_MENSAJE } from './admin-mensajes';
import { guiaDe, type GuiaAdmin } from './guias-admin';

/** Una bandeja de entrada con sus pendientes y el enlace a su listado. */
interface BandejaVista {
  tipo: string;
  titulo: string;
  pendientes: number;
}

/** Tarjeta de la sección «Estado del contenido». */
interface TarjetaContenido {
  icono: NombreIcono;
  numero: number | null;
  rotulo: string;
  detalle: string;
  ruta: string;
}

/** Enlace rápido a una sección del panel, con la guía que la explica. */
interface AccesoGuia {
  ruta: string;
  guia: GuiaAdmin;
}

/**
 * Orden fijo de las bandejas en el tablero: los trámites con más peso
 * institucional primero, igual que en el menú lateral.
 */
const ORDEN_BANDEJAS = ['tramite', 'reclamo', 'accesibilidad', 'contacto', 'sugerencia'];

/** Secciones con guía de trabajo, en el orden en que se ofrecen como acceso. */
const RUTAS_CON_GUIA: Array<{ ruta: string; seccion: string }> = [
  { ruta: '/admin/paginas', seccion: 'paginas' },
  { ruta: '/admin/noticias', seccion: 'noticias' },
  { ruta: '/admin/mensajes', seccion: 'mensajes' },
  { ruta: '/admin/medios', seccion: 'medios' },
  { ruta: '/admin/identidad', seccion: 'identidad' },
  { ruta: '/admin/apariencia', seccion: 'apariencia' },
  { ruta: '/admin/usuarios', seccion: 'usuarios' },
];

/**
 * Portada del panel: saludo con el rol de la sesión, las solicitudes que
 * esperan respuesta agrupadas por bandeja, un resumen del contenido del
 * sitio y accesos rápidos. Cada métrica se carga por separado para que un
 * fallo puntual no deje la pantalla en blanco; los conteos respetan el rol
 * (la secretaria no pide páginas ni usuarios: la API se los negaría).
 */
@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [RouterLink, Icono],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="admin-encabezado">
      <div>
        <h2 class="admin-encabezado__titulo">Hola, {{ auth.username() ?? 'equipo' }}</h2>
        <p class="admin-encabezado__texto">
          <span class="admin-etiqueta admin-etiqueta--ok">{{ auth.rotuloRol() }}</span>
          Este es tu centro de trabajo: las solicitudes que esperan respuesta
          y el estado del contenido del sitio.
        </p>
      </div>
      <div class="admin-encabezado__acciones">
        <a class="admin-btn" href="/" target="_blank" rel="noopener noreferrer">
          Ver portal
        </a>
        <button type="button" class="admin-btn" (click)="cargarTodo()" [disabled]="cargando()">
          {{ cargando() ? 'Actualizando…' : 'Actualizar' }}
        </button>
      </div>
    </header>

    @if (avisoParcial()) {
      <p class="admin-banner admin-banner--error" role="alert">
        Alguna métrica no se pudo cargar. Pulsa «Actualizar» para reintentarlo.
      </p>
    }

    <section class="admin-tarjeta dash-bloque" aria-labelledby="dash-solicitudes">
      <div class="dash-bloque__cabecera">
        <h3 id="dash-solicitudes" class="dash-titulo">
          <app-icono nombre="mensajes" /> Solicitudes sin atender
        </h3>
        @if (totalPendientes() > 0) {
          <span class="admin-etiqueta admin-etiqueta--borrador">
            {{ totalPendientes() }} pendiente{{ totalPendientes() === 1 ? '' : 's' }}
          </span>
        }
      </div>
      @if (cargando() && !bandejas().length) {
        <p class="admin-vacio">Contando solicitudes…</p>
      } @else if (!bandejas().length) {
        <p class="dash-aldia">Todo atendido. Cuando llegue una solicitud por el portal la verás aquí.</p>
      } @else {
        <ul class="dash-bandeja-lista">
          @for (b of bandejas(); track b.tipo) {
            <li class="dash-bandeja">
              <a
                class="dash-bandeja__enlace"
                [routerLink]="['/admin/mensajes']"
                [queryParams]="{ tipo: b.tipo }"
              >
                <span class="dash-bandeja__nombre">{{ b.titulo }}</span>
                <span
                  class="admin-etiqueta"
                  [class.admin-etiqueta--borrador]="b.pendientes > 0"
                >
                  {{ b.pendientes }} sin atender
                </span>
              </a>
            </li>
          }
        </ul>
      }
    </section>

    <section class="dash-bloque" aria-labelledby="dash-contenido">
      <div class="dash-bloque__cabecera">
        <h3 id="dash-contenido" class="dash-titulo">
          <app-icono nombre="grafico" /> Estado del contenido
        </h3>
      </div>
      <ul class="dash-tarjetas">
        @for (t of tarjetas(); track t.rotulo) {
          <li>
            <a class="admin-tarjeta dash-tarjeta" [routerLink]="t.ruta">
              <app-icono [nombre]="t.icono" />
              <span class="dash-tarjeta__numero">{{ t.numero ?? '—' }}</span>
              <span class="dash-tarjeta__rotulo">{{ t.rotulo }}</span>
              @if (t.detalle) {
                <span class="dash-tarjeta__detalle">{{ t.detalle }}</span>
              }
            </a>
          </li>
        }
      </ul>
    </section>

    <section class="admin-tarjeta dash-bloque" aria-labelledby="dash-accesos">
      <div class="dash-bloque__cabecera">
        <h3 id="dash-accesos" class="dash-titulo">
          <app-icono nombre="guia" /> Accesos rápidos
        </h3>
      </div>
      <ul class="dash-accesos">
        <li>
          <a class="dash-acceso" href="/" target="_blank" rel="noopener noreferrer">
            <strong>Ver portal</strong>
            <span>Abre la web tal como la ven los visitantes.</span>
          </a>
        </li>
        @for (a of accesos(); track a.ruta) {
          <li>
            <a class="dash-acceso" [routerLink]="a.ruta">
              <strong>{{ a.guia.etiqueta }}</strong>
              <span>{{ a.guia.descripcion }}</span>
            </a>
          </li>
        }
      </ul>
    </section>
  `,
  styles: [
    `
      .dash-bloque {
        margin-top: 1.25rem;
      }
      .dash-bloque__cabecera {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 0.5rem;
        margin-bottom: 0.9rem;
      }
      .dash-titulo {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin: 0;
        font-size: 1.02rem;
        font-weight: 700;
      }
      .dash-titulo .icono {
        color: var(--color-primario);
      }
      .dash-bandeja-lista {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 0.5rem;
      }
      .dash-bandeja__enlace {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        padding: 0.65rem 0.9rem;
        border: 1px solid var(--color-borde);
        border-radius: 12px;
        color: var(--color-texto);
        text-decoration: none;
      }
      .dash-bandeja__enlace:hover {
        border-color: var(--color-primario);
      }
      .dash-bandeja__nombre {
        font-weight: 600;
      }
      .dash-aldia {
        margin: 0;
        color: var(--color-texto-suave);
      }
      .dash-tarjetas {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
        gap: 0.9rem;
      }
      .dash-tarjeta {
        display: grid;
        gap: 0.2rem;
        padding: 1.1rem 1.2rem;
        color: var(--color-texto);
        text-decoration: none;
      }
      .dash-tarjeta .icono {
        color: var(--color-primario);
      }
      .dash-tarjeta__numero {
        font-size: 1.7rem;
        font-weight: 750;
        line-height: 1.1;
      }
      .dash-tarjeta__rotulo {
        font-weight: 650;
      }
      .dash-tarjeta__detalle {
        color: var(--color-texto-suave);
        font-size: 0.8rem;
      }
      .dash-accesos {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
        gap: 0.75rem;
      }
      .dash-acceso {
        display: grid;
        gap: 0.2rem;
        padding: 0.8rem 1rem;
        border: 1px solid var(--color-borde);
        border-radius: 12px;
        color: var(--color-texto);
        text-decoration: none;
      }
      .dash-acceso:hover {
        border-color: var(--color-primario);
      }
      .dash-acceso span {
        color: var(--color-texto-suave);
        font-size: 0.82rem;
      }
    `,
  ],
})
export class AdminDashboard implements OnInit {
  readonly auth = inject(AuthService);
  private readonly api = inject(CmsApiService);

  readonly cargando = signal(false);
  /** Métricas que no pudieron leerse: la tarjeta muestra «—» en vez de mentir. */
  private readonly fallos = signal<Set<string>>(new Set());

  readonly pendientes = signal<{ tipo: string; pendientes: number }[]>([]);
  readonly totalPaginas = signal<number | null>(null);
  readonly noticiasPublicadas = signal<number | null>(null);
  readonly noticiasBorradores = signal<number | null>(null);
  readonly totalMedios = signal<number | null>(null);
  readonly totalUsuarios = signal<number | null>(null);

  /** Bandejas con su conteo, en el orden fijo del panel. */
  readonly bandejas = computed<BandejaVista[]>(() =>
    this.pendientes()
      .map((p) => ({
        tipo: p.tipo,
        titulo: BANDEJAS_MENSAJE[p.tipo]?.titulo ?? p.tipo,
        pendientes: p.pendientes,
      }))
      .sort(
        (a, b) =>
          (ORDEN_BANDEJAS.indexOf(a.tipo) === -1 ? 99 : ORDEN_BANDEJAS.indexOf(a.tipo)) -
          (ORDEN_BANDEJAS.indexOf(b.tipo) === -1 ? 99 : ORDEN_BANDEJAS.indexOf(b.tipo)),
      ),
  );

  readonly totalPendientes = computed(() =>
    this.pendientes().reduce((suma, b) => suma + b.pendientes, 0),
  );

  /** Hay algo que enseñar aunque una métrica haya fallado: aviso, no pantalla de error. */
  readonly avisoParcial = computed(() => this.fallos().size > 0);

  /**
   * Tarjetas de contenido según el rol: solo se piden los listados que la
   * API deja leer a la sesión (páginas exige admin/editor; usuarios, admin).
   */
  readonly tarjetas = computed<TarjetaContenido[]>(() => {
    const lista: TarjetaContenido[] = [];
    if (this.auth.puede('paginas')) {
      lista.push({
        icono: 'paginas',
        numero: this.totalPaginas(),
        rotulo: 'Páginas',
        detalle: 'Se editan en el constructor visual',
        ruta: '/admin/paginas',
      });
    }
    if (this.auth.puede('noticias')) {
      const borradores = this.noticiasBorradores();
      lista.push({
        icono: 'noticias',
        numero: this.noticiasPublicadas(),
        rotulo: 'Noticias publicadas',
        detalle:
          borradores === null
            ? ''
            : borradores === 0
              ? 'Sin borradores'
              : borradores === 1
                ? '1 en borrador'
                : `${borradores} en borrador`,
        ruta: '/admin/noticias',
      });
    }
    if (this.auth.puede('medios')) {
      lista.push({
        icono: 'medios',
        numero: this.totalMedios(),
        rotulo: 'Medios',
        detalle: 'Imágenes y documentos',
        ruta: '/admin/medios',
      });
    }
    if (this.auth.isAdmin()) {
      lista.push({
        icono: 'usuarios',
        numero: this.totalUsuarios(),
        rotulo: 'Usuarios',
        detalle: 'Cuentas con acceso al panel',
        ruta: '/admin/usuarios',
      });
    }
    return lista;
  });

  /** Accesos a las secciones que el rol puede abrir, con su guía de trabajo. */
  readonly accesos = computed<AccesoGuia[]>(() =>
    RUTAS_CON_GUIA.filter((a) =>
      this.auth.puede(a.seccion as Parameters<AuthService['puede']>[0]),
    ).map((a) => ({ ruta: a.ruta, guia: guiaDe(a.ruta) })),
  );

  ngOnInit(): void {
    void this.cargarTodo();
  }

  /** Recarga todas las métricas permitidas por el rol, en paralelo. */
  async cargarTodo(): Promise<void> {
    this.cargando.set(true);
    try {
      await Promise.all([
        this.cargarPendientes(),
        this.cargarPaginas(),
        this.cargarNoticias(),
        this.cargarMedios(),
        this.cargarUsuarios(),
      ]);
    } finally {
      this.cargando.set(false);
    }
  }

  private marcar(clave: string, ok: boolean): void {
    this.fallos.update((set) => {
      const next = new Set(set);
      if (ok) {
        next.delete(clave);
      } else {
        next.add(clave);
      }
      return next;
    });
  }

  /** Solicitudes pendientes agrupadas por tipo de mensaje. */
  private async cargarPendientes(): Promise<void> {
    try {
      const items = await this.api.listarMensajes({ estado: 'pendiente' });
      const conteo = new Map<string, number>();
      for (const m of items) {
        conteo.set(m.tipo, (conteo.get(m.tipo) ?? 0) + 1);
      }
      this.pendientes.set(
        [...conteo.entries()].map(([tipo, pendientes]) => ({ tipo, pendientes })),
      );
      this.marcar('mensajes', true);
    } catch {
      this.marcar('mensajes', false);
    }
  }

  private async cargarPaginas(): Promise<void> {
    if (!this.auth.puede('paginas')) {
      return;
    }
    try {
      const { paginas } = await this.api.getPaginas();
      this.totalPaginas.set(paginas.length);
      this.marcar('paginas', true);
    } catch {
      this.marcar('paginas', false);
    }
  }

  private async cargarNoticias(): Promise<void> {
    if (!this.auth.puede('noticias')) {
      return;
    }
    try {
      const items = await this.api.listarNoticias();
      this.noticiasPublicadas.set(items.filter((n) => n.estado === 'publicado').length);
      this.noticiasBorradores.set(items.filter((n) => n.estado === 'borrador').length);
      this.marcar('noticias', true);
    } catch {
      this.marcar('noticias', false);
    }
  }

  private async cargarMedios(): Promise<void> {
    if (!this.auth.puede('medios')) {
      return;
    }
    try {
      this.totalMedios.set((await this.api.listarMedios()).length);
      this.marcar('medios', true);
    } catch {
      this.marcar('medios', false);
    }
  }

  private async cargarUsuarios(): Promise<void> {
    if (!this.auth.isAdmin()) {
      return;
    }
    try {
      this.totalUsuarios.set((await this.api.listarUsuarios()).length);
      this.marcar('usuarios', true);
    } catch {
      this.marcar('usuarios', false);
    }
  }
}
