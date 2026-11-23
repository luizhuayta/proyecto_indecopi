import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  type: 'success' | 'error';
  message: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 0;
  private readonly maxVisibles = 4;
  readonly toasts = signal<Toast[]>([]);

  success(message: string): void {
    this.push('success', message);
  }

  error(message: string): void {
    this.push('error', message);
  }

  dismiss(id: number): void {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }

  private push(type: Toast['type'], message: string): void {
    const id = ++this.nextId;
    const mensaje = message.trim();
    if (!mensaje) return;
    this.toasts.update((list) => [...list.filter(t => t.message !== mensaje || t.type !== type).slice(-(this.maxVisibles - 1)), { id, type, message: mensaje }]);
    setTimeout(() => this.dismiss(id), 4000);
  }
}
