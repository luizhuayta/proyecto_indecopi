import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { EditorQuill } from '../editor-quill/editor-quill';

/**
 * Editor de texto con formato, con etiqueta y ayuda opcional. Envuelve al
 * editor enriquecido con un contenedor limpio. Presentacional y controlado.
 */
@Component({
  selector: 'app-campo-rico',
  standalone: true,
  imports: [EditorQuill],
  template: `
    <span class="cr-cabecera"><span class="cr-icono" aria-hidden="true"><i class="fa-solid fa-align-left"></i></span><span class="cr-label">{{ label() }}</span></span>
    @if (hint()) {
      <span class="cr-hint">
        @if (info()) {
          <i class="fa fa-circle-info" aria-hidden="true"></i>
        }
        {{ hint() }}
      </span>
    }
    <app-editor-quill
      [html]="valor()"
      [placeholder]="placeholder()"
      [compacto]="compacto()"
      (htmlChange)="valorChange.emit($event)"
    />
  `,
  styles: `
    :host {
      display:flex;
      flex-direction:column;
      gap:10px;
      padding:16px;
      border:1px solid var(--adm-line);
      border-radius:14px;
      background:var(--adm-surface);
      min-width:0;
    }
    .cr-cabecera { display:flex; align-items:center; gap:10px; }
    .cr-icono {
      display:inline-flex; align-items:center; justify-content:center;
      flex:0 0 38px; width:38px; height:38px;
      border:1px solid color-mix(in srgb,var(--adm-brand) 32%,var(--adm-line));
      border-radius:11px;
      background:color-mix(in srgb,var(--adm-brand) 9%,var(--adm-surface));
      color:var(--adm-brand);
    }

    .cr-label {
      font-size: 0.78rem;
      font-weight: 600;
      color: var(--adm-ink);
    }

    .cr-hint {
      display: inline-flex;
      align-items: baseline;
      gap: 5px;
      margin-bottom: 3px;
      font-size: 0.73rem;
      color: var(--adm-ink-soft);
      line-height: 1.45;
    }

    .cr-hint .fa {
      font-size: 0.72rem;
      color: var(--adm-ink-soft);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CampoRico {
  readonly label = input('');
  readonly valor = input('');
  readonly hint = input('');
  readonly info = input(false);
  readonly placeholder = input('Escriba aquí…');
  readonly compacto = input(false);

  readonly valorChange = output<string>();
}
