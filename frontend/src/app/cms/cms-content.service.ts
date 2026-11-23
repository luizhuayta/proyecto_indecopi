import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { CmsApiService } from './cms-api.service';
import { CmsHistoryService } from './cms-history.service';
import {
  CmsDocResponse,
  CmsMenuItem,
  CmsPageSummary,
  CmsRevision,
  ImageMeta,
  JsonMap,
  getByPath,
  rutaInvalida,
  setByPath,
} from './cms.models';
import { BLOCK_CATALOG, makeBlock, pageBlocks } from './block-registry';
import type { CmsBlock } from './block-registry';
import { fieldLabel } from './cms-schema';

/** Slug interno que representa la configuración del sitio (no es una página). */
const SITIO_SLUG = 'sitio';

@Injectable({ providedIn: 'root' })
export class CmsContentService {
  private readonly api = inject(CmsApiService);
  private readonly undoHistory = inject(CmsHistoryService);

  readonly site = signal<JsonMap>({});
  readonly pages = signal<Record<string, JsonMap>>({});
  readonly pageList = signal<CmsPageSummary[]>([]);
  readonly menuItems = signal<CmsMenuItem[]>([]);
  readonly currentSlug = signal('inicio');
  readonly dirty = signal(false);
  readonly saving = signal(false);
  readonly loaded = signal(false);
  readonly loadingSlug = signal<string | null>(null);
  readonly publicLoadError = signal('');
  readonly conflict = signal('');
  readonly hasDraft = signal<Record<string, boolean>>({});
  readonly versions = signal<Record<string, number>>({});
  readonly dirtyFields = signal<Set<string>>(new Set());
  readonly imageMeta = signal<Record<string, ImageMeta>>({});
  readonly fieldError = signal<{ path: string; message: string } | null>(null);

  private autosaveTimer?: number;
  private editing = false;
  private readonly onBeforeUnload = (event: BeforeUnloadEvent) => {
    if (this.dirty()) {
      event.preventDefault();
      event.returnValue = '';
    }
  };

  readonly activeContent = computed(() => {
    const slug = this.currentSlug();
    return slug === SITIO_SLUG ? this.site() : (this.pages()[slug] ?? {});
  });

  useSlug(slug: string): void {
    this.currentSlug.set(slug);
  }

  startEditingSession(): void {
    this.editing = true;
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', this.onBeforeUnload);
    }
  }

  stopEditingSession(): void {
    this.editing = false;
    if (typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', this.onBeforeUnload);
    }
    if (this.autosaveTimer) {
      window.clearTimeout(this.autosaveTimer);
      this.autosaveTimer = undefined;
    }
  }

  get<T = unknown>(path: string, scope: 'page' | 'site' = 'page'): T {
    const root = scope === 'site' ? this.site() : this.activeContent();
    return getByPath(root, path) as T;
  }

  set(path: string, value: unknown, scope: 'page' | 'site' = 'page'): void {
    // Una ruta mal formada escribiría una clave basura en el borrador y el
    // autoguardado la persistiría. Se corta en seco.
    if (rutaInvalida(path)) {
      console.warn('[CMS] Se ignoró una escritura con ruta de campo inválida:', path);
      return;
    }
    const slug = this.currentSlug();
    const before = this.get(path, scope);
    if (Object.is(before, value) || JSON.stringify(before) === JSON.stringify(value)) {
      return;
    }
    this.undoHistory.push({ slug, path, scope, before, after: value });
    this.applyValue(slug, path, value, scope);
    this.dirty.set(true);
    this.dirtyFields.update((set) => new Set(set).add(`${slug}:${path}`));
    this.scheduleAutosave();
  }

  addBlock(type: string, index?: number): void {
    if (!BLOCK_CATALOG[type]) {
      return;
    }
    const list = [...pageBlocks(this.activeContent())];
    const block = makeBlock(type);
    if (index == null || index < 0 || index > list.length) {
      list.push(block);
    } else {
      list.splice(index, 0, block);
    }
    this.set('blocks', list);
  }

  duplicateBlock(index: number): void {
    const list = [...pageBlocks(this.activeContent())];
    if (!list[index]) {
      return;
    }
    const copy: CmsBlock = { ...structuredClone(list[index]), id: makeBlock(list[index].type).id };
    list.splice(index + 1, 0, copy);
    this.set('blocks', list);
  }

  removeBlock(index: number): void {
    const list = [...pageBlocks(this.activeContent())];
    if (list.length <= 1) {
      this.conflict.set('Debe quedar al menos un elemento.');
      return;
    }
    this.removeListItem('blocks', index);
  }

  addListItem(path: string): void {
    const list = [...(this.get<unknown[]>(path) ?? [])];
    const template = list.length > 0 ? structuredClone(list[list.length - 1]) : {};
    list.push(template);
    this.set(path, list);
  }

  removeListItem(path: string, index: number): void {
    const list = [...(this.get<unknown[]>(path) ?? [])];
    if (list.length <= 1) {
      this.conflict.set('Debe quedar al menos un elemento.');
      return;
    }
    list.splice(index, 1);
    this.set(path, list);
  }

  moveListItem(path: string, from: number, to: number): void {
    const list = [...(this.get<unknown[]>(path) ?? [])];
    if (to < 0 || to >= list.length) {
      return;
    }
    const [item] = list.splice(from, 1);
    list.splice(to, 0, item);
    this.set(path, list);
  }

  undo(): void {
    const last = this.undoHistory.takeUndo();
    if (!last) {
      return;
    }
    this.applyValue(last.slug, last.path, last.before, last.scope);
    this.dirty.set(true);
    this.scheduleAutosave();
  }

  redo(): void {
    const last = this.undoHistory.takeRedo();
    if (!last) {
      return;
    }
    this.applyValue(last.slug, last.path, last.after, last.scope);
    this.dirty.set(true);
    this.scheduleAutosave();
  }

  changeLines(): { path: string; text: string }[] {
    const slug = this.currentSlug();
    return [...this.dirtyFields()]
      .filter((key) => key.startsWith(`${slug}:`) && !key.endsWith(':'))
      .map((key) => {
        const path = key.slice(slug.length + 1);
        return { path, text: fieldLabel(path) };
      });
  }

  async loadAll(): Promise<void> {
    const [siteDoc, catalog] = await Promise.all([
      this.api.getConfiguracion(),
      this.api.getPaginas(),
    ]);
    this.writeDoc(SITIO_SLUG, siteDoc);
    this.pageList.set(catalog.paginas);
    this.menuItems.set(catalog.menu);
    const pageMap: Record<string, JsonMap> = {};
    const versions: Record<string, number> = { ...this.versions(), [SITIO_SLUG]: siteDoc.version };
    const drafts: Record<string, boolean> = {
      ...this.hasDraft(),
      [SITIO_SLUG]: !!siteDoc.tiene_borrador,
    };
    await Promise.all(
      catalog.paginas.map(async (p) => {
        const full = await this.api.getPagina(p.slug);
        pageMap[p.slug] = full.contenido ?? {};
        versions[p.slug] = full.version;
        drafts[p.slug] = !!full.tiene_borrador;
      })
    );
    this.pages.set(pageMap);
    this.versions.set(versions);
    this.hasDraft.set(drafts);
    this.loaded.set(true);
    this.dirty.set(false);
    this.conflict.set('');
  }

  async loadPublic(slug: string): Promise<void> {
    const target = slug || 'inicio';
    this.loadingSlug.set(target);
    this.publicLoadError.set('');
    try {
      if (target === SITIO_SLUG) {
        const siteDoc = await this.api.getConfiguracion();
        this.writeDoc(SITIO_SLUG, siteDoc);
      } else if (!this.pages()[target]) {
        const full = await this.api.getPagina(target);
        this.writeDoc(target, full);
      }
      this.currentSlug.set(target);
      this.loaded.set(true);
    } catch {
      this.publicLoadError.set('No pudimos cargar el contenido. Inténtalo de nuevo en unos segundos.');
    } finally {
      if (this.loadingSlug() === target) {
        this.loadingSlug.set(null);
      }
    }
  }

  async reloadSlug(slug: string): Promise<void> {
    const full =
      slug === SITIO_SLUG ? await this.api.getConfiguracion() : await this.api.getPagina(slug);
    this.writeDoc(slug, full);
    this.dirty.set(false);
    this.conflict.set('');
    this.undoHistory.clear();
    this.dirtyFields.set(new Set());
  }

  async listarRevisiones(slug: string): Promise<CmsRevision[]> {
    return this.api.listarRevisiones(slug);
  }

  /**
   * Restaura una revisión como borrador y deja el documento en el estado que
   * devolvió el servidor. La restauración no publica: el usuario decide.
   */
  async restaurarRevision(slug: string, id: number): Promise<void> {
    const version = this.versions()[slug] ?? 1;
    const res = await this.api.restaurarRevision(slug, id, version);
    this.writeRoot(slug, res.contenido ?? {});
    this.versions.update((map) => ({ ...map, [slug]: res.version }));
    this.hasDraft.update((map) => ({ ...map, [slug]: true }));
    this.dirty.set(false);
    this.conflict.set('');
    this.dirtyFields.set(new Set());
  }

  async listPages(): Promise<CmsPageSummary[]> {
    const catalog = await this.api.getPaginas();
    this.pageList.set(catalog.paginas);
    this.menuItems.set(catalog.menu);
    return catalog.paginas;
  }

  async createPage(body: {
    titulo: string;
    slug?: string;
    plantilla?: string;
    ruta?: string;
    mostrar_en_menu?: boolean;
  }): Promise<CmsPageSummary> {
    const res = await this.api.crearPagina(body);
    const catalog = await this.api.getPaginas();
    this.pageList.set(catalog.paginas);
    this.menuItems.set(catalog.menu);
    if (res.contenido) {
      this.writeRoot(res.pagina.slug, res.contenido);
      this.versions.update((map) => ({ ...map, [res.pagina.slug]: res.version }));
      // La página nace con borrador y sin contenido publicado.
      this.hasDraft.update((map) => ({ ...map, [res.pagina.slug]: true }));
    }
    return res.pagina;
  }

  async deletePage(slug: string): Promise<void> {
    await this.api.eliminarPagina(slug);
    const next = { ...this.pages() };
    delete next[slug];
    this.pages.set(next);
    const catalog = await this.api.getPaginas();
    this.pageList.set(catalog.paginas);
    this.menuItems.set(catalog.menu);
  }

  async updatePageMeta(
    slug: string,
    body: {
      titulo?: string;
      slug?: string;
      ruta?: string;
      mostrar_en_menu?: boolean;
      orden_menu?: number;
    }
  ): Promise<CmsPageSummary> {
    const res = await this.api.actualizarMeta(slug, body);
    const catalog = await this.api.getPaginas();
    this.pageList.set(catalog.paginas);
    this.menuItems.set(catalog.menu);
    if (res.pagina.slug !== slug) {
      if (this.pages()[slug]) {
        const next = { ...this.pages() };
        next[res.pagina.slug] = next[slug];
        delete next[slug];
        this.pages.set(next);
      }
      this.hasDraft.update((map) => {
        const next = { ...map };
        next[res.pagina.slug] = next[slug] ?? false;
        delete next[slug];
        return next;
      });
      this.versions.update((map) => {
        const next = { ...map };
        if (next[slug] !== undefined) {
          next[res.pagina.slug] = next[slug];
          delete next[slug];
        }
        return next;
      });
      if (this.currentSlug() === slug) {
        this.currentSlug.set(res.pagina.slug);
      }
    }
    return res.pagina;
  }

  /**
   * Guarda pidiendo al servidor. El estado en memoria (contenido, versión, dirty)
   * solo se actualiza cuando el servidor confirma; si falla, no cambia nada.
   */
  async save(): Promise<void> {
    const slug = this.currentSlug();
    this.saving.set(true);
    this.conflict.set('');
    try {
      const version = this.versions()[slug] ?? 1;
      const content = slug === SITIO_SLUG ? this.site() : (this.pages()[slug] ?? {});
      const res =
        slug === SITIO_SLUG
          ? await this.api.guardarConfiguracion(content, version)
          : await this.api.guardarPagina(slug, content, version);
      this.applySaveResponse(slug, res);
    } catch (err) {
      this.handleSaveError(err);
      throw err;
    } finally {
      this.saving.set(false);
    }
  }

  async publish(): Promise<void> {
    const slug = this.currentSlug();
    this.saving.set(true);
    this.conflict.set('');
    try {
      const version = this.versions()[slug] ?? 1;
      const res =
        slug === SITIO_SLUG
          ? await this.api.publicarConfiguracion(version)
          : await this.api.publicarPagina(slug, version);
      this.applySaveResponse(slug, res);
      this.hasDraft.update((map) => ({ ...map, [slug]: false }));
      this.dirtyFields.set(new Set());
      this.fieldError.set(null);
    } catch (err) {
      this.handleSaveError(err);
      throw err;
    } finally {
      this.saving.set(false);
    }
  }

  private applySaveResponse(slug: string, res: CmsDocResponse): void {
    const content =
      res.contenido ?? (slug === SITIO_SLUG ? this.site() : this.pages()[slug] ?? {});
    this.writeRoot(slug, content);
    this.versions.update((map) => ({ ...map, [slug]: res.version }));
    this.hasDraft.update((map) => ({ ...map, [slug]: true }));
    this.dirty.set(false);
    this.conflict.set('');
  }

  private handleSaveError(err: unknown): void {
    if (err instanceof HttpErrorResponse) {
      const body = err.error as { message?: string; version?: number; field?: string } | null;
      const message = body?.message as string | undefined;
      if (err.status === 409) {
        const serverVersion = typeof body?.version === 'number' ? body.version : undefined;
        const base = message || 'Alguien guardó antes. Recarga para no pisar cambios.';
        this.conflict.set(serverVersion != null ? `${base} (servidor v${serverVersion})` : base);
        return;
      }
      if (typeof body?.field === 'string' && body.field) {
        this.fieldError.set({ path: body.field, message: message || 'Revisa este contenido.' });
        this.conflict.set(message || 'No se pudieron guardar los cambios.');
        return;
      }
      this.conflict.set(message || 'No se pudieron guardar los cambios.');
      return;
    }
    this.conflict.set('No se pudieron guardar los cambios.');
  }

  private writeDoc(slug: string, doc: CmsDocResponse): void {
    this.writeRoot(slug, doc.contenido ?? {});
    this.versions.update((map) => ({ ...map, [slug]: doc.version }));
    this.hasDraft.update((map) => ({ ...map, [slug]: !!doc.tiene_borrador }));
  }

  private writeRoot(slug: string, content: JsonMap): void {
    if (slug === SITIO_SLUG) {
      this.site.set(content);
    } else {
      this.pages.set({ ...this.pages(), [slug]: content });
    }
  }

  private applyValue(slug: string, path: string, value: unknown, scope: 'page' | 'site'): void {
    if (!path) {
      this.writeRoot(slug, (value && typeof value === 'object' ? value : {}) as JsonMap);
      return;
    }
    if (scope === 'site' || slug === SITIO_SLUG) {
      this.site.set(setByPath(this.site(), path, value));
      return;
    }
    const next = { ...this.pages() };
    next[slug] = setByPath(next[slug] ?? {}, path, value);
    this.pages.set(next);
  }

  private scheduleAutosave(): void {
    if (!this.editing) {
      return;
    }
    if (this.autosaveTimer) {
      window.clearTimeout(this.autosaveTimer);
    }
    this.autosaveTimer = window.setTimeout(() => {
      if (this.dirty() && !this.saving() && !this.conflict()) {
        this.save().catch(() => undefined);
      }
    }, 2000);
  }
}
