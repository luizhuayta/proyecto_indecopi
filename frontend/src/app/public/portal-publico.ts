import { Component, computed, inject, signal } from '@angular/core';
import { DOCUMENT, NgStyle } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, RouterLink, RouterLinkActive } from '@angular/router';
import { Title, Meta } from '@angular/platform-browser';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BehaviorSubject, catchError, combineLatest, forkJoin, map, of, switchMap, tap } from 'rxjs';
import { API_BASE, LOCALE, CmsDocResponse, CmsMenuItem, JsonMap } from '../cms/cms.models';
import { Identidad } from '../cms/cms-api.service';
import { CmsPageBlocks } from '../cms/blocks/cms-page-blocks';
import { temaPublico } from '../core/tema';

interface SitioPublico {
  identidad: Identidad;
  apariencia: JsonMap;
  menu: CmsMenuItem[];
  csrf: string;
}

@Component({
  selector: 'app-portal-publico',
  standalone: true,
  imports: [NgStyle, RouterLink, RouterLinkActive, CmsPageBlocks],
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

  readonly sitio = signal<SitioPublico | null>(null);
  readonly pagina = signal<CmsDocResponse | null>(null);
  readonly estado = signal<'cargando' | 'lista' | 'no-encontrada' | 'error'>('cargando');
  readonly menuAbierto = signal(false);
  readonly rutaActual = signal('/');
  readonly nombre = computed(() => this.sitio()?.identidad.nombre || 'Portal institucional');
  readonly apariencia = computed(() => this.sitio()?.apariencia ?? {});
  readonly tema = computed(() => temaPublico(this.apariencia()));
  readonly redes = computed(() => {
    const redes = this.apariencia()['redes'];
    return Array.isArray(redes) ? redes.filter((r) => r && typeof r.nombre === 'string' && this.urlSegura(r.url)) : [];
  });

  constructor() {
    combineLatest([this.route.url, this.recarga]).pipe(
      tap(() => {
        this.estado.set('cargando');
        this.pagina.set(null);
        this.menuAbierto.set(false);
      }),
      switchMap(([segmentos]) => {
        const ruta = '/' + segmentos.map((s) => s.path).join('/');
        this.rutaActual.set(ruta);
        return forkJoin({
        sitio: this.http.get<SitioPublico>(`${API_BASE}/publico/sitio`, { params: { locale: LOCALE } }),
        pagina: this.http.get<CmsDocResponse>(`${API_BASE}/publico/pagina`, {
          params: { locale: LOCALE, ruta },
        }).pipe(
          map((pagina) => ({ pagina, ausente: false })),
          catchError((e: HttpErrorResponse) => e.status === 404 ? of({ pagina: null, ausente: true }) : (() => { throw e; })()),
        ),
      }).pipe(catchError(() => of(null)));
      }),
      takeUntilDestroyed(),
    ).subscribe((resultado) => {
      if (!resultado) {
        this.estado.set('error');
        this.title.setTitle('No se pudo cargar el sitio');
        this.meta.updateTag({ name: 'robots', content: 'noindex' });
        return;
      }
      this.sitio.set(resultado.sitio);
      this.pagina.set(resultado.pagina.pagina);
      this.estado.set(resultado.pagina.ausente ? 'no-encontrada' : 'lista');
      this.title.setTitle(`${resultado.pagina.pagina?.titulo || 'Página no encontrada'} | ${this.nombre()}`);
      this.meta.updateTag({ name: 'robots', content: resultado.pagina.ausente ? 'noindex' : 'index,follow' });
      const favicon = this.urlSegura(this.texto('favicon_url'));
      this.document.querySelector<HTMLLinkElement>('link[rel="icon"]')?.setAttribute('href', favicon || 'favicon.ico');
    });
  }

  reintentar(): void { this.recarga.next(this.recarga.value + 1); }

  texto(clave: string): string {
    const valor = this.apariencia()[clave];
    return typeof valor === 'string' ? valor : '';
  }

  urlSegura(valor: unknown): string {
    if (typeof valor !== 'string') return '';
    return /^(?:\/(?![\/\\])|https?:\/\/)[^\s<>"'\\]+$/i.test(valor) ? valor : '';
  }
}
