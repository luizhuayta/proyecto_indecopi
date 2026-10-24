import { Component, effect, inject, signal } from '@angular/core';
import { DOCUMENT, NgStyle } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Title, Meta } from '@angular/platform-browser';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BehaviorSubject, catchError, combineLatest, map, of, switchMap, tap } from 'rxjs';
import { API_BASE, LOCALE, CmsDocResponse } from '../cms/cms.models';
import { CmsPageBlocks } from '../cms/blocks/cms-page-blocks';
import { SitioPublicoService } from '../core/sitio-publico.service';
import { MarcoPortal } from './marco-portal';

/**
 * Página pública del portal: resuelve la ruta, carga el documento publicado
 * y lo muestra dentro del marco compartido (cabecera y pie).
 */
@Component({
  selector: 'app-portal-publico',
  standalone: true,
  imports: [NgStyle, RouterLink, CmsPageBlocks, MarcoPortal],
  templateUrl: './portal-publico.html',
  styleUrl: './portal-publico.scss',
})
export class PortalPublico {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);
  private readonly recarga = new BehaviorSubject(0);

  /** Datos publicados del sitio: identidad, apariencia, menú y token CSRF. */
  readonly sitio = inject(SitioPublicoService);

  readonly pagina = signal<CmsDocResponse | null>(null);
  readonly estado = signal<'cargando' | 'lista' | 'no-encontrada' | 'error'>('cargando');
  /** Causa del estado 'error', para dar un mensaje útil al visitante. */
  readonly causaError = signal<'red' | 'servidor'>('servidor');
  readonly rutaActual = signal('/');

  constructor() {
    // El título depende de la página y del nombre de la institución, que puede
    // llegar después: el efecto vuelve a ejecutarse cuando cambie cualquiera.
    effect(() => {
      const estado = this.estado();
      if (estado === 'cargando') {
        return;
      }
      if (estado === 'error') {
        this.title.setTitle('No se pudo cargar el sitio');
        return;
      }
      const titulo = this.pagina()?.titulo || 'Página no encontrada';
      this.title.setTitle(`${titulo} | ${this.sitio.nombre()}`);
    });

    combineLatest([this.route.url, this.recarga]).pipe(
      tap(() => {
        this.estado.set('cargando');
        this.pagina.set(null);
      }),
      switchMap(([segmentos]) => {
        const ruta = '/' + segmentos.map((s) => s.path).join('/');
        this.rutaActual.set(ruta);
        // El marco se lee del sitio publicado en cada navegación: si la
        // institución cambia su menú, el visitante lo ve de inmediato.
        void this.sitio.cargar();
        return this.http
          .get<CmsDocResponse>(`${API_BASE}/publico/pagina`, {
            params: { locale: LOCALE, ruta },
          })
          .pipe(
            map((pagina) => ({ pagina, ausente: false })),
            catchError((e: HttpErrorResponse) =>
              e.status === 404
                ? of({ pagina: null, ausente: true })
                : (() => {
                    throw e;
                  })(),
            ),
            // El fallo se resuelve aquí, dentro de la navegación: si el error
            // se escapara del switchMap, el flujo moriría y el botón
            // «Reintentar» dejaría de funcionar.
            catchError((e: HttpErrorResponse) => {
              // status 0 = no se pudo contactar al servidor; 5xx = caído o mal.
              this.causaError.set(e.status === 0 ? 'red' : 'servidor');
              return of(null);
            }),
          );
      }),
      takeUntilDestroyed(),
    ).subscribe((resultado) => {
      if (!resultado) {
        this.estado.set('error');
        this.meta.updateTag({ name: 'robots', content: 'noindex' });
        return;
      }
      this.pagina.set(resultado.pagina);
      this.estado.set(resultado.ausente ? 'no-encontrada' : 'lista');
      this.meta.updateTag({ name: 'robots', content: resultado.ausente ? 'noindex' : 'index,follow' });
    });

    // El favicon lo publica la institución en su apariencia.
    effect(() => {
      const favicon = this.sitio.urlSegura(this.sitio.texto('favicon_url'));
      this.document
        .querySelector<HTMLLinkElement>('link[rel="icon"]')
        ?.setAttribute('href', favicon || '/favicon.ico');
    });
  }

  reintentar(): void {
    this.recarga.next(this.recarga.value + 1);
  }
}
