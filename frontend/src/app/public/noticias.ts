import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { NgStyle } from '@angular/common';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { API_BASE, NoticiaPublica } from '../cms/cms.models';
import { SitioPublicoService } from '../core/sitio-publico.service';
import { MarcoPortal } from './marco-portal';

const LIMITE = 9;

type Estado = 'cargando' | 'lista' | 'vacia' | 'error';

/**
 * Sección pública de noticias y comunicados: pestañas por tipo, buscador y
 * paginación. Lee y escribe `?tipo=&q=&pagina=` para que cada vista se pueda
 * compartir y recargar.
 */
@Component({
  selector: 'app-noticias',
  standalone: true,
  imports: [FormsModule, RouterLink, NgStyle, MarcoPortal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="marco" [ngStyle]="sitio.tema()">
      <app-marco-portal>
        <main id="contenido-principal" tabindex="-1">
          <section class="page-hero">
            <p class="bloque__tag">Actualidad</p>
            <h1>Noticias y comunicados</h1>
            <p class="page-hero__texto">
              Lo más reciente de la vida institucional.
            </p>
          </section>

          <div class="marco-ancho">
            <div class="noticias-filtros">
              <div
                class="noticias-pestanas"
                role="tablist"
                aria-label="Tipo de publicación"
              >
                @for (t of pestanas; track t.valor) {
                  <button
                    type="button"
                    role="tab"
                    [attr.aria-selected]="tipo() === t.valor ? 'true' : 'false'"
                    (click)="elegirTipo(t.valor)"
                  >
                    {{ t.etiqueta }}
                  </button>
                }
              </div>
              <form class="busqueda-form" role="search" (ngSubmit)="buscar()">
                <input
                  id="buscar-noticias-publico"
                  class="busqueda-form__campo"
                  type="search"
                  name="q"
                  autocomplete="off"
                  maxlength="120"
                  placeholder="Buscar en noticias"
                  [(ngModel)]="texto"
                />
                <button type="submit" class="busqueda-form__boton">
                  Buscar
                </button>
              </form>
            </div>

            @switch (estado()) {
              @case ('cargando') {
                <p role="status">Cargando noticias…</p>
              }
              @case ('error') {
                <section class="buscar__error" aria-labelledby="noticias-error">
                  <h2 id="noticias-error">
                    No se pudieron cargar las noticias
                  </h2>
                  <p>Revisa tu conexión e inténtalo de nuevo.</p>
                  <button type="button" class="boton" (click)="reintentar()">
                    Reintentar
                  </button>
                </section>
              }
              @case ('vacia') {
                <p>No hay noticias con ese criterio.</p>
              }
              @case ('lista') {
                <ul class="noticias-rejilla">
                  @for (n of items(); track n.id) {
                    <li class="noticia-tarjeta">
                      @if (n.imagen_url && n.imagen_alt) {
                        <img
                          [src]="n.imagen_url"
                          [alt]="n.imagen_alt"
                          loading="lazy"
                        />
                      }
                      <div class="noticia-tarjeta__cuerpo">
                        @if (n.categoria) {
                          <span
                            class="noticia__categoria noticia__categoria--fija"
                            >{{ n.categoria }}</span
                          >
                        }
                        <h2>
                          <a class="noticia__enlace" [routerLink]="n.ruta">{{
                            n.titulo
                          }}</a>
                        </h2>
                        @if (n.resumen) {
                          <p>{{ n.resumen }}</p>
                        }
                        @if (n.publicado_en) {
                          <time [attr.datetime]="n.publicado_en">{{
                            fecha(n.publicado_en)
                          }}</time>
                        }
                        @if (n.tipo === 'comunicado') {
                          <span class="admin-etiqueta">Comunicado</span>
                        }
                      </div>
                    </li>
                  }
                </ul>
                @if (paginas() > 1) {
                  <nav class="noticias-paginas" aria-label="Paginación">
                    <button
                      type="button"
                      class="boton boton--contorno"
                      [disabled]="pagina() <= 1"
                      (click)="irPagina(pagina() - 1)"
                    >
                      Anteriores
                    </button>
                    <span>Página {{ pagina() }} de {{ paginas() }}</span>
                    <button
                      type="button"
                      class="boton boton--contorno"
                      [disabled]="pagina() >= paginas()"
                      (click)="irPagina(pagina() + 1)"
                    >
                      Siguientes
                    </button>
                  </nav>
                }
              }
            }
          </div>
        </main>
      </app-marco-portal>
    </div>
  `,
})
export class Noticias implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly title = inject(Title);
  private readonly destroyRef = inject(DestroyRef);

  /** Datos publicados del sitio: el marco compartido los necesita. */
  readonly sitio = inject(SitioPublicoService);

  readonly items = signal<NoticiaPublica[]>([]);
  readonly total = signal(0);
  readonly estado = signal<Estado>('cargando');
  readonly tipo = signal('');
  readonly consulta = signal('');
  readonly pagina = signal(1);

  readonly paginas = computed(() =>
    Math.max(1, Math.ceil(this.total() / LIMITE)),
  );

  texto = '';

  readonly pestanas = [
    { valor: '', etiqueta: 'Todas' },
    { valor: 'noticia', etiqueta: 'Noticias' },
    { valor: 'comunicado', etiqueta: 'Comunicados' },
  ];

  private readonly formato = new Intl.DateTimeFormat('es-PE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  ngOnInit(): void {
    void this.sitio.cargar();
    this.title.setTitle('Noticias y comunicados');
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        const tipo = ['noticia', 'comunicado'].includes(
          params.get('tipo') ?? '',
        )
          ? params.get('tipo')!
          : '';
        const q = (params.get('q') ?? '').trim().slice(0, 120);
        const pagina = Math.max(1, Number(params.get('pagina')) || 1);
        this.tipo.set(tipo);
        this.consulta.set(q);
        this.texto = q;
        this.pagina.set(pagina);
        void this.cargar();
      });
  }

  fecha(iso: string): string {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : this.formato.format(d);
  }

  elegirTipo(tipo: string): void {
    this.navegar(tipo, this.consulta(), 1);
  }

  buscar(): void {
    this.navegar(this.tipo(), this.texto.trim(), 1);
  }

  irPagina(pagina: number): void {
    this.navegar(this.tipo(), this.consulta(), pagina);
  }

  reintentar(): void {
    void this.cargar();
  }

  /** La URL es la fuente de la verdad: cambiarla dispara la carga. */
  private navegar(tipo: string, q: string, pagina: number): void {
    const queryParams: Record<string, string | number> = {};
    if (tipo) {
      queryParams['tipo'] = tipo;
    }
    if (q) {
      queryParams['q'] = q;
    }
    if (pagina > 1) {
      queryParams['pagina'] = pagina;
    }
    void this.router.navigate(['/noticias'], { queryParams });
  }

  private async cargar(): Promise<void> {
    this.estado.set('cargando');
    try {
      const params: Record<string, string | number> = {
        limite: LIMITE,
        pagina: this.pagina(),
      };
      if (this.tipo()) {
        params['tipo'] = this.tipo();
      }
      if (this.consulta()) {
        params['q'] = this.consulta();
      }
      const res = await firstValueFrom(
        this.http.get<{ items: NoticiaPublica[]; total: number }>(
          `${API_BASE}/publico/noticias`,
          { params },
        ),
      );
      this.items.set(res.items ?? []);
      this.total.set(res.total ?? 0);
      this.estado.set(this.items().length ? 'lista' : 'vacia');
    } catch {
      this.items.set([]);
      this.estado.set('error');
    }
  }
}
