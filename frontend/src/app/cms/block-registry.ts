import type { JsonMap } from './cms.models';
import { BLOCK_CATALOG, PAGE_TEMPLATES } from './block-catalog.generated';
import type { CmsBlock, BlockTypeDef, PageTemplateDef } from './block-types';

export type { CmsBlock, BlockTypeDef, PageTemplateDef };
export { BLOCK_CATALOG, PAGE_TEMPLATES };

export function newBlockId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export const BLOCK_TYPES: BlockTypeDef[] = Object.values(BLOCK_CATALOG);

export function blockTypeDef(type: string): BlockTypeDef | null {
  return BLOCK_CATALOG[type] ?? null;
}

export function makeBlock(type: string, props?: JsonMap, hidden = false): CmsBlock {
  const def = BLOCK_CATALOG[type];
  return {
    id: newBlockId(),
    type,
    hidden,
    layout: { width: 'full', padding: '', background: '' },
    props: { ...(def?.defaults ?? {}), ...(props ?? {}) },
  };
}

export function pageBlocks(contenido: JsonMap): CmsBlock[] {
  const raw = contenido['blocks'];
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter(
    (row): row is CmsBlock =>
      !!row && typeof row === 'object' && typeof (row as CmsBlock).type === 'string',
  );
}

export function visibleBlocks(contenido: JsonMap): CmsBlock[] {
  return pageBlocks(contenido).filter((block) => !block.hidden);
}

export function blockLabel(type: string): string {
  return BLOCK_CATALOG[type]?.label ?? type;
}

export function templateBlocks(templateId: string): CmsBlock[] {
  const tpl = PAGE_TEMPLATES.find((template) => template.id === templateId);
  if (!tpl) {
    return [makeBlock('richText')];
  }
  return tpl.blocks.map((entry) => makeBlock(entry.type, entry.props));
}
