import { inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { CmsContentService } from '../cms/cms-content.service';

/**
 * Avisa antes de salir del editor cuando hay cambios sin guardar.
 */
export const dirtyGuard: CanDeactivateFn<unknown> = () => {
  const cms = inject(CmsContentService);
  if (!cms.dirty()) {
    return true;
  }
  return confirm('Hay cambios sin guardar. ¿Salir de todos modos?');
};
