import { CommonModule } from '@angular/common';
import { Component, Input, computed, inject, signal } from '@angular/core';
import { CmsApiService } from '../cms/cms-api.service';
import { CmsContentService } from '../cms/cms-content.service';
import { CmsEditorService } from '../cms/cms-editor.service';
import { BLOCK_CATALOG, blockLabel, pageBlocks } from '../cms/block-registry';
import type { SchemaField } from '../cms/cms-schema';

/**
 * Panel de campos del bloque seleccionado. Muestra los campos que declara el
 * `schema` del tipo y permite editarlos en vivo (cada cambio va a `CmsContentService`).
 * Los campos `list` y `group` se renderizan de forma recursiva con una plantilla
 * que se referencia a sí misma.
 */
@Component({
  selector: 'app-cms-inspector',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="inspector">
      @if (block(); as b) {
        <header class="inspector__cabecera">
          <h2 class="inspector__titulo">{{ tipoLabel() }}</h2>
          <p class="inspector__tipo">Bloque {{ b.type }}</p>
        </header>

        @if (error()) {
          <p class="campo__nota" role="alert">{{ error() }}</p>
        }

        <ng-container
          [ngTemplateOutlet]="recurse"
          [ngTemplateOutletContext]="{ $implicit: schema(), prefix: prefix() }"
        ></ng-container>
      } @else {
        <p class="inspector__vacio">Selecciona un bloque de la vista previa para editar sus campos.</p>
      }
    </div>

    <ng-template #recurse let-fields let-prefix>
      @for (field of fields; track field.path) {
        @let fullPath = prefix + '.' + field.path;
        @switch (field.type) {
          @case ('list') {
            <fieldset class="campo campo--lista">
              <legend>{{ field.label }}</legend>
              @for (item of list(fullPath); track $index) {
                <div class="lista-editor__item">
                  <div class="lista-editor__acciones">
                    <button
                      type="button"
                      class="admin-btn admin-btn--fantasma"
                      (click)="move(fullPath, $index, $index - 1)"
                      [disabled]="$index === 0"
                      [attr.aria-label]="'Subir elemento ' + ($index + 1)"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      class="admin-btn admin-btn--fantasma"
                      (click)="move(fullPath, $index, $index + 1)"
                      [disabled]="$index === list(fullPath).length - 1"
                      [attr.aria-label]="'Bajar elemento ' + ($index + 1)"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      class="admin-btn admin-btn--fantasma"
                      (click)="remove(fullPath, $index)"
                      [attr.aria-label]="'Quitar elemento ' + ($index + 1)"
                    >
                      Quitar
                    </button>
                  </div>
                  <ng-container
                    [ngTemplateOutlet]="recurse"
                    [ngTemplateOutletContext]="{ $implicit: field.item ?? [], prefix: fullPath + '.' + $index }"
                  ></ng-container>
                </div>
              }
              <button type="button" class="admin-btn admin-btn--fantasma" (click)="add(fullPath)">
                Agregar {{ field.label | lowercase }}
              </button>
            </fieldset>
          }
          @case ('group') {
            <fieldset class="campo campo--grupo">
              <legend>{{ field.label }}</legend>
              <ng-container
                [ngTemplateOutlet]="recurse"
                [ngTemplateOutletContext]="{ $implicit: field.children ?? [], prefix: fullPath }"
              ></ng-container>
            </fieldset>
          }
          @default {
            <div class="campo">
              @switch (field.type) {
                @case ('bool') {
                  <label class="campo__bool">
                    <input
                      type="checkbox"
                      [checked]="bool(fullPath)"
                      (change)="setBool(fullPath, $any($event.target).checked)"
                    />
                    <span>{{ field.label }}</span>
                  </label>
                }
                @case ('select') {
                  <label [attr.for]="idOf(fullPath)">{{ field.label }}</label>
                  <select [id]="idOf(fullPath)" [value]="str(fullPath)" (change)="setStr(fullPath, $any($event.target).value)">
                    @for (opt of field.options ?? []; track opt.value) {
                      <option [value]="opt.value">{{ opt.label }}</option>
                    }
                  </select>
                }
                @case ('color') {
                  <label [attr.for]="idOf(fullPath)">{{ field.label }}</label>
                  <input
                    [id]="idOf(fullPath)"
                    type="color"
                    [value]="str(fullPath)"
                    (input)="setStr(fullPath, $any($event.target).value)"
                  />
                }
                @case ('area') {
                  <label [attr.for]="idOf(fullPath)">{{ field.label }}</label>
                  <textarea
                    [id]="idOf(fullPath)"
                    rows="4"
                    [value]="str(fullPath)"
                    (input)="setStr(fullPath, $any($event.target).value)"
                  ></textarea>
                }
                @case ('rich') {
                  <label [attr.for]="idOf(fullPath)">{{ field.label }}</label>
                  <textarea
                    [id]="idOf(fullPath)"
                    class="campo__rich"
                    rows="8"
                    [value]="str(fullPath)"
                    (input)="setStr(fullPath, $any($event.target).value)"
                  ></textarea>
                  <p class="campo__nota">Puedes usar negrita, listas y enlaces con HTML.</p>
                }
                @case ('image') {
                  <label [attr.for]="idOf(fullPath)">{{ field.label }}</label>
                  <div class="campo__imagen">
                    <input
                      [id]="idOf(fullPath)"
                      type="text"
                      [value]="str(fullPath)"
                      (input)="setStr(fullPath, $any($event.target).value)"
                      placeholder="https://…"
                    />
                    <label class="admin-btn admin-btn--fantasma">
                      Subir
                      <input type="file" accept="image/*" (change)="upload(fullPath, $event)" hidden />
                    </label>
                  </div>
                  @if (str(fullPath)) {
                    <img class="campo__miniatura" [src]="str(fullPath)" alt="Vista previa" />
                  }
                }
                @case ('number') {
                  <label [attr.for]="idOf(fullPath)">{{ field.label }}</label>
                  <input
                    [id]="idOf(fullPath)"
                    type="number"
                    [value]="num(fullPath)"
                    (input)="setNum(fullPath, $any($event.target).value)"
                  />
                }
                @case ('embed') {
                  <label [attr.for]="idOf(fullPath)">{{ field.label }}</label>
                  <input
                    [id]="idOf(fullPath)"
                    type="text"
                    [value]="str(fullPath)"
                    (input)="setStr(fullPath, $any($event.target).value)"
                    placeholder="https://…"
                  />
                  <p class="campo__nota">Solo se aceptan enlaces https.</p>
                }
                @default {
                  <label [attr.for]="idOf(fullPath)">{{ field.label }}</label>
                  <input
                    [id]="idOf(fullPath)"
                    type="text"
                    [value]="str(fullPath)"
                    (input)="setStr(fullPath, $any($event.target).value)"
                  />
                }
              }
            </div>
          }
        }
      }
    </ng-template>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .inspector {
        display: flex;
        flex-direction: column;
        gap: var(--space-16, 1rem);
      }
      .inspector__cabecera {
        border-bottom: 1px solid var(--color-borde);
        padding-bottom: var(--space-8, 0.5rem);
      }
      .inspector__titulo {
        font-size: var(--texto-lg, 1.125rem);
        margin: 0;
      }
      .inspector__tipo {
        color: var(--color-texto-suave);
        font-size: var(--texto-sm, 0.875rem);
        margin: 0;
      }
      .inspector__vacio {
        color: var(--color-texto-suave);
        margin: 0;
      }
      .campo {
        display: flex;
        flex-direction: column;
        gap: var(--space-4, 0.25rem);
      }
      .campo--lista,
      .campo--grupo {
        border: 1px solid var(--color-borde);
        border-radius: var(--radio-campo, 4px);
        padding: var(--space-12, 0.75rem);
        margin: 0;
      }
      .campo--lista legend,
      .campo--grupo legend {
        font-weight: 600;
        padding: 0 var(--space-4, 0.25rem);
      }
      .campo label {
        font-size: var(--texto-sm, 0.875rem);
        color: var(--color-texto);
      }
      .campo input[type='text'],
      .campo input[type='number'],
      .campo input[type='color'],
      .campo select,
      .campo textarea {
        width: 100%;
        padding: 0.5rem 0.625rem;
        border: 1px solid var(--color-borde);
        border-radius: var(--radio-campo, 4px);
        background: var(--color-superficie);
        color: var(--color-texto);
        font: inherit;
      }
      .campo input[type='color'] {
        height: 2.5rem;
        padding: 0.25rem;
      }
      .campo input:focus-visible,
      .campo select:focus-visible,
      .campo textarea:focus-visible {
        outline: 2px solid var(--color-primario);
        outline-offset: 2px;
      }
      .campo__bool {
        display: flex;
        align-items: center;
        gap: var(--space-8, 0.5rem);
      }
      .campo__nota {
        font-size: var(--texto-xs, 0.75rem);
        color: var(--color-texto-suave);
        margin: 0;
      }
      .campo__imagen {
        display: flex;
        gap: var(--space-8, 0.5rem);
        align-items: center;
      }
      .campo__miniatura {
        max-width: 100%;
        max-height: 10rem;
        object-fit: contain;
        border: 1px solid var(--color-borde);
        border-radius: var(--radio-campo, 4px);
      }
      .lista-editor__item {
        border-top: 1px dashed var(--color-borde);
        padding-top: var(--space-8, 0.5rem);
        margin-top: var(--space-8, 0.5rem);
        display: flex;
        flex-direction: column;
        gap: var(--space-8, 0.5rem);
      }
      .lista-editor__acciones {
        display: flex;
        gap: var(--space-4, 0.25rem);
      }
      .admin-btn {
        border: 1px solid var(--color-borde);
        background: var(--color-superficie);
        color: var(--color-texto);
        border-radius: var(--radio-campo, 4px);
        padding: 0.4rem 0.75rem;
        font: inherit;
        cursor: pointer;
      }
      .admin-btn:hover {
        border-color: var(--color-secundario);
      }
      .admin-btn:focus-visible {
        outline: 2px solid var(--color-primario);
        outline-offset: 2px;
      }
      .admin-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .admin-btn--fantasma {
        background: transparent;
      }
      .admin-btn--fantasma:hover {
        background: var(--color-superficie);
      }
    `,
  ],
})
export class CmsInspector {
  private cms = inject(CmsContentService);
  private editor = inject(CmsEditorService);
  private api = inject(CmsApiService);

  @Input({ required: true }) blockIndex!: number;
  readonly error = signal('');

  readonly block = computed(() => pageBlocks(this.cms.activeContent())[this.blockIndex] ?? null);
  readonly schema = computed(() => BLOCK_CATALOG[this.block()?.type ?? '']?.schema ?? []);
  readonly prefix = computed(() => `blocks.${this.blockIndex}.props`);
  readonly tipoLabel = computed(() => blockLabel(this.block()?.type ?? ''));

  str(path: string): string {
    return this.cms.get<string>(path) ?? '';
  }

  setStr(path: string, value: string): void {
    this.cms.set(path, value);
  }

  num(path: string): number {
    return Number(this.cms.get<number>(path) ?? 0);
  }

  setNum(path: string, value: string): void {
    this.cms.set(path, Number(value));
  }

  bool(path: string): boolean {
    return !!this.cms.get<boolean>(path);
  }

  setBool(path: string, value: boolean): void {
    this.cms.set(path, value);
  }

  list(path: string): unknown[] {
    return this.cms.get<unknown[]>(path) ?? [];
  }

  add(path: string): void {
    this.cms.addListItem(path);
  }

  remove(path: string, index: number): void {
    this.cms.removeListItem(path, index);
  }

  move(path: string, from: number, to: number): void {
    this.cms.moveListItem(path, from, to);
  }

  idOf(path: string): string {
    return 'campo-' + path.replace(/[^a-zA-Z0-9]/g, '-');
  }

  async upload(path: string, event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }
    this.editor.uploading.set(true);
    this.error.set('');
    try {
      const res = await this.api.subirMedio(file);
      this.cms.set(path, res.url);
    } catch {
      this.error.set('No se pudo subir la imagen.');
    } finally {
      this.editor.uploading.set(false);
    }
  }

  schemaOf(field: SchemaField): SchemaField[] {
    return field.item ?? field.children ?? [];
  }
}
