import { Component, computed, effect, inject, signal } from '@angular/core';
import { DOCUMENT, NgStyle } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Title, Meta } from '@angular/platform-browser';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BehaviorSubject, catchError, combineLatest, map, of, switchMap, tap } from 'rxjs';
import { API_BASE, LOCALE, CmsDocResponse } from '../cms/cms.models';
import { CmsPageBlocks } from '../cms/blocks/cms-page-blocks';
import { pageBlocks } from '../cms/block-registry';
import { SitioPublicoService } from '../core/sitio-publico.service';
import { MarcoPortal } from './marco-portal';

/** Bloques que ya muestran el título de la página en grande. */
const TIPOS_HEROE = new Set(['hero', 'pageHero', 'listingHero', 'serviceHero']);

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

  /** True si la página abre con un héroe: entonces el título visible lo da el héroe. */
  readonly abreConHeroe = computed(() => {
    const contenido = this.pagina()?.contenido;
    const primero = contenido ? pageBlocks(contenido).find((b) => !b.hidden) : undefined;
    return !!primero && TIPOS_HEROE.has(primero.type);
  });
  /** Causa del estado 'error', para dar un mensaje útil al visitante. */
  readonly causaError = signal<'red' | 'servidor'>('servidor');
  readonly rutaActual = signal('/');

  constructor() {
    // El título y las etiquetas para compartir dependen de la página y del
    // nombre de la institución, que puede llegar después: el efecto vuelve a
    // ejecutarse cuando cambie cualquiera.
    effect(() => {
      const estado = this.estado();
      if (estado === 'cargando') {
        return;
      }
      if (estado === 'error') {
        this.title.setTitle('No se pudo cargar el sitio');
        return;
      }
      const pagina = this.pagina();
      const titulo = pagina?.titulo || 'Página no encontrada';
      const nombre = this.sitio.nombre();
      this.title.setTitle(`${titulo} | ${nombre}`);
      this.ponerEtiquetasSociales(titulo, pagina?.descripcion ?? '');
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

    // La barra del navegador en móvil toma el color de la institución.
    effect(() => {
      const primario = this.sitio.texto('color_primario');
      if (/^#(?:[a-f\d]{3}|[a-f\d]{6})$/i.test(primario)) {
        this.meta.updateTag({ name: 'theme-color', content: primario });
      }
    });
  }

  reintentar(): void {
    this.recarga.next(this.recarga.value + 1);
  }

  /**
   * Etiquetas para compartir: description, canonical y Open Graph.
   *
   * Un enlace del portal se comparte por WhatsApp o por correo, y quien lo
   * abre no ve la página: ve lo que dicen estas etiquetas. Sin ellas, el
   * enlace sale con el nombre de la plantilla y sin imagen.
   */
  private ponerEtiquetasSociales(titulo: string, descripcion: string): void {
    const nombre = this.sitio.nombre();
    const url = this.urlCanonica();
    const texto = descripcion || `${titulo} — ${nombre}`;
    const imagen = this.imagenParaCompartir();

    this.meta.updateTag({ name: 'description', content: texto });
    this.meta.updateTag({ property: 'og:site_name', content: nombre });
    this.meta.updateTag({ property: 'og:type', content: 'website' });
    this.meta.updateTag({ property: 'og:title', content: titulo });
    this.meta.updateTag({ property: 'og:description', content: texto });
    this.meta.updateTag({ property: 'og:url', content: url });
    this.meta.updateTag({ property: 'og:locale', content: 'es_PE' });
    this.meta.updateTag({ name: 'twitter:card', content: imagen ? 'summary_large_image' : 'summary' });
    this.meta.updateTag({ name: 'twitter:title', content: titulo });
    this.meta.updateTag({ name: 'twitter:description', content: texto });
    if (imagen) {
      this.meta.updateTag({ property: 'og:image', content: imagen });
      this.meta.updateTag({ name: 'twitter:image', content: imagen });
    }
    // La URL canónica evita que dos rutas de la misma página se indexen dos
    // veces. Se actualiza la etiqueta en vez de duplicarla.
    let canonica = this.document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonica) {
      canonica = this.document.createElement('link');
      canonica.setAttribute('rel', 'canonical');
      this.document.head.appendChild(canonica);
    }
    canonica.setAttribute('href', url);
  }

  /** URL absoluta de la página actual, con la ruta que el visitante ve. */
  private urlCanonica(): string {
    const origen = this.document.location?.origin ?? '';
    const ruta = this.rutaActual() || '/';
    return `${origen}${ruta === '/' ? '/' : ruta.replace(/\/$/, '')}`;
  }

  /**
   * Imagen para la vista previa al compartir. La institución publica su
   * logo; si no hay, se usa la primera imagen de la propia página.
   */
  private imagenParaCompartir(): string {
    const logo = this.sitio.urlSegura(this.sitio.texto('logo_url'));
    if (logo) {
      return this.urlAbsoluta(logo);
    }
    return '';
  }

  /** Convierte una ruta del sitio en una URL absoluta, como piden los rastreadores. */
  private urlAbsoluta(url: string): string {
    if (/^https?:\/\//i.test(url)) {
      return url;
    }
    const origen = this.document.location?.origin ?? '';
    return `${origen}${url.startsWith('/') ? url : '/' + url}`;
  }
}
