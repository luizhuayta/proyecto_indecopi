import { Component, Input, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { SitioPublicoService } from '../core/sitio-publico.service';

/**
 * Marco compartido del sitio público: la cabecera con la marca, el buscador y
 * el menú de navegación, y el pie con los datos de la institución.
 *
 * Vive en un solo sitio para que toda página del portal comparta el mismo
 * lenguaje visual y la misma navegación. Antes de existir este marco, la
 * página de resultados de búsqueda era un tercer sistema: otro color, sin
 * cabecera y sin pie.
 *
 * El contenido de la página se proyecta entre la cabecera y el pie.
 */
@Component({
  selector: 'app-marco-portal',
  standalone: true,
  imports: [FormsModule, RouterLink, RouterLinkActive],
  template: `
    <a class="saltar-contenido" href="#contenido-principal">Saltar al contenido</a>

    <header class="cabecera">
      <div class="marco-ancho cabecera__fila">
        <a class="marca" routerLink="/" [attr.aria-label]="sitio.nombre() + ', inicio'">
          @if (logo(); as logo) {
            <img [src]="logo" [alt]="sitio.texto('logo_alt') || sitio.nombre()" width="64" height="64" />
          }
          <span>{{ sitio.nombre() }}</span>
        </a>
        @if (sitio.menu().length > 0) {
          <button
            class="menu-control"
            type="button"
            aria-controls="navegacion-principal"
            [attr.aria-expanded]="menuAbierto()"
            (click)="menuAbierto.set(!menuAbierto())"
          >
            Menú
          </button>
        }
        <div class="cabecera__acciones">
          @if (mostrarBuscador) {
            <form class="busqueda-form busqueda-cabecera" role="search" (ngSubmit)="buscarDesdeCabecera()">
              <label class="sr-only" for="busqueda-cabecera-campo">Buscar en el sitio</label>
              <input
                id="busqueda-cabecera-campo"
                class="busqueda-form__campo"
                type="search"
                name="q"
                autocomplete="off"
                maxlength="120"
                placeholder="Buscar en el sitio"
                [(ngModel)]="consulta"
              />
              <button class="busqueda-form__boton" type="submit">Buscar</button>
            </form>
          }
          <nav
            id="navegacion-principal"
            aria-label="Navegación principal"
            [class.abierta]="menuAbierto()"
          >
            @for (item of sitio.menu(); track item.slug) {
              <a
                [routerLink]="item.ruta"
                routerLinkActive="activo"
                ariaCurrentWhenActive="page"
                [routerLinkActiveOptions]="{ exact: true }"
                (click)="menuAbierto.set(false)"
                >{{ item.titulo }}</a
              >
            }
          </nav>
        </div>
      </div>
    </header>

    <ng-content />

    <footer class="pie">
      <div class="marco-ancho pie__contenido">
        <section aria-label="Datos de la institución">
          <h2>{{ sitio.nombre() }}</h2>
          @if (sitio.identidad(); as identidad) {
            <address>
              @if (identidad.direccion) {
                <p>{{ identidad.direccion }}</p>
              }
              @if (identidad.ciudad) {
                <p>{{ identidad.ciudad }}</p>
              }
              @if (correo(); as correo) {
                <p><a [href]="'mailto:' + correo">{{ correo }}</a></p>
              }
              @if (telefono(); as telefono) {
                <p><a [href]="'tel:' + telefono">{{ telefono }}</a></p>
              }
            </address>
            @if (identidad.ruc) {
              <p>RUC: {{ identidad.ruc }}</p>
            }
          }
        </section>

        <nav class="pie__columna" aria-label="Navegación institucional">
          <h2 class="pie__titulo">Información</h2>
          <ul>
            @for (item of sitio.menu(); track item.slug) {
              <li><a [routerLink]="item.ruta || '/' + item.slug">{{ item.titulo }}</a></li>
            }
            <li><a routerLink="/libro-de-reclamaciones">Libro de Reclamaciones</a></li>
          </ul>
        </nav>

        @if (sitio.redes().length) {
          <nav class="pie__columna" aria-label="Redes de la institución">
            <h2 class="pie__titulo">Redes</h2>
            <ul>
              @for (red of sitio.redes(); track $index) {
                <li><a [href]="sitio.urlSegura(red.url)">{{ red.nombre }}</a></li>
              }
            </ul>
          </nav>
        }
      </div>
      <div class="marco-ancho pie__base">
        <p>{{ sitio.texto('pie_legal') }}</p>
        <a routerLink="/admin/login">Acceso al panel</a>
      </div>
    </footer>
  `,
})
export class MarcoPortal {
  /** Datos publicados del sitio: identidad, apariencia y menú. */
  readonly sitio = inject(SitioPublicoService);
  private readonly router = inject(Router);

  /**
   * En la página de resultados el buscador del marco se oculta: ahí ya hay un
   * formulario de búsqueda, y dos campos para lo mismo confunden.
   */
  @Input() mostrarBuscador = true;

  readonly menuAbierto = signal(false);

  consulta = '';

  readonly logo = computed(() => this.sitio.urlSegura(this.sitio.texto('logo_url')));
  readonly correo = computed(() => this.sitio.texto('correo_contacto') || this.sitio.identidad()?.correo || '');
  readonly telefono = computed(
    () => this.sitio.texto('telefono_contacto') || this.sitio.identidad()?.telefono || '',
  );

  constructor() {
    // Al navegar, el menú móvil se cierra: si no, tapa el contenido nuevo.
    this.router.events
      .pipe(
        filter((evento) => evento instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.menuAbierto.set(false));
  }

  buscarDesdeCabecera(): void {
    const q = this.consulta.trim();
    this.menuAbierto.set(false);
    void this.router.navigate(['/buscar'], { queryParams: q ? { q } : {} });
  }
}
