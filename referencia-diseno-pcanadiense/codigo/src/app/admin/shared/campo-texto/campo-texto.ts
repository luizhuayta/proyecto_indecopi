import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * Campo de texto con etiqueta y ayuda opcional. Presentacional y controlado:
 * recibe `valor` y emite `valorChange` en cada tecla.
 */
@Component({
  selector: 'app-campo-texto',
  standalone: true,
  template: `
    <label class="ct">
      <span class="ct-cabecera"><span class="ct-icono" aria-hidden="true"><i class="fa-solid" [class]="iconoCampo()"></i></span><span class="ct-label">{{ label() }}</span></span>
      @if (multilinea()) {
        <textarea
          rows="4"
          [value]="valor()"
          [placeholder]="placeholder()"
          (input)="valorChange.emit($any($event.target).value)"
        ></textarea>
      } @else {
        <input
          [type]="tipo()"
          [value]="valor()"
          [placeholder]="placeholder()"
          [attr.inputmode]="tipo() === 'url' ? 'url' : tipo() === 'number' ? 'decimal' : null"
          [attr.min]="tipo() === 'number' ? '0' : null"
          [attr.step]="tipo() === 'number' ? '0.01' : null"
          (input)="valorChange.emit($any($event.target).value)"
        />
      }
      @if (hint()) {
        <span class="ct-hint">{{ hint() }}</span>
      }
    </label>
  `,
  styles: `
    :host {
      display: block;
    }

    .ct {
      display:flex;
      flex-direction:column;
      gap:10px;
      padding:16px;
      border:1px solid var(--adm-line);
      border-radius:14px;
      background:var(--adm-surface);
      min-width:0;
    }
    .ct-cabecera { display:flex; align-items:center; gap:10px; }
    .ct-icono {
      display:inline-flex; align-items:center; justify-content:center;
      flex:0 0 38px; width:38px; height:38px;
      border:1px solid color-mix(in srgb,var(--adm-brand) 32%,var(--adm-line));
      border-radius:11px;
      background:color-mix(in srgb,var(--adm-brand) 9%,var(--adm-surface));
      color:var(--adm-brand);
    }

    .ct-label {
      font-size: 0.78rem;
      font-weight: 600;
      color: var(--adm-ink);
    }

    input,
    textarea {
      width: 100%;
      min-height: 40px;
      padding: 9px 12px;
      border: 1px solid var(--adm-line);
      border-radius: 9px;
      background: var(--adm-bg);
      color: var(--adm-ink);
      font: inherit;
      font-size: 0.9rem;
      transition:
        border-color 0.15s ease,
        background 0.15s ease,
        box-shadow 0.15s ease;
    }

    textarea {
      resize: vertical;
      line-height: 1.5;
    }

    input:hover,
    textarea:hover {
      border-color: color-mix(in srgb, var(--adm-ink) 20%, var(--adm-line));
    }

    input:focus,
    textarea:focus {
      outline: none;
      border-color: var(--adm-brand);
      background: var(--adm-surface);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--adm-brand) 16%, transparent);
    }

    .ct-hint {
      font-size: 0.73rem;
      color: var(--adm-ink-soft);
      line-height: 1.4;
    }

    @media (prefers-reduced-motion: reduce) {
      input,
      textarea {
        transition: none;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CampoTexto {
  readonly label = input('');
  readonly valor = input('');
  readonly placeholder = input('');
  readonly hint = input('');
  readonly tipo = input<'text' | 'url' | 'number'>('text');
  readonly multilinea = input(false);

  readonly valorChange = output<string>();
  iconoCampo(): string {
    const l=this.label().toLocaleLowerCase('es');
    if (/título|nombre|portada/.test(l)) return 'fa-heading';
    if (/correo|email/.test(l)) return 'fa-envelope';
    if (/teléfono|celular/.test(l)) return 'fa-phone';
    if (/fecha|horario/.test(l)) return 'fa-calendar-days';
    if (/costo|monto|precio/.test(l)) return 'fa-coins';
    if (/url|enlace|web/.test(l) || this.tipo()==='url') return 'fa-link';
    if (/descrip|mensaje|texto|introduc/.test(l) || this.multilinea()) return 'fa-align-left';
    return 'fa-pen-to-square';
  }
}
