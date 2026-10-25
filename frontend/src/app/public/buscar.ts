import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { NgStyle } from '@angular/common';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { API_BASE, LOCALE } from '../cms/cms.models';
import { SitioPublicoService } from '../core/sitio-publico.service';
import { MarcoPortal } from './marco-portal';
import { resaltar } from './resaltado';

/** Un resultado de la búsqueda pública (GET /publico/buscar). */
export interface ResultadoBusqueda {
  titulo: string;
  ruta: string;
  fragmento: string;
}

type EstadoBusqueda = 'inicial' | 'cargando' | 'lista' | 'sin-resultados' | 'error';

/**
 * Resultados de la búsqueda del sitio: lee `q` de la dirección, consulta las
 * páginas publicadas y ofrece un enlace a cada coincidencia. Una consulta
 * vacía no llega al servidor.
 *
 * La página usa el mismo marco que el resto del portal —cabecera, navegación y
 * pie— para que no parezca otra web distinta.
 */
@Component({
  selector: 'app-buscar',
  standalone: true,
  imports: [FormsModule, RouterLink, NgStyle, MarcoPortal],
  template: `
    <div class="marco" [ngStyle]="sitio.tema()">
      <app-marco-portal [mostrarBuscador]="false">
        <main id="contenido-principal" tabindex="-1">
          <div class="marco-ancho">
            <div class="titulo-pagina">
              <h1 class="titulo-h1">Resultados de búsqueda</h1>
            </div>

            <div class="buscar__columna">
              <div class="busqueda-pagina">
                <label for="buscar-campo">Buscar en el sitio</label>
                <form class="busqueda-form buscar__form" role="search" (ngSubmit)="enviar()">
                  <input
                    id="buscar-campo"
                    class="busqueda-form__campo"
                    type="search"
                    name="q"
                    autocomplete="off"
                    maxlength="120"
                    [(ngModel)]="texto"
                  />
                  <button type="submit" class="busqueda-form__boton">Buscar</button>
                </form>
              </div>

              @if (consulta()) {
                <p class="buscar__resumen">Resultados para «{{ consulta() }}».</p>
              }

              <div class="buscar__resultados">
                @switch (estado()) {
                  @case ('inicial') {
                    <p class="buscar__aviso">Escribe un término para buscar en el sitio.</p>
                  }
                  @case ('cargando') {
                    <p class="buscar__aviso" role="status">Buscando…</p>
                  }
                  @case ('error') {
                    <section class="buscar__error" aria-labelledby="buscar-error">
                      <h2 id="buscar-error" class="buscar__subtitulo">La búsqueda no está disponible</h2>
                      <p>{{ error() }}</p>
                      <button type="button" class="busqueda-form__boton" (click)="reintentar()">
                        Reintentar
                      </button>
                    </section>
                  }
                  @case ('sin-resultados') {
                    <p class="buscar__aviso">
                      No se encontraron resultados para «{{ consulta() }}». Prueba con otras palabras.
                    </p>
                  }
                  @case ('lista') {
                    <ol class="buscar__lista">
                      @for (r of resultados(); track r.ruta) {
                        <li class="buscar__resultado">
                          <h2 class="buscar__subtitulo">
                            <a [routerLink]="r.ruta" [innerHTML]="resaltado(r.titulo, consulta())"></a>
                          </h2>
                          <p [innerHTML]="resaltado(r.fragmento, consulta())"></p>
                        </li>
                      }
                    </ol>
                  }
                }
              </div>
            </div>
          </div>
        </main>
      </app-marco-portal>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .busqueda-pagina {
        margin-bottom: 1rem;
      }
      .busqueda-pagina label {
        display: block;
        margin-bottom: 0.35rem;
        font-size: var(--texto-sm, 0.875rem);
        color: var(--color-texto-suave);
      }
      .busqueda-pagina .busqueda-form__campo {
        flex: 1;
        width: auto;
        min-width: 0;
      }
      .buscar__columna {
        max-width: 52rem;
      }
      .buscar__resumen {
        margin: 1rem 0 0;
        color: var(--color-texto-suave);
      }
      .buscar__resultados {
        padding-top: 2rem;
      }
      .buscar__aviso {
        padding-block: 2rem;
      }
      .buscar__lista {
        display: grid;
        gap: 1.5rem;
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .buscar__resultado {
        padding-bottom: 1.25rem;
        border-bottom: 1px solid var(--color-borde);
      }
      .buscar__resultado p {
        margin: 0;
      }
      .buscar__subtitulo {
        font-family: var(--font-titulos);
        font-size: 1.25rem;
        font-weight: 600;
        margin: 0 0 0.35rem;
      }
      .buscar__subtitulo a {
        color: var(--color-primario);
      }
    `,
  ],
})
export class Buscar implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly title = inject(Title);
  private readonly destroyRef = inject(DestroyRef);

  /** Datos publicados del sitio: el marco compartido los necesita. */
  readonly sitio = inject(SitioPublicoService);

  readonly resultados = signal<ResultadoBusqueda[]>([]);
  readonly estado = signal<EstadoBusqueda>('inicial');
  readonly consulta = signal('');
  readonly error = signal('');

  texto = '';

  /** Marca los términos buscados en el título y el fragmento de un resultado. */
  readonly resaltado = resaltar;

  ngOnInit(): void {
    // La cabecera y el pie se llenan con lo que la institución tiene publicado.
    void this.sitio.cargar();
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const q = (params.get('q') ?? '').trim();
      this.texto = q;
      this.consulta.set(q);
      void this.buscar(q);
    });
  }

  async buscar(q: string): Promise<void> {
    const consulta = q.trim();
    this.error.set('');
    if (!consulta) {
      this.resultados.set([]);
      this.estado.set('inicial');
      this.title.setTitle('Buscar | Portal institucional');
      return;
    }
    this.estado.set('cargando');
    try {
      const res = await firstValueFrom(
        this.http.get<{ resultados: ResultadoBusqueda[] }>(`${API_BASE}/publico/buscar`, {
          params: { q: consulta, locale: LOCALE },
        }),
      );
      this.resultados.set(res.resultados ?? []);
      this.estado.set(this.resultados().length > 0 ? 'lista' : 'sin-resultados');
      this.title.setTitle(`Resultados para «${consulta}» | Portal institucional`);
    } catch {
      this.resultados.set([]);
      this.error.set(
        'No se pudo completar la búsqueda. Revisa tu conexión e inténtalo de nuevo.',
      );
      this.estado.set('error');
    }
  }

  enviar(): void {
    const q = this.texto.trim();
    void this.router.navigate(['/buscar'], { queryParams: q ? { q } : {} });
  }

  reintentar(): void {
    void this.buscar(this.consulta());
  }
}
