import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { getPath, setPath } from '../../../core/store/object-path';
import { CampoLista } from '../campo-lista/campo-lista';
import { EditorQuill } from '../editor-quill/editor-quill';
import { MiniaturaImagen } from '../miniatura-imagen/miniatura-imagen';
import { SelectorArchivo } from '../selector-archivo/selector-archivo';
import type { CampoSchema } from './schema';

@Component({
  selector: 'app-editor-contenido',
  standalone: true,
  imports: [CampoLista, EditorQuill, MiniaturaImagen, SelectorArchivo],
  template: `
    @for (campo of schema(); track campo.key) {
      <div
        class="form-row"
        [class.form-row--lista]="campo.tipo === 'filas' || campo.tipo === 'lista'"
      >
        <div class="campo-cabecera">
          <span class="campo-icono" aria-hidden="true"><i class="fa-solid" [class]="iconoCampo(campo.label, campo.tipo)"></i></span>
          <div class="campo-cabecera-texto">
            <label [attr.for]="'campo-' + campo.key">{{ campo.label }}</label>
            @if (campo.hint) {
              <p class="campo-ayuda" [id]="'ayuda-' + campo.key">{{ campo.hint }}</p>
            }
          </div>
        </div>
        @switch (campo.tipo) {
          @case ('area') {
            <app-editor-quill
              [html]="texto(campo.key)"
              (htmlChange)="setTexto(campo.key, $event)"
            />
          }
          @case ('numero') {
            <input
              class="campo-numero"
              [id]="'campo-' + campo.key"
              type="number"
              [attr.aria-describedby]="campo.hint ? 'ayuda-' + campo.key : null"
              [value]="texto(campo.key)"
              (input)="setNumero(campo.key, $event)"
            />
          }
          @case ('url') {
            @if (campo.acepta === 'imagen') {
              <div class="campo-imagen">
                <app-miniatura-imagen
                  class="campo-imagen-preview"
                  [referencia]="texto(campo.key)"
                  [alt]="campo.label"
                />
                <div class="campo-imagen-controles">
                  <input
                    [id]="'campo-' + campo.key"
                    type="text"
                    [attr.aria-describedby]="campo.hint ? 'ayuda-' + campo.key : null"
                    placeholder="images/… o https://…"
                    [value]="texto(campo.key)"
                    (input)="setTexto(campo.key, $any($event.target).value)"
                  />
                  <app-selector-archivo
                    class="campo-selector"
                    [modo]="campo.acepta"
                    [referencia]="texto(campo.key)"
                    (referenciaChange)="setTexto(campo.key, $event)"
                  />
                </div>
              </div>
            } @else {
              <input
                [id]="'campo-' + campo.key"
                type="text"
                [attr.aria-describedby]="campo.hint ? 'ayuda-' + campo.key : null"
                [value]="texto(campo.key)"
                (input)="setTexto(campo.key, $any($event.target).value)"
              />
              @if (campo.acepta) {
                <app-selector-archivo
                  class="campo-selector"
                  [modo]="campo.acepta"
                  [referencia]="texto(campo.key)"
                  (referenciaChange)="setTexto(campo.key, $event)"
                />
              }
            }
          }
          @case ('lista') {
            <app-campo-lista
              modo="lista"
              [items]="get(campo.key)"
              (itemsChange)="set(campo.key, $event)"
            />
          }
          @case ('filas') {
            <app-campo-lista
              modo="filas"
              [items]="get(campo.key)"
              [columnas]="campo.columnas"
              (itemsChange)="set(campo.key, $event)"
            />
          }
          @default {
            <input
              [id]="'campo-' + campo.key"
              type="text"
              [attr.aria-describedby]="campo.hint ? 'ayuda-' + campo.key : null"
              [value]="texto(campo.key)"
              (input)="setTexto(campo.key, $any($event.target).value)"
            />
          }
        }
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
    }

    :host > .form-row + .form-row {
      margin-top: 24px;
      padding-top: 24px;
      border-top: 1px solid var(--adm-line);
    }


    /* Tarjetas de campos con iconos y ayudas claras, según la paleta activa. */
    :host > .form-row {
      padding:18px;
      margin-bottom:14px;
      border:1px solid var(--adm-line);
      border-radius:15px;
      background:var(--adm-surface);
      gap:12px;
      min-width:0;
    }
    :host > .form-row + .form-row {
      margin-top:14px;
      padding-top:18px;
      border-top:1px solid var(--adm-line);
    }
    .campo-cabecera {
      display:flex;
      align-items:center;
      gap:12px;
      min-width:0;
    }
    .campo-cabecera-texto { min-width:0; }
    .campo-cabecera label {
      display:block;
      font-size:.88rem;
      font-weight:750;
      line-height:1.35;
      color:var(--adm-ink);
    }
    .campo-icono {
      display:inline-flex;
      align-items:center;
      justify-content:center;
      flex:0 0 42px;
      width:42px;
      height:42px;
      border-radius:12px;
      border:1px solid color-mix(in srgb,var(--adm-brand) 29%,var(--adm-line));
      background:color-mix(in srgb,var(--adm-brand) 9%,var(--adm-surface));
      color:var(--adm-brand);
      font-size:1rem;
    }
    .campo-ayuda {
      margin:4px 0 0;
      font-size:.79rem;
      line-height:1.5;
      color:var(--adm-muted);
    }
    @media(max-width:620px) {
      :host > .form-row { padding:14px; }
      .campo-icono { flex-basis:38px; width:38px; height:38px; }
    }

    .form-row--lista > label {
      margin-bottom: 2px;
      font-size: 0.85rem;
      font-weight: 700;
      color: var(--adm-ink);
    }

    .campo-numero {
      max-width: 160px;
    }

    .campo-imagen {
      display: flex;
      gap: 20px;
      align-items: flex-start;
    }

    .campo-imagen-preview {
      --miniatura-size: 92px;
      margin-top: 2px;
    }

    .campo-imagen-controles {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .campo-selector {
      display: block;
    }

    /* La zona de arrastre es secundaria frente al campo de texto. */
    .campo-imagen-controles ::ng-deep .dropzone {
      padding: 12px 14px;
    }

    .campo-imagen-controles ::ng-deep .dropzone i {
      font-size: 1rem;
    }

    @media (max-width: 620px) {
      .campo-imagen {
        flex-direction: column;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditorContenido {
  readonly schema = input<CampoSchema[]>([]);
  readonly valor = input<unknown>({});
  readonly valorChange = output<unknown>();


  iconoCampo(label: string, tipo: string): string {
    const texto = label.toLocaleLowerCase('es');
    if (/título|nombre|encabezado|portada/.test(texto)) return 'fa-heading';
    if (/introduc|mensaje|descrip|texto|reseña|contenido|bajada/.test(texto)) return 'fa-align-left';
    if (/correo|email/.test(texto)) return 'fa-envelope';
    if (/teléfono|celular|whatsapp/.test(texto)) return 'fa-phone';
    if (/dirección|ubicación|mapa/.test(texto)) return 'fa-location-dot';
    if (/fecha|cronograma|calendario/.test(texto)) return 'fa-calendar-days';
    if (/enlace|url|web|sitio/.test(texto)) return 'fa-link';
    if (/imagen|foto|banner|logo/.test(texto) || (tipo === 'url')) return 'fa-image';
    if (/costo|monto|precio|pago/.test(texto)) return 'fa-coins';
    if (/programa|estudio|carrera/.test(texto)) return 'fa-graduation-cap';
    if (tipo === 'lista' || tipo === 'filas') return 'fa-list';
    if (tipo === 'numero') return 'fa-hashtag';
    if (tipo === 'area') return 'fa-align-left';
    return 'fa-pen-to-square';
  }

  get(key: string): unknown {
    return getPath(this.valor(), key);
  }

  texto(key: string): string {
    const v = this.get(key);
    return v === undefined || v === null ? '' : String(v);
  }

  set(key: string, val: unknown): void {
    this.valorChange.emit(setPath(this.valor(), key, val));
  }

  setTexto(key: string, val: string): void {
    this.set(key, val);
  }

  setNumero(key: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    this.set(key, Number.isFinite(input.valueAsNumber) ? input.valueAsNumber : 0);
  }
}
