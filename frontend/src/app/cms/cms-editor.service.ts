import { Injectable, signal } from '@angular/core';

export type PreviewDevice = 'desktop' | 'tablet' | 'mobile';

@Injectable({ providedIn: 'root' })
export class CmsEditorService {
  readonly editMode = signal(false);
  readonly device = signal<PreviewDevice>('desktop');
  readonly uploading = signal(false);

  enable(): void {
    this.editMode.set(true);
  }

  disable(): void {
    this.editMode.set(false);
  }

  setEditing(on: boolean): void {
    this.editMode.set(on);
  }

  deviceWidth(): number {
    switch (this.device()) {
      case 'mobile':
        return 390;
      case 'tablet':
        return 768;
      default:
        return 1200;
    }
  }
}
