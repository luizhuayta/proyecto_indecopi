import { beforeEach, describe, expect, it } from 'vitest';
import { CmsHistoryService, FieldPatch } from './cms-history.service';

function patch(overrides: Partial<FieldPatch> = {}): FieldPatch {
  return {
    slug: 'inicio',
    path: 'titulo',
    scope: 'page',
    before: 'antes',
    after: 'después',
    ...overrides,
  };
}

describe('CmsHistoryService', () => {
  let service: CmsHistoryService;

  beforeEach(() => {
    service = new CmsHistoryService();
  });

  it('deshacer devuelve el valor anterior', () => {
    service.push(patch({ before: 'viejo', after: 'nuevo' }));
    const item = service.takeUndo();
    expect(item).not.toBeNull();
    expect(item!.before).toBe('viejo');
    expect(service.canUndo()).toBe(false);
  });

  it('rehacer vuelve a aplicar el valor nuevo', () => {
    service.push(patch({ before: 'viejo', after: 'nuevo' }));
    service.takeUndo();
    const item = service.takeRedo();
    expect(item).not.toBeNull();
    expect(item!.after).toBe('nuevo');
    expect(service.canRedo()).toBe(false);
  });

  it('el historial tiene un maximo de 50 pasos', () => {
    for (let i = 0; i < 60; i++) {
      service.push(patch({ before: i, after: i + 1 }));
    }
    expect(service.undoStack()).toHaveLength(50);
    expect(service.undoStack()[0].before).toBe(10);
  });

  it('deshacer en una pila vacia no hace nada', () => {
    expect(service.takeUndo()).toBeNull();
    expect(service.canUndo()).toBe(false);
    expect(service.canRedo()).toBe(false);
  });
});
