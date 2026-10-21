import { Directive, input } from '@angular/core';

/**
 * Botón público. Aplica la clase `public-btn` con una variante de tono.
 * Se usa sobre `<a publicBtn>` o `<button publicBtn>`.
 */
@Directive({
  selector: 'a[publicBtn], button[publicBtn]',
  standalone: true,
  host: {
    class: 'public-btn',
    '[class.public-btn--primario]': 'tone() === "primario"',
    '[class.public-btn--secundario]': 'tone() === "secundario"',
    '[class.public-btn--fantasma]': 'tone() === "fantasma"',
  },
})
export class PublicButton {
  readonly tone = input<'primario' | 'secundario' | 'fantasma'>('primario');
}
