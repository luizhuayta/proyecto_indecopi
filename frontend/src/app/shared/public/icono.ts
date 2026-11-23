import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import type { NombreIcono } from '../../cms/iconos';

/** Icono decorativo del sprite propio. El texto accesible lo pone el control que lo contiene. */
@Component({
  selector: 'app-icono',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  template: `<svg class="icono" aria-hidden="true" focusable="false"><use [attr.href]="'/iconos.svg#' + nombre"></use></svg>`,
})
export class Icono {
  // @Input (no input()): los tests corren con vitest JIT, donde los inputs de
  // señal no se registran en el def del componente.
  @Input({ required: true }) nombre!: NombreIcono;
}
