import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Encabezado de un bloque dentro de un editor de contenido: título, texto de
 * apoyo opcional y contador opcional. El contenido del bloque va proyectado.
 */
@Component({
  selector: 'app-seccion-bloque',
  standalone: true,
  template: `
    <header class="sb-head">
      <div class="sb-identidad">
        <span class="sb-icono" aria-hidden="true"><i class="fa-solid" [class]="iconoSeccion()"></i></span>
        <div class="sb-textos">
          <h3 class="sb-titulo">{{ titulo() }}</h3>
          @if (sub()) {
            <p class="sb-sub">{{ sub() }}</p>
          }
        </div>
      </div>
      @if (cuenta() !== null) {
        <span class="sb-cuenta">{{ cuenta() }} {{ cuentaSufijo() }}</span>
      }
    </header>
    <ng-content />
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    .sb-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid color-mix(in srgb, var(--adm-brand) 24%, var(--adm-line));
    }

    .sb-identidad {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
      flex: 1 1 auto;
    }

    .sb-textos { min-width: 0; }

    .sb-icono {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: 0 0 42px;
      width: 42px;
      height: 42px;
      border: 1px solid color-mix(in srgb, var(--adm-brand) 38%, var(--adm-line));
      border-radius: 12px;
      background: color-mix(in srgb, var(--adm-brand) 9%, var(--adm-surface));
      color: var(--adm-brand);
      font-size: 1rem;
    }

    .sb-titulo {
      margin: 0;
      font-size: 0.98rem;
      font-weight: 700;
      color: var(--adm-ink);
    }

    .sb-sub {
      margin: 3px 0 0;
      font-size: 0.8rem;
      color: var(--adm-ink-soft);
      line-height: 1.45;
    }

    .sb-cuenta {
      flex: none;
      padding: 4px 10px;
      border-radius: 999px;
      background: var(--adm-muted-bg);
      color: var(--adm-ink-soft);
      font-size: 0.74rem;
      font-weight: 600;
      white-space: nowrap;
    }

    @media (max-width: 600px) {
      .sb-head { flex-wrap: wrap; }
      .sb-icono { flex-basis: 38px; width: 38px; height: 38px; }
      .sb-identidad { gap: 10px; }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SeccionBloque {
  readonly titulo = input('');
  readonly sub = input('');
  readonly cuenta = input<number | null>(null);
  readonly cuentaSufijo = input('');
  readonly icono = input('');

  iconoSeccion(): string {
    if (this.icono()) return this.icono();
    const titulo = this.titulo().toLocaleLowerCase('es');
    if (/carrusel|imágenes|imagen|foto|galería|banner|portada/.test(titulo)) return 'fa-images';
    if (/licenciamiento|licencia|certific/.test(titulo)) return 'fa-certificate';
    if (/video|multimedia/.test(titulo)) return 'fa-video';
    if (/costo|monto|pago|tarifa|matrícula|pensión/.test(titulo)) return 'fa-coins';
    if (/documento|archivo|repositorio|descarga/.test(titulo)) return 'fa-folder-open';
    if (/contacto|correo|teléfono|dirección/.test(titulo)) return 'fa-address-book';
    if (/redes|social/.test(titulo)) return 'fa-share-nodes';
    if (/programa|estudio|académic|carrera/.test(titulo)) return 'fa-graduation-cap';
    if (/personal|docente|equipo|autoridad/.test(titulo)) return 'fa-users';
    if (/noticia|comunicado|publicaci/.test(titulo)) return 'fa-newspaper';
    if (/enlace|menú|navegaci/.test(titulo)) return 'fa-link';
    if (/texto|descripci|contenido|informaci/.test(titulo)) return 'fa-align-left';
    if (/fecha|horario|calendario/.test(titulo)) return 'fa-calendar-days';
    if (/ubicación|mapa/.test(titulo)) return 'fa-location-dot';
    return 'fa-layer-group';
  }
}
