import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { API_BASE, LOCALE } from '../cms/cms.models';

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
 */
@Component({
  selector: 'app-buscar',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="buscar">
      <header class="buscar__cabecera">
        <a class="buscar__volver" routerLink="/">Volver al inicio</a>
        <h1 class="buscar__titulo">Resultados de búsqueda</h1>
        <form class="buscar__form" role="search" (ngSubmit)="enviar()">
          <label for="buscar-campo">Buscar en el sitio</label>
          <div class="buscar__fila">
            <input
              id="buscar-campo"
              class="buscar__campo"
              type="search"
              name="q"
              autocomplete="off"
              maxlength="120"
              [(ngModel)]="texto"
            />
            <button type="submit" class="buscar__boton">Buscar</button>
          </div>
        </form>
        @if (consulta()) {
          <p class="buscar__resumen">Resultados para «{{ consulta() }}».</p>
        }
      </header>

      <main class="buscar__resultados">
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
              <button type="button" class="buscar__boton" (click)="reintentar()">Reintentar</button>
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
                  <h2 class="buscar__subtitulo"><a [routerLink]="r.ruta">{{ r.titulo }}</a></h2>
                  <p>{{ r.fragmento }}</p>
                </li>
              }
            </ol>
          }
        }
      </main>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .buscar {
        min-height: 100dvh;
        padding: 1.5rem clamp(1rem, 4vw, 3rem) 4rem;
        background: var(--color-fondo);
        color: var(--color-texto);
        font-family: var(--font-cuerpo);
      }
      .buscar :focus-visible {
        outline: 2px solid var(--color-primario);
        outline-offset: 3px;
      }
      .buscar__cabecera {
        max-width: 52rem;
        margin-inline: auto;
        padding-bottom: 1.5rem;
        border-bottom: 1px solid var(--color-borde);
      }
      .buscar__volver {
        display: inline-block;
        margin-bottom: 1.5rem;
        color: var(--color-primario);
      }
      .buscar__titulo {
        font-family: var(--font-titulos);
        font-size: clamp(1.75rem, 3vw, 2.5rem);
        font-weight: 600;
        margin: 0 0 1rem;
      }
      .buscar__form label {
        display: block;
        margin-bottom: 0.35rem;
        font-size: var(--texto-sm, 0.875rem);
        color: var(--color-texto-suave);
      }
      .buscar__fila {
        display: flex;
        gap: 0.5rem;
      }
      .buscar__campo {
        flex: 1;
        min-width: 0;
        min-height: 2.75rem;
        padding: 0.5rem 0.75rem;
        border: 1px solid var(--color-borde);
        border-radius: var(--radio-campo, 4px);
        background: var(--color-superficie);
        color: var(--color-texto);
        font: inherit;
      }
      .buscar__boton {
        min-height: 2.75rem;
        padding: 0.5rem 1.25rem;
        border: 1px solid var(--color-primario);
        border-radius: var(--radio-campo, 4px);
        background: var(--color-primario);
        color: var(--color-boton-texto, #fff);
        font: inherit;
        font-weight: 600;
        cursor: pointer;
      }
      .buscar__resumen {
        margin: 1rem 0 0;
        color: var(--color-texto-suave);
      }
      .buscar__resultados {
        max-width: 52rem;
        margin-inline: auto;
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
      @media (max-width: 480px) {
        .buscar__fila {
          flex-direction: column;
        }
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

  readonly resultados = signal<ResultadoBusqueda[]>([]);
  readonly estado = signal<EstadoBusqueda>('inicial');
  readonly consulta = signal('');
  readonly error = signal('');

  texto = '';

  ngOnInit(): void {
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
