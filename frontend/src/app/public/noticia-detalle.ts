import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { NgStyle } from '@angular/common';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { API_BASE, NoticiaPublica } from '../cms/cms.models';
import { SitioPublicoService } from '../core/sitio-publico.service';
import { MarcoPortal } from './marco-portal';

type Estado = 'cargando' | 'lista' | 'no-encontrada' | 'error';

/**
 * Detalle público de una noticia o comunicado: migas, metadatos, portada y
 * cuerpo. El HTML del cuerpo ya viene saneado del servidor; se pinta con
 * `innerHTML` porque lleva negritas, listas y enlaces.
 */
@Component({
  selector: 'app-noticia-detalle',
  standalone: true,
  imports: [NgStyle, RouterLink, MarcoPortal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="marco" [ngStyle]="sitio.tema()">
      <app-marco-portal>
        <main
          id="contenido-principal"
          tabindex="-1"
          [attr.aria-busy]="estado() === 'cargando'"
        >
          <div class="marco-ancho">
            @switch (estado()) {
              @case ('cargando') {
                <p role="status">Cargando la noticia…</p>
              }
              @case ('error') {
                <section
                  class="marco-ancho estado"
                  aria-labelledby="noticia-error"
                >
                  <h1 class="titulo-h1" id="noticia-error">
                    No se pudo cargar la noticia
                  </h1>
                  <p>Revisa tu conexión e inténtalo de nuevo.</p>
                  <button type="button" class="boton" (click)="reintentar()">
                    Reintentar
                  </button>
                </section>
              }
              @case ('no-encontrada') {
                <section
                  class="marco-ancho estado"
                  aria-labelledby="noticia-ausente"
                >
                  <h1 class="titulo-h1" id="noticia-ausente">
                    Página no encontrada
                  </h1>
                  <p>
                    El enlace puede haber cambiado o la información todavía no
                    está publicada.
                  </p>
                  <a class="boton" routerLink="/">Volver al inicio</a>
                </section>
              }
              @case ('lista') {
                @if (noticia(); as n) {
                  <article class="noticia-detalle">
                    <nav
                      class="noticia-detalle__migas"
                      aria-label="Migas de pan"
                    >
                      <a routerLink="/">Inicio</a> ›
                      <a routerLink="/noticias">Noticias</a> ›
                      <span aria-current="page">{{ n.titulo }}</span>
                    </nav>
                    @if (n.categoria) {
                      <span
                        class="noticia__categoria noticia__categoria--fija"
                        >{{ n.categoria }}</span
                      >
                    }
                    <h1 class="titulo-h1">{{ n.titulo }}</h1>
                    @if (n.publicado_en) {
                      <time
                        class="noticia-detalle__fecha"
                        [attr.datetime]="n.publicado_en"
                      >
                        {{ fecha(n.publicado_en) }}
                      </time>
                    }
                    @if (n.resumen) {
                      <p class="noticia-detalle__resumen">{{ n.resumen }}</p>
                    }
                    @if (n.imagen_url && n.imagen_alt) {
                      <img
                        class="noticia-detalle__imagen"
                        [src]="n.imagen_url"
                        [alt]="n.imagen_alt"
                      />
                    }
                    @if (n.cuerpo) {
                      <div
                        class="noticia-detalle__cuerpo"
                        [innerHTML]="n.cuerpo"
                      ></div>
                    }
                    <a class="boton boton--contorno" routerLink="/noticias"
                      >Volver a noticias</a
                    >
                  </article>
                }
              }
            }
          </div>
        </main>
      </app-marco-portal>
    </div>
  `,
})
export class NoticiaDetalle implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly destroyRef = inject(DestroyRef);

  /** Datos publicados del sitio: el marco compartido los necesita. */
  readonly sitio = inject(SitioPublicoService);

  readonly noticia = signal<NoticiaPublica | null>(null);
  readonly estado = signal<Estado>('cargando');

  private readonly formato = new Intl.DateTimeFormat('es-PE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  ngOnInit(): void {
    void this.sitio.cargar();
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        void this.cargar(params.get('slug') ?? '');
      });
  }

  fecha(iso: string): string {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : this.formato.format(d);
  }

  reintentar(): void {
    void this.cargar(this.route.snapshot.paramMap.get('slug') ?? '');
  }

  private async cargar(slug: string): Promise<void> {
    this.estado.set('cargando');
    this.noticia.set(null);
    if (!/^[a-z0-9-]{1,120}$/i.test(slug)) {
      this.marcarAusente();
      return;
    }
    try {
      const n = await firstValueFrom(
        this.http.get<NoticiaPublica>(`${API_BASE}/publico/noticias/${slug}`),
      );
      this.noticia.set(n);
      this.estado.set('lista');
      this.title.setTitle(`${n.titulo} | ${this.sitio.nombre()}`);
      this.meta.updateTag({
        name: 'description',
        content: n.resumen || n.titulo,
      });
      this.meta.updateTag({ name: 'robots', content: 'index,follow' });
    } catch (e) {
      if (e instanceof HttpErrorResponse && e.status === 404) {
        this.marcarAusente();
      } else {
        this.estado.set('error');
        this.title.setTitle('No se pudo cargar la noticia');
      }
    }
  }

  /** La ruta pedida no existe o no es visible: mismo estado que el portal. */
  private marcarAusente(): void {
    this.estado.set('no-encontrada');
    this.title.setTitle(`Página no encontrada | ${this.sitio.nombre()}`);
    this.meta.updateTag({ name: 'robots', content: 'noindex' });
  }
}
