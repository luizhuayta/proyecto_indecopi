import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./public/inicio').then((m) => m.Inicio),
  },
  { path: '**', redirectTo: '' },
];
