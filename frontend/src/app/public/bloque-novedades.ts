import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnChanges,
  computed,
  inject,
  signal,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { API_BASE, JsonMap, NoticiaPublica } from '../cms/cms.models';
import { Icono } from '../shared/public/icono';

const acotar = (
  v: unknown,
  min: number,
  max: number,
  defecto: number,
): number => {
  const n = Number(v);
  return Number.isFinite(n)
    ? Math.max(min, Math.min(max, Math.trunc(n)))
    : defecto;
};

/**
 * Portada editorial de novedades: lee lo publicado en «Noticias» del panel.
 * La destacada es la primera marcada como tal; si no hay, la más reciente.
 * Los comunicados van en su propio panel lateral.
 */
@Component({
  selector: 'app-bloque-novedades',
  standalone: true,
  imports: [RouterLink, Icono],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="novedades">
      <div class="novedades__intro">
        <div>
          @if (texto('tag')) {
            <p class="bloque__tag">{{ texto('tag') }}</p>
          }
          @if (texto('title')) {
            <h2>{{ texto('title') }}</h2>
          }
          @if (texto('text')) {
            <p>{{ texto('text') }}</p>
          }
        </div>
        @if (texto('allLabel')) {
          <a class="novedades__todas" routerLink="/noticias">
            {{ texto('allLabel') }} <app-icono nombre="flecha" />
          </a>
        }
      </div>
      @if (cargado() && noticias().length === 0 && comunicados().length === 0) {
        <p class="novedades__vacio">Pronto publicaremos novedades.</p>
      } @else {
        <div class="novedades__rejilla">
          @if (destacada(); as d) {
            <section class="novedades__panel" aria-label="Noticias">
              <div class="novedades__noticias">
                <article class="noticia noticia--destacada">
                  <div class="noticia__media">
                    @if (d.imagen_url && d.imagen_alt) {
                      <img
                        [src]="d.imagen_url"
                        [alt]="d.imagen_alt"
                        loading="lazy"
                      />
                    }
                    @if (d.categoria) {
                      <span class="noticia__categoria">{{ d.categoria }}</span>
                    }
                  </div>
                  <h3>
                    <a class="noticia__enlace" [routerLink]="d.ruta">{{
                      d.titulo
                    }}</a>
                  </h3>
                  @if (d.resumen) {
                    <p>{{ d.resumen }}</p>
                  }
                  @if (d.publicado_en) {
                    <time [attr.datetime]="d.publicado_en">{{
                      fecha(d.publicado_en)
                    }}</time>
                  }
                </article>
                @if (resto().length) {
                  <ul class="noticias__lista">
                    @for (item of resto(); track item.id) {
                      <li class="noticia">
                        @if (item.imagen_url) {
                          <img [src]="item.imagen_url" alt="" loading="lazy" />
                        }
                        <div>
                          <h3>
                            <a class="noticia__enlace" [routerLink]="item.ruta">
                              {{ item.titulo }}
                            </a>
                          </h3>
                          @if (item.publicado_en) {
                            <time [attr.datetime]="item.publicado_en">
                              {{ fecha(item.publicado_en) }}
                            </time>
                          }
                        </div>
                      </li>
                    }
                  </ul>
                }
              </div>
            </section>
          }
          @if (comunicados().length) {
            <section
              class="novedades__panel novedades__panel--comunicados"
              aria-label="Comunicados"
            >
              <ul class="comunicados__lista">
                @for (c of comunicados(); track c.id) {
                  <li class="comunicado">
                    <app-icono nombre="megafono" />
                    <div>
                      <a class="comunicado__titulo" [routerLink]="c.ruta">{{
                        c.titulo
                      }}</a>
                      @if (c.publicado_en) {
                        <time [attr.datetime]="c.publicado_en">{{
                          fecha(c.publicado_en)
                        }}</time>
                      }
                    </div>
                  </li>
                }
              </ul>
            </section>
          }
        </div>
      }
    </div>
  `,
})
export class BloqueNovedades implements OnChanges {
  private readonly http = inject(HttpClient);

  /** Propiedades del bloque (vienen del catálogo: tag, title, cantidades…). */
  // @Input (no input()): los tests corren con vitest JIT, donde los inputs de
  // señal no se registran en el def del componente.
  @Input() bloque: JsonMap = {};

  readonly noticias = signal<NoticiaPublica[]>([]);
  readonly comunicados = signal<NoticiaPublica[]>([]);
  readonly cargado = signal(false);

  readonly destacada = computed(
    () =>
      this.noticias().find((x) => x.destacada) ?? this.noticias()[0] ?? null,
  );
  readonly resto = computed(() =>
    this.noticias().filter((x) => x !== this.destacada()),
  );

  private readonly formato = new Intl.DateTimeFormat('es-PE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  ngOnChanges(): void {
    const cn = acotar(this.bloque['cantidadNoticias'], 1, 6, 4);
    const cc = acotar(this.bloque['cantidadComunicados'], 0, 6, 3);
    void this.cargar(cn, cc);
  }

  texto(clave: string): string {
    const v = this.bloque[clave];
    return typeof v === 'string' ? v.trim() : '';
  }

  fecha(iso: string): string {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : this.formato.format(d);
  }

  private async cargar(cn: number, cc: number): Promise<void> {
    const pedir = (tipo: string, limite: number) =>
      firstValueFrom(
        this.http.get<{ items: NoticiaPublica[] }>(
          `${API_BASE}/publico/noticias`,
          {
            params: { tipo, limite },
          },
        ),
      )
        .then((r) => r.items ?? [])
        // Sin red, el bloque muestra su estado vacío, no rompe la página.
        .catch(() => [] as NoticiaPublica[]);
    const [noticias, comunicados] = await Promise.all([
      pedir('noticia', cn),
      cc > 0 ? pedir('comunicado', cc) : Promise.resolve([]),
    ]);
    this.noticias.set(noticias);
    this.comunicados.set(comunicados);
    this.cargado.set(true);
  }
}
