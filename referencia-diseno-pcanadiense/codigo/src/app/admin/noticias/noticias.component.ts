import { GestionPreview } from '../shared/gestion-preview/gestion-preview';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NewsService, NEWS_CATEGORY_LABEL } from '../../core/services/news.service';
import { NewsCategory, NewsItem } from '../../core/models/news.model';
import { AppSrc } from '../../core/directives/app-src';
import { DialogComponent } from '../../shared/ui';
import { SelectorArchivo } from '../shared/selector-archivo/selector-archivo';
import { EditorQuill } from '../shared/editor-quill/editor-quill';
import { ToastService } from '../shared/toast/toast';
import { htmlVacio, esHtml, excerpt } from '../../core/utils/html';

interface NoticiaForm {
  title: string;
  category: NewsCategory;
  categoryLabel: string;
  excerpt: string;
  paragraphs: string;
  image: string;
  imageAlt: string;
  createdAt: string;
  featured: boolean;
  publicada: boolean;
}

const VACIO: NoticiaForm = {
  title: '',
  category: 'noticia',
  categoryLabel: 'Noticia',
  excerpt: '',
  paragraphs: '',
  image: '',
  imageAlt: '',
  createdAt: new Date().toISOString().slice(0, 10),
  featured: false,
  publicada: true,
};

@Component({
  selector: 'app-admin-noticias',
  standalone: true,
  imports: [GestionPreview, DialogComponent, SelectorArchivo, AppSrc, EditorQuill],
  templateUrl: './noticias.component.html',
  styleUrl: './noticias.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminNoticiasComponent {
  private readonly news = inject(NewsService);
  private readonly toast = inject(ToastService);

  readonly items = this.news.all;
  readonly busqueda = signal('');
  readonly pagina = signal(1);
  readonly porPagina = 10;
  readonly filtrados = computed(() => {
    const q = this.busqueda().trim().toLocaleLowerCase('es');
    const datos = this.items();
    return q ? datos.filter(item => [item.title, item.categoryLabel, item.excerpt].some(v => String(v ?? '').toLocaleLowerCase('es').includes(q))) : datos;
  });
  readonly totalPaginas = computed(() => Math.max(1, Math.ceil(this.filtrados().length / this.porPagina)));
  readonly paginaActual = computed(() => Math.min(this.pagina(), this.totalPaginas()));
  readonly paginados = computed(() => this.filtrados().slice((this.paginaActual() - 1) * this.porPagina, this.paginaActual() * this.porPagina));
  buscar(valor: string): void { this.busqueda.set(valor); this.pagina.set(1); }
  cambiarPagina(delta: number): void { this.pagina.set(Math.max(1, Math.min(this.totalPaginas(), this.paginaActual() + delta))); }

  readonly categorias: NewsCategory[] = ['noticia', 'comunicado', 'evento'];
  readonly labels = NEWS_CATEGORY_LABEL;
  readonly formAbierto = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly form = signal<NoticiaForm>({ ...VACIO });
  private formularioInicial = '';
  readonly hayCambios = computed(() => this.formAbierto() && JSON.stringify(this.form()) !== this.formularioInicial);
  cerrarFormulario(): void {
    if (this.guardando()) return;
    if (this.hayCambios() && !window.confirm('Hay cambios sin guardar. ¿Desea descartarlos?')) return;
    this.formAbierto.set(false);
  }
  alCambiarDialogo(abierto: boolean): void {
    if (!abierto) this.cerrarFormulario();
  }

  readonly confirm = signal<NewsItem | null>(null);
  readonly guardando = signal(false);
  readonly eliminando = signal(false);

  abrirNueva(): void {
    this.editingId.set(null);
    this.form.set({ ...VACIO, createdAt: new Date().toISOString().slice(0, 10) });
    this.formularioInicial = JSON.stringify(this.form());
    this.formAbierto.set(true);
  }

  abrirEditar(item: NewsItem): void {
    this.editingId.set(item.id);
    this.form.set({
      title: item.title,
      category: item.category,
      categoryLabel: item.categoryLabel,
      excerpt: item.excerpt,
      paragraphs: esHtml(item.paragraphs.join(''))
        ? item.paragraphs.join('')
        : item.paragraphs.join('\n\n'),
      image: item.image,
      imageAlt: item.imageAlt,
      createdAt: item.createdAt.slice(0, 10),
      featured: Boolean(item.featured),
      publicada: item.publicada !== false,
    });
    this.formularioInicial = JSON.stringify(this.form());
    this.formAbierto.set(true);
  }

  patch<K extends keyof NoticiaForm>(key: K, value: NoticiaForm[K]): void {
    this.form.update((current) => ({ ...current, [key]: value }));
  }

  bajada(texto: string): string {
    return excerpt(texto, 140);
  }

  onCategoria(category: NewsCategory): void {
    this.form.update((current) => ({
      ...current,
      category,
      categoryLabel: NEWS_CATEGORY_LABEL[category],
    }));
  }

  private cuerpo(): Omit<NewsItem, 'id'> {
    const data = this.form();
    return {
      title: data.title.trim(),
      category: data.category,
      categoryLabel: data.categoryLabel.trim() || NEWS_CATEGORY_LABEL[data.category],
      excerpt: data.excerpt.trim(),
      paragraphs: esHtml(data.paragraphs)
        ? htmlVacio(data.paragraphs)
          ? []
          : [data.paragraphs]
        : data.paragraphs
            .split(/\n+/)
            .map((p) => p.trim())
            .filter(Boolean),
      image: data.image.trim(),
      imageAlt: data.imageAlt.trim() || data.title.trim(),
      createdAt: data.createdAt,
      featured: data.featured,
      publicada: data.publicada,
    };
  }

  async guardar(): Promise<void> {
    const data = this.cuerpo();
    if (!data.title || htmlVacio(data.excerpt) || data.paragraphs.length === 0) {
      this.toast.error('Título, bajada y al menos un párrafo son obligatorios.');
      return;
    }
    if (this.guardando()) return;
    this.guardando.set(true);
    try {
      const id = this.editingId();
      if (id) {
        await this.news.actualizar({ id, ...data });
        this.toast.success(
          data.publicada ? 'Noticia actualizada en el portal.' : 'Borrador actualizado.',
        );
      } else {
        await this.news.crear(data);
        this.toast.success(
          data.publicada
            ? 'Noticia publicada en /noticias.'
            : 'Borrador guardado. No sale en el portal.',
        );
      }
      this.formAbierto.set(false);
    } catch {
      this.toast.error('No se pudo guardar la noticia.');
    } finally {
      this.guardando.set(false);
    }
  }

  async eliminar(): Promise<void> {
    const item = this.confirm();
    if (!item || this.eliminando()) return;
    this.eliminando.set(true);
    try {
      await this.news.eliminar(item.id);
      this.confirm.set(null);
      this.toast.success('Se quitó del listado público.');
    } catch {
      this.toast.error('No se pudo eliminar la noticia.');
    } finally {
      this.eliminando.set(false);
    }
  }
}
