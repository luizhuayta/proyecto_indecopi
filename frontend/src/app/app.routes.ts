import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';
import { dirtyGuard } from './core/dirty.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./public/portal-publico').then((m) => m.PortalPublico),
  },
  {
    path: 'admin/login',
    loadComponent: () => import('./admin/admin-login').then((m) => m.AdminLogin),
  },
  {
    path: 'admin',
    canActivate: [authGuard],
    loadComponent: () => import('./admin/admin-shell').then((m) => m.AdminShell),
    children: [
      { path: '', redirectTo: 'paginas', pathMatch: 'full' },
      {
        path: 'paginas',
        loadComponent: () => import('./admin/admin-paginas').then((m) => m.AdminPaginas),
      },
      {
        path: 'editor/:slug',
        canDeactivate: [dirtyGuard],
        loadComponent: () => import('./admin/page-editor').then((m) => m.PageEditor),
      },
      {
        path: 'identidad',
        loadComponent: () => import('./admin/admin-identidad').then((m) => m.AdminIdentidad),
      },
      {
        path: 'apariencia',
        loadComponent: () => import('./admin/admin-apariencia').then((m) => m.AdminApariencia),
      },
      {
        path: 'mensajes',
        loadComponent: () => import('./admin/admin-mensajes').then((m) => m.AdminMensajes),
      },
      {
        path: 'medios',
        loadComponent: () => import('./admin/admin-medios').then((m) => m.AdminMedios),
      },
    ],
  },
  { path: '**', loadComponent: () => import('./public/portal-publico').then((m) => m.PortalPublico) },
];
